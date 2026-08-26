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
import com.aruk.ui.viewmodel.SecretsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecretsScreen(
    viewModel: SecretsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val arukColors = LocalArukColors.current

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Column {
                    Text(
                        text = "Secrets Vault",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${uiState.secrets.size} secrets stored",
                        style = MaterialTheme.typography.bodySmall,
                        color = arukColors.surface.textSecondary
                    )
                }
            },
            actions = {
                IconButton(onClick = { viewModel.refresh() }) {
                    Icon(Icons.Rounded.Refresh, contentDescription = "Refresh")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = arukColors.surface.background
            )
        )

        SecretList(
            secrets = uiState.secrets,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            isLoading = uiState.isLoading,
            onSecretClick = { secret -> viewModel.toggleExpand(secret.id) }
        )
    }
}