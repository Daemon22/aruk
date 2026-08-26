package com.aruk.core.network

import com.aruk.core.api.ArukApi
import com.aruk.core.api.AgentRequest
import com.aruk.core.model.*
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

// ════════════════════════════════════════════════════════════════
// Configuration
// ════════════════════════════════════════════════════════════════

/**
 * Configuration for the Aruk client.
 *
 * @param baseUrl Server URL (default: http://localhost:3000 for Tauri embedded,
 *               or http://10.0.2.2:3000 for Android emulator,
 *               or your production URL)
 * @param authToken Optional bearer token for authentication
 * @param retries Number of automatic retries on 503 errors (default: 2)
 * @param retryDelayMs Base delay between retries, multiplied by attempt number
 * @param connectTimeoutMs HTTP connection timeout
 * @param readTimeoutMs HTTP read timeout
 * @param debug Enable request/response logging
 */
data class ArukConfig(
    val baseUrl: String = "http://localhost:3000",
    val authToken: String? = null,
    val retries: Int = 2,
    val retryDelayMs: Long = 500,
    val connectTimeoutMs: Long = 10_000,
    val readTimeoutMs: Long = 30_000,
    val debug: Boolean = false
)

// ════════════════════════════════════════════════════════════════
// Error
// ════════════════════════════════════════════════════════════════

class ArukException(
    message: String,
    val httpStatus: Int = -1
) : Exception(message)

// ════════════════════════════════════════════════════════════════
// Client
// ════════════════════════════════════════════════════════════════

/**
 * High-level Aruk SDK client with retry logic.
 *
 * This is the primary entry point for integrating Aruk into any
 * Android application. It mirrors the TypeScript [ArukClient] API.
 *
 * Usage:
 * ```kotlin
 * val aruk = ArukClient(ArukConfig(baseUrl = "http://10.0.2.2:3000"))
 * val decision = aruk.getKey(RoutingStrategy.FASTEST)
 * println("Using key from ${decision.providerName}")
 * ```
 */
class ArukClient @Inject constructor(
    private val config: ArukConfig
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val okHttpClient: OkHttpClient by lazy {
        val builder = OkHttpClient.Builder()
            .connectTimeout(config.connectTimeoutMs, TimeUnit.MILLISECONDS)
            .readTimeout(config.readTimeoutMs, TimeUnit.MILLISECONDS)
            .addInterceptor { chain ->
                val request = chain.request().newBuilder()
                    .header("Content-Type", "application/json")
                config.authToken?.let {
                    request.header("Authorization", "Bearer $it")
                }
                chain.proceed(request.build())
            }
        if (config.debug) {
            builder.addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
        }
        builder.build()
    }

    private val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(config.baseUrl.removeSuffix("/"))
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    /** Low-level Retrofit API — available for custom use cases */
    val api: ArukApi by lazy { retrofit.create(ArukApi::class.java) }

    // ── Retry Logic ──────────────────────────────────────────

    private suspend fun <T> withRetries(block: suspend () -> T): T {
        var lastError: Throwable? = null
        for (attempt in 0..config.retries) {
            try {
                return block()
            } catch (e: ArukException) {
                lastError = e
                if (e.httpStatus == 503 && attempt < config.retries) {
                    delay(config.retryDelayMs * (attempt + 1))
                    continue
                }
                throw e
            } catch (e: SocketTimeoutException) {
                lastError = e
                if (attempt < config.retries) {
                    delay(config.retryDelayMs * (attempt + 1))
                    continue
                }
                throw ArukException("Server timeout after ${config.retries + 1} attempts", 504)
            }
        }
        throw lastError ?: ArukException("Unknown error")
    }

    // ── Health ───────────────────────────────────────────────

    /** Check server health. Throws on non-healthy status. */
    suspend fun health(): HealthResponse = api.health()

    /** Returns true if the server is reachable and healthy. */
    suspend fun ping(): Boolean = try {
        api.health().status == "healthy"
    } catch (_: Exception) {
        false
    }

    // ── API Key Routing ──────────────────────────────────────

    /**
     * Get the best API key for a request.
     * Uses smart routing with automatic retry on 503 (server choosing to retry).
     *
     * @param strategy Routing strategy (default: BEST)
     * @param provider Optional provider filter (e.g. "OpenAI")
     * @return [RoutingDecision] with the selected key and metadata
     */
    suspend fun getKey(
        strategy: RoutingStrategy = RoutingStrategy.BEST,
        provider: String? = null
    ): RoutingDecision = withRetries {
        val response = api.agentAction(
            AgentRequest(action = "get_key", strategy = strategy.name.lowercase(), provider = provider)
        )
        if (!response.ok) {
            throw ArukException(response.error ?: "Routing failed", 503)
        }
        json.decodeFromJsonElement<RoutingDecision>(requireNotNull(response.data))
    }

    /**
     * Get a key via simple GET (no retry, for quick lookups).
     */
    suspend fun getKeySimple(
        provider: String? = null,
        strategy: RoutingStrategy = RoutingStrategy.BEST,
        hideKey: Boolean = false
    ): RoutingDecision = api.getKeySimple(
        provider = provider,
        strategy = strategy.name.lowercase(),
        hideKey = hideKey
    )

    /** Get the full failover chain (ordered list of backup keys). */
    suspend fun getFailoverChain(): List<AccountInfo> {
        val response = api.agentAction(AgentRequest(action = "failover"))
        if (!response.ok) throw ArukException(response.error ?: "Failed to get failover chain")
        return json.decodeFromJsonElement(response.data!!)
    }

    // ── Account Management ───────────────────────────────────

    /** List all accounts, optionally filtered by provider. */
    suspend fun listAccounts(provider: String? = null): List<AccountInfo> {
        val response = api.agentAction(
            AgentRequest(action = "list", provider = provider)
        )
        if (!response.ok) throw ArukException(response.error ?: "Failed to list accounts")
        return json.decodeFromJsonElement(response.data!!)
    }

    /** Add a single API key. */
    suspend fun addKey(
        providerName: String,
        apiKey: String,
        name: String? = null,
        priority: Int? = null
    ): AddKeyResult {
        val response = api.agentAction(
            AgentRequest(action = "add_key", provider = providerName, apiKey = apiKey, name = name, priority = priority)
        )
        if (!response.ok) throw ArukException(response.error ?: "Failed to add key")
        return json.decodeFromJsonElement(response.data!!)
    }

    /** Bulk-add multiple API keys at once. */
    suspend fun addKeys(
        providerName: String,
        apiKeys: List<String>,
        namePrefix: String? = null
    ): AddKeysResult {
        val response = api.agentAction(
            AgentRequest(action = "add_keys", provider = providerName, apiKeys = apiKeys, namePrefix = namePrefix)
        )
        if (!response.ok) throw ArukException(response.error ?: "Failed to add keys")
        return json.decodeFromJsonElement(response.data!!)
    }

    /** Report usage after making an API call. */
    suspend fun reportUsage(
        accountId: String,
        endpoint: String? = null,
        model: String? = null,
        inputTokens: Int? = null,
        outputTokens: Int? = null,
        cost: Double? = null,
        latencyMs: Int? = null,
        status: String? = null,
        errorMessage: String? = null
    ) {
        api.agentAction(
            AgentRequest(
                action = "report_usage",
                id = accountId,
                endpoint = endpoint,
                model = model,
                inputTokens = inputTokens,
                outputTokens = outputTokens,
                cost = cost,
                latencyMs = latencyMs,
                status = status,
                errorMessage = errorMessage
            )
        )
    }

    /** Get full status with stats and credit breakdowns. */
    suspend fun getStatus(): StatusResponse {
        val response = api.agentAction(AgentRequest(action = "status"))
        if (!response.ok) throw ArukException(response.error ?: "Failed to get status")
        return json.decodeFromJsonElement(response.data!!)
    }

    // ── Secrets Vault ────────────────────────────────────────

    /** Get a secret by purpose and optional provider. */
    suspend fun getSecret(
        purpose: SecretPurpose,
        provider: String? = null
    ): SecretEntry = withRetries {
        val response = api.agentAction(
            AgentRequest(action = "get_secret", purpose = purpose.name.lowercase(), provider = provider)
        )
        if (!response.ok) throw ArukException(response.error ?: "Secret not found", 404)
        json.decodeFromJsonElement(response.data!!)
    }

    /** List secrets with optional filters (credentials omitted). */
    suspend fun listSecrets(
        purpose: SecretPurpose? = null,
        provider: String? = null,
        type: SecretType? = null
    ): List<SecretListItem> {
        val response = api.agentAction(
            AgentRequest(
                action = "list_secrets",
                purpose = purpose?.name?.lowercase(),
                provider = provider,
                type = type?.name?.lowercase()
            )
        )
        if (!response.ok) throw ArukException(response.error ?: "Failed to list secrets")
        return json.decodeFromJsonElement(response.data!!)
    }

    /** Add a new secret to the vault. */
    suspend fun addSecret(
        name: String,
        type: SecretType,
        provider: String,
        credentials: Map<String, String>,
        purpose: SecretPurpose? = null,
        notes: String? = null
    ): AddKeyResult {
        val response = api.agentAction(
            AgentRequest(
                action = "add_secret",
                name = name,
                type = type.name.lowercase(),
                provider = provider,
                credentials = credentials,
                purpose = purpose?.name?.lowercase(),
                notes = notes
            )
        )
        if (!response.ok) throw ArukException(response.error ?: "Failed to add secret")
        return json.decodeFromJsonElement(response.data!!)
    }

    /** List secrets with full credential details. */
    suspend fun listSecretsFull(
        type: SecretType? = null,
        provider: String? = null,
        purpose: SecretPurpose? = null,
        status: String? = null
    ): List<SecretEntry> = api.listSecrets(
        type = type?.name?.lowercase(),
        provider = provider,
        purpose = purpose?.name?.lowercase(),
        status = status
    )

    /** Create a secret via the dedicated endpoint. */
    suspend fun createSecret(data: SecretCreateRequest): SecretEntry {
        val jsonBody = json.encodeToJsonElement(SecretCreateRequest.serializer(), data)
        return api.createSecret(jsonBody as kotlinx.serialization.json.JsonObject)
    }

    /** Update an existing secret. */
    suspend fun updateSecret(id: String, data: SecretUpdateRequest): SecretEntry {
        val jsonBody = json.encodeToJsonElement(
            kotlinx.serialization.serializer<Map<String, kotlinx.serialization.JsonElement>>(),
            buildMap {
                put("id", kotlinx.serialization.JsonPrimitive(id))
                data.name?.let { put("name", kotlinx.serialization.JsonPrimitive(it)) }
                data.type?.let { put("type", kotlinx.serialization.JsonPrimitive(it.name.lowercase())) }
                data.provider?.let { put("provider", kotlinx.serialization.JsonPrimitive(it)) }
                data.purpose?.let { put("purpose", kotlinx.serialization.JsonPrimitive(it.name.lowercase())) }
                data.credentials?.let { put("credentials", json.encodeToJsonElement(it)) }
                data.status?.let { put("status", kotlinx.serialization.JsonPrimitive(it)) }
                data.notes?.let { put("notes", kotlinx.serialization.JsonPrimitive(it)) }
            }
        )
        return api.updateSecret(jsonBody as kotlinx.serialization.json.JsonObject)
    }

    /** Delete a secret by ID. */
    suspend fun deleteSecret(id: String) {
        api.deleteSecret(id)
    }
}

// ════════════════════════════════════════════════════════════════
// Hilt Module
// ════════════════════════════════════════════════════════════════

@Module
@InstallIn(SingletonComponent::class)
object ArukModule {

    @Provides
    @Singleton
    fun provideArukConfig(): ArukConfig = ArukConfig()

    @Provides
    @Singleton
    fun provideArukClient(config: ArukConfig): ArukClient = ArukClient(config)
}

// ════════════════════════════════════════════════════════════════
// Request DTOs
// ════════════════════════════════════════════════════════════════

@kotlinx.serialization.Serializable
data class SecretCreateRequest(
    val name: String,
    val type: String,
    val provider: String,
    val credentials: Map<String, String>,
    val purpose: String? = null,
    val notes: String? = null,
    val expiresAt: String? = null
)

@kotlinx.serialization.Serializable
data class SecretUpdateRequest(
    val name: String? = null,
    val type: SecretType? = null,
    val provider: String? = null,
    val purpose: SecretPurpose? = null,
    val credentials: Map<String, String>? = null,
    val status: String? = null,
    val notes: String? = null
)