package com.aruk.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aruk.core.model.*
import com.aruk.core.network.ArukClient
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val stats: BankStats? = null,
    val creditsByProvider: Map<String, ProviderCredits> = emptyMap(),
    val healthStatus: String? = null,
    val bestProvider: String? = null,
    val isOnline: Boolean = false,
    val isLoading: Boolean = true,
    val error: String? = null
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val arukClient: ArukClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        refresh()
        // Auto-refresh every 30s
        viewModelScope.launch {
            while (true) {
                kotlinx.coroutines.delay(30_000)
                refresh()
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            // Check connectivity
            _uiState.update { it.copy(isOnline = try { arukClient.ping() } catch (_: Exception) { false }) }

            try {
                val status = arukClient.getStatus()
                _uiState.update {
                    it.copy(
                        stats = status.stats,
                        creditsByProvider = status.creditsByProvider,
                        isLoading = false,
                        error = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }

            // Health
            try {
                val health = arukClient.health()
                _uiState.update {
                    it.copy(healthStatus = health.status, bestProvider = health.bestProvider)
                }
            } catch (_: Exception) {}
        }
    }
}
