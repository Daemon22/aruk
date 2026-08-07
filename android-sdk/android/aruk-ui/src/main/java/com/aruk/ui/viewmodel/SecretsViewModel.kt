package com.aruk.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aruk.core.db.CachedSecretDao
import com.aruk.core.model.*
import com.aruk.core.network.ArukClient
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SecretsUiState(
    val secrets: List<SecretEntry> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val filterPurpose: SecretPurpose? = null,
    val filterProvider: String? = null,
    val expandedSecretId: String? = null
)

@HiltViewModel
class SecretsViewModel @Inject constructor(
    private val arukClient: ArukClient,
    private val secretDao: CachedSecretDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(SecretsUiState())
    val uiState: StateFlow<SecretsUiState> = _uiState.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val secrets = arukClient.listSecretsFull(
                    purpose = _uiState.value.filterPurpose,
                    provider = _uiState.value.filterProvider
                )
                _uiState.update { it.copy(secrets = secrets, isLoading = false) }
                secretDao.upsertAll(secrets.map { it.toCached() })
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Failed to load secrets") }
            }
        }
    }

    fun setPurposeFilter(purpose: SecretPurpose?) {
        _uiState.update { it.copy(filterPurpose = purpose) }
        refresh()
    }

    fun setProviderFilter(provider: String?) {
        _uiState.update { it.copy(filterProvider = provider) }
        refresh()
    }

    fun toggleExpand(secretId: String?) {
        _uiState.update { it.copy(expandedSecretId = if (it.expandedSecretId == secretId) null else secretId) }
    }

    fun deleteSecret(id: String) {
        viewModelScope.launch {
            try {
                arukClient.deleteSecret(id)
                secretDao.delete(id)
                refresh()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message) }
            }
        }
    }
}