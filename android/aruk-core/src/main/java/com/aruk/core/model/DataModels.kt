package com.aruk.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ════════════════════════════════════════════════════════════════
// Data Models — direct mirrors of the Next.js API responses
// ════════════════════════════════════════════════════════════════

/**
 * A routing decision returned by the smart key selector.
 * This is the primary return type when requesting an API key.
 */
@Serializable
data class RoutingDecision(
    val accountId: String,
    val accountName: String,
    val providerName: String,
    val apiKey: String,
    val strategy: RoutingStrategy,
    val reason: String,
    val healthScore: Double,
    val remainingPercent: Double
)

/**
 * Full account information with computed credit fields.
 */
@Serializable
data class AccountInfo(
    val id: String,
    val name: String,
    val providerName: String,
    val status: AccountStatus,
    val priority: Int,
    val totalCredits: Double,
    val usedCredits: Double,
    val creditUnit: CreditUnit,
    val healthScore: Double,
    val avgLatencyMs: Double,
    val successRate: Double,
    val totalRequests: Int,
    val todayRequests: Int,
    val remainingCredits: Double,
    val remainingPercent: Double,
    val apiKey: String? = null,
    val expiresAt: String? = null,
    val notes: String? = null
) {
    /** Display-friendly credit string like "$12.50 remaining of $100.00` */
    val creditDisplay: String
        get() = "${creditUnit.symbol}${"%.2f".format(remainingCredits)} remaining of ${creditUnit.symbol}${"%.2f".format(totalCredits)}"

    /** Health status category for UI coloring */
    val healthCategory: HealthCategory
        get() = when {
            healthScore >= 80.0 -> HealthCategory.HEALTHY
            healthScore >= 50.0 -> HealthCategory.WARNING
            else -> HealthCategory.CRITICAL
        }
}

/**
 * Aggregated bank statistics.
 */
@Serializable
data class BankStats(
    val totalAccounts: Int,
    val activeAccounts: Int,
    val healthyAccounts: Int,
    val warningAccounts: Int,
    val offlineAccounts: Int,
    val totalCreditsRemaining: Double,
    val avgCreditsRemaining: Double,
    val todayRequests: Int,
    val avgCostPerRequest: Double,
    val currentBestProvider: String? = null,
    val backupProvider: String? = null,
    val emergencyProvider: String? = null
)

/**
 * Credits breakdown per provider.
 */
@Serializable
data class ProviderCredits(
    val remaining: Double,
    val total: Double,
    val percent: Double,
    val unit: String
)

/**
 * Full status response including stats and credit breakdown.
 */
@Serializable
data class StatusResponse(
    val stats: BankStats,
    val creditsByProvider: Map<String, ProviderCredits>
)

/**
 * A secret stored in the vault.
 */
@Serializable
data class SecretEntry(
    val id: String,
    val name: String,
    val type: SecretType,
    val provider: String,
    val purpose: SecretPurpose? = null,
    val credentials: Map<String, String> = emptyMap(),
    val status: String = "active",
    val notes: String? = null,
    val expiresAt: String? = null,
    val lastUsedAt: String? = null,
    val createdAt: String
)

/**
 * Secret listing entry (credentials omitted, field names returned instead).
 */
@Serializable
data class SecretListItem(
    val id: String,
    val name: String,
    val type: SecretType,
    val provider: String,
    val purpose: SecretPurpose? = null,
    val status: String,
    val fields: List<String> = emptyList()
)

/**
 * Daily usage aggregation.
 */
@Serializable
data class DailyUsage(
    val date: String,
    val requests: Int,
    val cost: Double,
    val avgLatency: Double,
    val successRate: Double,
    val errors: Int
)

/**
 * A single usage log entry.
 */
@Serializable
data class UsageLog(
    val id: String,
    val accountId: String,
    val endpoint: String,
    val model: String? = null,
    val inputTokens: Int = 0,
    val outputTokens: Int = 0,
    val cost: Double = 0.0,
    val latencyMs: Int = 0,
    val status: UsageStatus,
    val errorMessage: String? = null,
    val createdAt: String
)

/**
 * A routing/failover event.
 */
@Serializable
data class RoutingEvent(
    val id: String,
    val sourceAccountId: String? = null,
    val targetAccountId: String? = null,
    val reason: RoutingReason,
    val provider: String? = null,
    val details: String? = null,
    val createdAt: String
)

/**
 * Health check response.
 */
@Serializable
data class HealthResponse(
    val status: String,
    val accounts: HealthAccounts,
    val credits: HealthCredits,
    val bestProvider: String? = null
)

@Serializable
data class HealthAccounts(
    val total: Int,
    val active: Int,
    val healthy: Int
)

@Serializable
data class HealthCredits(
    val remainingPercent: Double? = null
)

// ════════════════════════════════════════════════════════════════
// Request / Response Envelopes
// ════════════════════════════════════════════════════════════════

/**
 * Standard Agent API response envelope — all /api/agent calls return this.
 */
@Serializable
data class AgentResponse<T>(
    val ok: Boolean,
    val data: T? = null,
    val error: String? = null,
    val meta: ResponseMeta = ResponseMeta()
)

@Serializable
data class ResponseMeta(
    val timestamp: String? = null,
    val action: String? = null,
    val provider: String? = null
)

/**
 * Result of adding a single key.
 */
@Serializable
data class AddKeyResult(
    val id: String,
    val name: String,
    val provider: String,
    val status: String
)

/**
 * Result of bulk-adding keys.
 */
@Serializable
data class AddKeysResult(
    val created: Int,
    val accounts: List<NamedRef>
)

@Serializable
data class NamedRef(
    val id: String,
    val name: String
)

// ════════════════════════════════════════════════════════════════
// UI Helper Types
// ════════════════════════════════════════════════════════════════

enum class HealthCategory {
    HEALTHY,    // >= 80 — green
    WARNING,    // >= 50 — amber
    CRITICAL    // < 50  — red
}
