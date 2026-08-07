package com.aruk.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aruk.core.model.*
import com.aruk.core.network.ArukClient
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AnalyticsUiState(
    val dailyUsage: List<DailyUsage> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val showCost: Boolean = false
)

@HiltViewModel
class AnalyticsViewModel @Inject constructor(
    private val arukClient: ArukClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(AnalyticsUiState())
    val uiState: StateFlow<AnalyticsUiState> = _uiState.asStateFlow()

    init { loadDailyUsage() }

    private fun loadDailyUsage() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val usage = arukClient.api.getDailyUsage(days = 30)
                _uiState.update { it.copy(dailyUsage = usage, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun toggleShowCost() {
        _uiState.update { it.copy(showCost = !it.showCost) }
    }
}
