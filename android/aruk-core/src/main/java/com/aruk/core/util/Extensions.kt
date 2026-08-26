package com.aruk.core.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

// ════════════════════════════════════════════════════════════════
// Network Connectivity
// ════════════════════════════════════════════════════════════════

@Singleton
class NetworkMonitor @Inject constructor(
    @ApplicationContext private val context: Context
) {
    val isOnline: Boolean
        get() {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = cm.activeNetwork ?: return false
            val caps = cm.getNetworkCapabilities(network) ?: return false
            return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                   caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        }
}

// ════════════════════════════════════════════════════════════════
// Number Formatting
// ════════════════════════════════════════════════════════════════

fun Double.formatCredits(): String = when {
    this >= 1_000_000 -> "${"%.1f".format(this / 1_000_000)}M"
    this >= 1_000 -> "${"%.1f".format(this / 1_000)}K"
    this >= 1.0 -> "${"%.2f".format(this)}"
    this >= 0.01 -> "${"%.3f".format(this)}"
    else -> "${"%.4f".format(this)}"
}

fun Int.formatCount(): String = when {
    this >= 1_000_000 -> "${"%.1f".format(this / 1_000_000.0)}M"
    this >= 1_000 -> "${"%.1f".format(this / 1_000.0)}K"
    else -> toString()
}

fun Double.formatPercent(): String = "${"%.1f".format(this)}%"

fun Int.formatLatency(): String = when {
    this >= 60_000 -> "${this / 60_000}m ${"%ds".format((this % 60_000) / 1000)}"
    this >= 1_000 -> "${"%.1f".format(this / 1000.0)}s"
    else -> "${this}ms"
}

// ════════════════════════════════════════════════════════════════
// Time Parsing
// ════════════════════════════════════════════════════════════════

fun String.parseIsoDate(): java.time.Instant? = try {
    java.time.Instant.parse(this)
} catch (_: Exception) {
    null
}

fun String.toRelativeTime(): String {
    val instant = parseIsoDate() ?: return this
    val now = java.time.Instant.now()
    val seconds = java.time.Duration.between(instant, now).seconds
    return when {
        seconds < 60 -> "just now"
        seconds < 3_600 -> "${seconds / 60}m ago"
        seconds < 86_400 -> "${seconds / 3_600}h ago"
        seconds < 2_592_000 -> "${seconds / 86_400}d ago"
        else -> instant.atZone(java.time.ZoneOffset.systemDefault()).toLocalDate().toString()
    }
}