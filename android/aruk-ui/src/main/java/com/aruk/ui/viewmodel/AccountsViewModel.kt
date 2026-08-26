package com.aruk.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aruk.core.db.*
import com.aruk.core.model.*
import com.aruk.core.network.ArukClient
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AccountsUiState(
    val accounts: List<AccountInfo> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val filterProvider: String? = null
)

@HiltViewModel
class AccountsViewModel @Inject constructor(
    private val arukClient: ArukClient,
    private val accountDao: CachedAccountDao
) : ViewModel() {

    private val _uiState = MutableStateFlow(AccountsUiState())
    val uiState: StateFlow<AccountsUiState> = _uiState.asStateFlow()

    /** Observe cached accounts for instant UI while server data loads */
    val cachedAccounts: Flow<List<AccountInfo>> = accountDao
        .getActiveFlow()
        .map { list -> list.map { it.toModel() } }

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val accounts = arukClient.listAccounts(_uiState.value.filterProvider)
                _uiState.update { it.copy(accounts = accounts, isLoading = false) }
                // Update local cache
                accountDao.upsertAll(accounts.map { it.toCached() })
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message ?: "Failed to load accounts") }
            }
        }
    }

    fun setProviderFilter(provider: String?) {
        _uiState.update { it.copy(filterProvider = provider) }
        refresh()
    }

    fun toggleAccount(accountId: String) {
        viewModelScope.launch {
            try {
                arukClient.api.toggleAccount(
                    kotlinx.serialization.json.JsonObject(
                        mapOf("id" to kotlinx.serialization.json.JsonPrimitive(accountId))
                    )
                )
                refresh()
            } catch (_: Exception) { /* handled by refresh */ }
        }
    }
}
