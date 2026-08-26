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
import com.aruk.core.model.*
import com.aruk.core.network.ArukClient
import com.aruk.ui.components.*
import com.aruk.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RoutingUiState(
    val decision: RoutingDecision? = null,
    val failoverChain: List<AccountInfo> = emptyList(),
    val selectedStrategy: RoutingStrategy = RoutingStrategy.BEST,
    val selectedProvider: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class RoutingViewModel @Inject constructor(
    private val arukClient: ArukClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(RoutingUiState())
    val uiState: StateFlow<RoutingUiState> = _uiState.asStateFlow()

    fun selectStrategy(strategy: RoutingStrategy) {
        _uiState.update { it.copy(selectedStrategy = strategy) }
    }

    fun selectProvider(provider: String?) {
        _uiState.update { it.copy(selectedProvider = provider) }
    }

    fun requestKey() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val decision = arukClient.getKey(
                    strategy = _uiState.value.selectedStrategy,
                    provider = _uiState.value.selectedProvider
                )
                _uiState.update { it.copy(decision = decision, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun loadFailoverChain() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val chain = arukClient.getFailoverChain()
                _uiState.update { it.copy(failoverChain = chain, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoutingScreen(
    viewModel: RoutingViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val arukColors = LocalArukColors.current
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Text(
            text = "Smart Routing",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = arukColors.surface.textPrimary
        )
        Text(
            text = "Test key routing with different strategies",
            style = MaterialTheme.typography.bodyMedium,
            color = arukColors.surface.textSecondary
        )

        // Strategy selector
        GlassCard(padding = 16.dp) {
            Text(
                text = "Strategy",
                style = MaterialTheme.typography.labelLarge,
                color = arukColors.surface.textSecondary
            )
            Spacer(Modifier.height(8.dp))
            RoutingStrategy.entries.forEach { strategy ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = uiState.selectedStrategy == strategy,
                        onClick = { viewModel.selectStrategy(strategy) },
                        colors = RadioButtonDefaults.colors(
                            selectedColor = arukColors.emerald.primary,
                            unselectedColor = arukColors.surface.textMuted
                        )
                    )
                    Spacer(Modifier.width(8.dp))
                    Column {
                        Text(
                            text = strategy.displayName,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            color = arukColors.surface.textPrimary
                        )
                        Text(
                            text = strategy.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = arukColors.surface.textMuted
                        )
                    }
                }
            }
        }

        // Get Key button
        EmeraldButton(
            text = "Get Best Key",
            onClick = { viewModel.requestKey() },
            modifier = Modifier.fillMaxWidth(),
            isLoading = uiState.isLoading,
            icon = { Icon(Icons.Rounded.Key, null, modifier = Modifier.size(18.dp)) }
        )

        // Result
        if (uiState.decision != null) {
            val d = uiState.decision!!
            GlassCard(glow = true, padding = 16.dp) {
                Text(
                    text = "Routing Decision",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = arukColors.emerald.primary
                )
                Spacer(Modifier.height(12.dp))
                RoutingDetailRow("Account", d.accountName)
                RoutingDetailRow("Provider", d.providerName)
                RoutingDetailRow("Strategy", d.strategy.displayName)
                RoutingDetailRow("Reason", d.reason)
                RoutingDetailRow("Health", "%.0f".format(d.healthScore))
                RoutingDetailRow("Credits", d.remainingPercent.toString() + "% remaining")
            }
        }

        // Error
        if (uiState.error != null) {
            GlassCard(padding = 16.dp) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Error, null, tint = StatusCritical, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(uiState.error!!, style = MaterialTheme.typography.bodySmall, color = StatusCritical)
                }
            }
        }

        // Failover chain section
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Failover Chain",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            TextButton(onClick = { viewModel.loadFailoverChain() }) {
                Text("Load", color = arukColors.emerald.primary)
            }
        }

        if (uiState.failoverChain.isNotEmpty()) {
            uiState.failoverChain.forEachIndexed { index, account ->
                GlassCard(padding = 14.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Step number
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (index == 0) arukColors.emerald.primary
                                    else arukColors.surface.border
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "${index + 1}",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = if (index == 0) Color.White else arukColors.surface.textSecondary
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(account.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                            Text(account.providerName, style = MaterialTheme.typography.bodySmall, color = arukColors.surface.textSecondary)
                        }
                        HealthBadge(score = account.healthScore)
                    }
                }
            }
        }
    }
}

@Composable
private fun RoutingDetailRow(label: String, value: String) {
    val arukColors = LocalArukColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = arukColors.surface.textMuted)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium, color = arukColors.surface.textPrimary)
    }
}

@Composable
private fun EmeraldButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    icon: @Composable (() -> Unit)? = null,
    enabled: Boolean = true
) {
    val arukColors = LocalArukColors.current
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled && !isLoading,
        colors = ButtonDefaults.buttonColors(
            containerColor = arukColors.emerald.primary,
            contentColor = arukColors.emerald.onPrimary
        ),
        shape = RoundedCornerShape(10.dp)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                color = arukColors.emerald.onPrimary,
                strokeWidth = 2.dp
            )
        } else if (icon != null) {
            icon()
        }
        Spacer(Modifier.width(8.dp))
        Text(text, fontWeight = FontWeight.Medium)
    }
}
