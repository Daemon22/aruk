package com.aruk.app.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.aruk.ui.components.*
import com.aruk.ui.theme.*
import com.aruk.ui.viewmodel.AnalyticsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnalyticsScreen(
    viewModel: AnalyticsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val arukColors = LocalArukColors.current

    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 12.dp),
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
                    text = "Analytics",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Last 30 days",
                    style = MaterialTheme.typography.bodySmall,
                    color = arukColors.surface.textSecondary
                )
            }
            // Toggle cost/requests
            FilterChip(
                selected = uiState.showCost,
                onClick = { viewModel.toggleShowCost() },
                label = { Text(if (uiState.showCost) "Cost" else "Requests") },
                leadingIcon = {
                    Icon(
                        if (uiState.showCost) Icons.Rounded.AttachMoney else Icons.Rounded.SwapVert,
                        null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )
        }

        if (uiState.isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = arukColors.emerald.primary)
            }
            return@Column
        }

        if (uiState.dailyUsage.isEmpty()) {
            EmptyState(
                title = "No Usage Data",
                subtitle = "Usage data will appear here once API calls are made through Aruk."
            )
            return@Column
        }

        // Summary stats
        val totalRequests = uiState.dailyUsage.sumOf { it.requests }
        val totalCost = uiState.dailyUsage.sumOf { it.cost }
        val avgSuccess = uiState.dailyUsage.map { it.successRate }.average()
        val totalErrors = uiState.dailyUsage.sumOf { it.errors }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                label = "Total Requests",
                value = totalRequests.toString(),
                modifier = Modifier.weight(1f),
                icon = { Icon(Icons.Rounded.SwapVert, null, tint = arukColors.emerald.primary, modifier = Modifier.size(20.dp)) }
            )
            StatCard(
                label = "Total Cost",
                value = "$${"%.2f".format(totalCost)}",
                modifier = Modifier.weight(1f),
                icon = { Icon(Icons.Rounded.AttachMoney, null, tint = StatusWarning, modifier = Modifier.size(20.dp)) }
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                label = "Success Rate",
                value = "%.1f".format(avgSuccess) + "%",
                modifier = Modifier.weight(1f),
                icon = { Icon(Icons.Rounded.CheckCircle, null, tint = StatusHealthy, modifier = Modifier.size(20.dp)) }
            )
            StatCard(
                label = "Errors",
                value = totalErrors.toString(),
                modifier = Modifier.weight(1f),
                icon = { Icon(Icons.Rounded.Error, null, tint = if (totalErrors == 0) StatusHealthy else StatusCritical, modifier = Modifier.size(20.dp)) }
            )
        }

        // Chart
        UsageLineChart(
            dailyUsage = uiState.dailyUsage,
            showCost = uiState.showCost,
            modifier = Modifier.fillMaxWidth()
        )
    }
}