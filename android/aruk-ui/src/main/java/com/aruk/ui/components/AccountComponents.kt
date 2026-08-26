package com.aruk.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.aruk.core.model.*
import com.aruk.core.util.*
import com.aruk.ui.theme.*

// ════════════════════════════════════════════════════════════════
// Account Card — mirrors the web accounts-tab.tsx layout
// ════════════════════════════════════════════════════════════════

@Composable
fun AccountCard(
    account: AccountInfo,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    showApiKey: Boolean = false
) {
    val arukColors = LocalArukColors.current

    GlassCard(modifier = modifier, onClick = onClick, glow = account.status == AccountStatus.ACTIVE) {
        // Header Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Provider icon placeholder
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(arukColors.emerald.container),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Rounded.Key,
                    contentDescription = null,
                    tint = arukColors.emerald.primary,
                    modifier = Modifier.size(20.dp)
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = account.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = arukColors.surface.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = account.providerName,
                    style = MaterialTheme.typography.bodySmall,
                    color = arukColors.surface.textSecondary
                )
            }
            StatusChip(status = account.status)
        }

        Spacer(Modifier.height(16.dp))

        // Credit Progress Bar (read-only, bank-balance style)
        CreditProgressBar(
            remainingPercent = account.remainingPercent,
            unit = account.creditUnit,
            remaining = account.remainingCredits,
            total = account.totalCredits
        )

        Spacer(Modifier.height(12.dp))

        // Metrics Grid (2x2)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            MetricItem(
                label = "Health",
                value = "%.0f".format(account.healthScore),
                color = account.healthCategory.toColor()
            )
            MetricItem(
                label = "Latency",
                value = "${"%.0f".format(account.avgLatencyMs)}ms",
                color = if (account.avgLatencyMs < 2000) StatusHealthy else StatusWarning
            )
            MetricItem(
                label = "Success",
                value = account.successRate.formatPercent(),
                color = if (account.successRate >= 95) StatusHealthy else StatusWarning
            )
            MetricItem(
                label = "Priority",
                value = account.priority.toString(),
                color = arukColors.surface.textSecondary
            )
        }

        // Request counts
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Today: ${account.todayRequests.formatCount()}",
                style = MaterialTheme.typography.labelSmall,
                color = arukColors.surface.textMuted
            )
            Text(
                text = "Total: ${account.totalRequests.formatCount()}",
                style = MaterialTheme.typography.labelSmall,
                color = arukColors.surface.textMuted
            )
        }

        // Masked API key
        if (showApiKey && account.apiKey != null) {
            Spacer(Modifier.height(8.dp))
            Surface(
                color = arukColors.surface.hover,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = maskApiKey(account.apiKey!!),
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = arukColors.surface.textMuted,
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                )
            }
        }
    }
}

@Composable
private fun RowScope.MetricItem(label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Column(
        modifier = Modifier.weight(1f),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            color = color
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = LocalArukColors.current.surface.textMuted
        )
    }
}

private fun maskApiKey(key: String): String {
    return if (key.length > 12) {
        key.take(6) + "..." + key.takeLast(4)
    } else {
        key
    }
}

private fun HealthCategory.toColor() = when (this) {
    HealthCategory.HEALTHY -> StatusHealthy
    HealthCategory.WARNING -> StatusWarning
    HealthCategory.CRITICAL -> StatusCritical
}

// ════════════════════════════════════════════════════════════════
// Account List
// ════════════════════════════════════════════════════════════════

@Composable
fun AccountList(
    accounts: List<AccountInfo>,
    modifier: Modifier = Modifier,
    onAccountClick: ((AccountInfo) -> Unit)? = null,
    isLoading: Boolean = false,
    emptyTitle: String = "No Accounts",
    emptySubtitle: String = "Add your first API key to get started",
    onEmptyAction: (() -> Unit)? = null,
    emptyActionLabel: String = "Add Key"
) {
    if (isLoading) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = LocalArukColors.current.emerald.primary)
        }
        return
    }

    if (accounts.isEmpty()) {
        EmptyState(
            title = emptyTitle,
            subtitle = emptySubtitle,
            modifier = modifier,
            icon = {
                Icon(
                    imageVector = Icons.Rounded.KeyOff,
                    contentDescription = null,
                    tint = LocalArukColors.current.surface.textMuted,
                    modifier = Modifier.size(48.dp)
                )
            },
            actionLabel = if (onEmptyAction != null) emptyActionLabel else null,
            onAction = onEmptyAction
        )
        return
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(accounts, key = { it.id }) { account ->
            AccountCard(
                account = account,
                onClick = onAccountClick?.let { { it(account) } }
            )
        }
    }
}
