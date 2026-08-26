package com.aruk.app.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.aruk.core.util.*
import com.aruk.ui.components.*
import com.aruk.ui.theme.*
import com.aruk.ui.viewmodel.DashboardUiState
import com.aruk.ui.viewmodel.DashboardViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val arukColors = LocalArukColors.current
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "Aruk",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = arukColors.emerald.primary
                )
                Text(
                    text = "Keeper of Secrets and Keys",
                    style = MaterialTheme.typography.bodySmall,
                    color = arukColors.surface.textSecondary
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                PulsingEmeraldDot()
                Spacer(Modifier.width(8.dp))
                Text(
                    text = if (uiState.isOnline) "Connected" else "Offline",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (uiState.isOnline) StatusHealthy else StatusCritical,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        // Loading state
        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxWidth().height(300.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = arukColors.emerald.primary)
            }
            return@Column
        }

        // Error state
        if (uiState.error != null && uiState.stats == null) {
            EmptyState(
                title = "Connection Error",
                subtitle = uiState.error ?: "Cannot reach Aruk server",
                icon = {
                    Icon(Icons.Rounded.CloudOff, null, tint = arukColors.surface.textMuted, modifier = Modifier.size(48.dp))
                },
                actionLabel = "Retry",
                onAction = { viewModel.refresh() }
            )
            return@Column
        }

        val stats = uiState.stats ?: return@Column

        // Stat cards — 2x3 grid
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                label = "Total Accounts",
                value = stats.totalAccounts.toString(),
                subtitle = "${stats.activeAccounts} active",
                icon = { Icon(Icons.Rounded.Key, null, tint = arukColors.emerald.primary, modifier = Modifier.size(20.dp)) },
                modifier = Modifier.weight(1f)
            )
            StatCard(
                label = "Healthy",
                value = stats.healthyAccounts.toString(),
                subtitle = "${stats.warningAccounts} warning",
                icon = { Icon(Icons.Rounded.HealthAndSafety, null, tint = StatusHealthy, modifier = Modifier.size(20.dp)) },
                modifier = Modifier.weight(1f)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                label = "Today's Requests",
                value = stats.todayRequests.formatCount(),
                subtitle = "Avg $${"%.4f".format(stats.avgCostPerRequest)}/req",
                icon = { Icon(Icons.Rounded.SwapVert, null, tint = arukColors.emerald.primary, modifier = Modifier.size(20.dp)) },
                modifier = Modifier.weight(1f)
            )
            StatCard(
                label = "Credits Left",
                value = "$${stats.totalCreditsRemaining.formatCredits()}",
                subtitle = "Avg ${"%.1f".format(stats.avgCreditsRemaining)}% remaining",
                icon = { Icon(Icons.Rounded.AccountBalanceWallet, null, tint = StatusWarning, modifier = Modifier.size(20.dp)) },
                modifier = Modifier.weight(1f)
            )
        }

        // Provider credits breakdown
        if (uiState.creditsByProvider.isNotEmpty()) {
            SectionHeader(title = "Credits by Provider")
            uiState.creditsByProvider.forEach { (provider, credits) ->
                GlassCard(padding = 14.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = provider,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Medium,
                            color = arukColors.surface.textPrimary
                        )
                        Text(
                            text = credits.percent.formatPercent(),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = when {
                                credits.percent >= 50 -> StatusHealthy
                                credits.percent >= 20 -> StatusWarning
                                else -> StatusCritical
                            }
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    CreditProgressBar(
                        remainingPercent = credits.percent,
                        unit = CreditUnit.fromValue(credits.unit),
                        remaining = credits.remaining,
                        total = credits.total,
                        showLabel = true
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))
    }
}
