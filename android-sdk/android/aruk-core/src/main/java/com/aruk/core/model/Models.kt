package com.aruk.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ════════════════════════════════════════════════════════════════
// Enums — mirror the TypeScript types exactly
// ════════════════════════════════════════════════════════════════

@Serializable
enum class AccountStatus {
    @SerialName("active") ACTIVE,
    @SerialName("expired") EXPIRED,
    @SerialName("disabled") DISABLED,
    @SerialName("backup") BACKUP;

    companion object {
        fun fromValue(value: String): AccountStatus =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: ACTIVE
    }
}

@Serializable
enum class CreditUnit {
    @SerialName("USD") USD,
    @SerialName("requests") REQUESTS,
    @SerialName("tokens") TOKENS,
    @SerialName("unlimited") UNLIMITED;

    val symbol: String get() = when (this) {
        USD -> "$"
        REQUESTS -> "req"
        TOKENS -> "tok"
        UNLIMITED -> "∞"
    }

    companion object {
        fun fromValue(value: String): CreditUnit =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: USD
    }
}

@Serializable
enum class RoutingStrategy {
    @SerialName("best") BEST,
    @SerialName("fastest") FASTEST,
    @SerialName("cheapest") CHEAPEST,
    @SerialName("highest_quality") HIGHEST_QUALITY,
    @SerialName("round_robin") ROUND_ROBIN,
    @SerialName("load_balance") LOAD_BALANCE;

    val displayName: String get() = name.split("_").joinToString(" ") {
        it.replaceFirstChar { c -> c.uppercase() }
    }

    val description: String get() = when (this) {
        BEST -> "Best overall (health + credits + latency)"
        FASTEST -> "Lowest average latency"
        CHEAPEST -> "Most remaining credits"
        HIGHEST_QUALITY -> "Highest health score"
        ROUND_ROBIN -> "Rotate evenly across providers"
        LOAD_BALANCE -> "Distribute by current load"
    }

    companion object {
        fun fromValue(value: String): RoutingStrategy =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: BEST
    }
}

@Serializable
enum class SecretType {
    @SerialName("api_key") API_KEY,
    @SerialName("password") PASSWORD,
    @SerialName("oauth") OAUTH,
    @SerialName("service_account") SERVICE_ACCOUNT,
    @SerialName("token") TOKEN,
    @SerialName("certificate") CERTIFICATE,
    @SerialName("ssh_key") SSH_KEY,
    @SerialName("other") OTHER;

    val icon: String get() = when (this) {
        API_KEY -> "🔑"
        PASSWORD -> "🔒"
        OAUTH -> "🔗"
        SERVICE_ACCOUNT -> "👤"
        TOKEN -> "🎫"
        CERTIFICATE -> "📜"
        SSH_KEY -> "🖥️"
        OTHER -> "📁"
    }

    companion object {
        fun fromValue(value: String): SecretType =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: OTHER
    }
}

@Serializable
enum class SecretPurpose {
    @SerialName("cloud_storage") CLOUD_STORAGE,
    @SerialName("email") EMAIL,
    @SerialName("database") DATABASE,
    @SerialName("ai_api") AI_API,
    @SerialName("deployment") DEPLOYMENT,
    @SerialName("identity") IDENTITY,
    @SerialName("other") OTHER;

    val displayName: String get() = name.split("_").joinToString(" ") {
        it.replaceFirstChar { c -> c.uppercase() }
    }

    companion object {
        fun fromValue(value: String): SecretPurpose =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: OTHER
    }
}

@Serializable
enum class RoutingReason {
    @SerialName("failover") FAILOVER,
    @SerialName("load_balance") LOAD_BALANCE,
    @SerialName("credit_low") CREDIT_LOW,
    @SerialName("manual") MANUAL,
    @SerialName("round_robin") ROUND_ROBIN;

    companion object {
        fun fromValue(value: String): RoutingReason =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: MANUAL
    }
}

@Serializable
enum class UsageStatus {
    @SerialName("success") SUCCESS,
    @SerialName("error") ERROR,
    @SerialName("timeout") TIMEOUT;

    companion object {
        fun fromValue(value: String): UsageStatus =
            entries.firstOrNull { it.name.equals(value, ignoreCase = true) } ?: SUCCESS
    }
}