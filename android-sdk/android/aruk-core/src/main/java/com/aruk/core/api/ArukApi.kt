package com.aruk.core.api

import com.aruk.core.model.*
import kotlinx.serialization.json.JsonObject
import retrofit2.http.*

/**
 * Retrofit service interface — maps 1:1 to the Next.js /api/* routes.
 *
 * Consumers can use this directly for custom HTTP configurations,
 * or use [ArukClient] which wraps it with retry logic and Hilt DI.
 */
interface ArukApi {

    // ── Health ────────────────────────────────────────────────

    @GET("/api/health")
    suspend fun health(): HealthResponse

    // ── Agent API (POST actions) ─────────────────────────────

    @POST("/api/agent")
    suspend fun agentAction(@Body body: AgentRequest): AgentResponse<JsonObject>

    // ── Agent API (GET simple key) ────────────────────────────

    @GET("/api/agent")
    suspend fun getKeySimple(
        @Query("provider") provider: String? = null,
        @Query("strategy") strategy: String? = null,
        @Query("hideKey") hideKey: Boolean? = null
    ): RoutingDecision

    // ── Accounts ──────────────────────────────────────────────

    @GET("/api/accounts")
    suspend fun listAccounts(
        @Query("provider") provider: String? = null
    ): List<AccountInfo>

    @POST("/api/accounts")
    suspend fun createAccount(@Body body: JsonObject): AccountInfo

    @PUT("/api/accounts")
    suspend fun updateAccount(@Body body: JsonObject): AccountInfo

    @DELETE("/api/accounts")
    suspend fun deleteAccount(@Query("id") id: String): Map<String, Any>

    @POST("/api/accounts/toggle")
    suspend fun toggleAccount(@Query("id") id: String): AccountInfo

    // ── Credits ───────────────────────────────────────────────

    @GET("/api/credits")
    suspend fun getCredits(): Map<String, Any>

    // ── Routing ───────────────────────────────────────────────

    @GET("/api/routing")
    suspend fun route(
        @Query("strategy") strategy: String? = null,
        @Query("provider") provider: String? = null
    ): RoutingDecision

    // ── Secrets ───────────────────────────────────────────────

    @GET("/api/secrets")
    suspend fun listSecrets(
        @Query("type") type: String? = null,
        @Query("provider") provider: String? = null,
        @Query("purpose") purpose: String? = null,
        @Query("status") status: String? = null
    ): List<SecretEntry>

    @POST("/api/secrets")
    suspend fun createSecret(@Body body: JsonObject): SecretEntry

    @PUT("/api/secrets")
    suspend fun updateSecret(@Body body: JsonObject): SecretEntry

    @DELETE("/api/secrets")
    suspend fun deleteSecret(@Query("id") id: String): Map<String, Any>

    // ── Stats ─────────────────────────────────────────────────

    @GET("/api/stats")
    suspend fun getStats(): Map<String, Any>

    // ── Usage Logs ────────────────────────────────────────────

    @GET("/api/usage/logs")
    suspend fun getUsageLogs(
        @Query("page") page: Int = 1,
        @Query("perPage") perPage: Int = 20,
        @Query("accountId") accountId: String? = null
    ): Map<String, Any>

    @GET("/api/usage/daily")
    suspend fun getDailyUsage(
        @Query("days") days: Int = 30
    ): List<DailyUsage>

    // ── Export ────────────────────────────────────────────────

    @GET("/api/export")
    suspend fun exportData(
        @Query("format") format: String = "json"
    ): Map<String, Any>

    // ── Predictions ───────────────────────────────────────────

    @GET("/api/predictions")
    suspend fun getPredictions(): Map<String, Any>

    // ── Simulate ──────────────────────────────────────────────

    @POST("/api/simulate")
    suspend fun simulate(@Body body: JsonObject): Map<String, Any>
}

/**
 * Request body for POST /api/agent.
 * The 'action' field determines which operation to perform.
 */
@kotlinx.serialization.Serializable
data class AgentRequest(
    val action: String,
    val id: String? = null,
    val strategy: String? = null,
    val provider: String? = null,
    val apiKey: String? = null,
    val name: String? = null,
    val priority: Int? = null,
    val apiKeys: List<String>? = null,
    val namePrefix: String? = null,
    val endpoint: String? = null,
    val model: String? = null,
    val inputTokens: Int? = null,
    val outputTokens: Int? = null,
    val cost: Double? = null,
    val latencyMs: Int? = null,
    val status: String? = null,
    val errorMessage: String? = null,
    val type: String? = null,
    val credentials: Map<String, String>? = null,
    val purpose: String? = null,
    val notes: String? = null,
    val expiresAt: String? = null
)
