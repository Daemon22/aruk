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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aruk.core.network.ArukConfig
import com.aruk.ui.components.*
import com.aruk.ui.theme.*


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen() {
    val arukColors = LocalArukColors.current
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    val appVersion = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "0.2.0"
    } catch (_: Exception) { "0.2.0" }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Settings",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = arukColors.surface.textPrimary
        )

        // Server Connection
        SectionHeader(title = "Server Connection")
        GlassCard(padding = 0.dp) {
            SettingsRow(
                icon = Icons.Rounded.Dns,
                title = "Server URL",
                subtitle = ArukConfig().baseUrl,
                onClick = { /* future: open URL dialog */ }
            )
            HorizontalDivider(color = arukColors.surface.border)
            SettingsRow(
                icon = Icons.Rounded.Security,
                title = "Auth Token",
                subtitle = if (ArukConfig().authToken != null) "Configured" else "Not set",
                onClick = { /* future: open token dialog */ }
            )
            HorizontalDivider(color = arukColors.surface.border)
            SettingsRow(
                icon = Icons.Rounded.Sync,
                title = "Auto-Refresh",
                subtitle = "Every 30 seconds",
                onClick = { }
            )
        }

        // Appearance
        SectionHeader(title = "Appearance")
        GlassCard(padding = 0.dp) {
            var isDark by remember { mutableStateOf(true) }
            SettingsRow(
                icon = Icons.Rounded.DarkMode,
                title = "Dark Mode",
                subtitle = if (isDark) "On" else "Off",
                onClick = { isDark = !isDark },
                trailing = {
                    Switch(
                        checked = isDark,
                        onCheckedChange = { isDark = it },
                        colors = SwitchDefaults.colors(
                            checkedTrackColor = arukColors.emerald.primary,
                            checkedThumbColor = arukColors.emerald.onPrimary
                        )
                    )
                }
            )
        }

        // Data
        SectionHeader(title = "Data")
        GlassCard(padding = 0.dp) {
            SettingsRow(
                icon = Icons.Rounded.Cached,
                title = "Clear Local Cache",
                subtitle = "Remove cached accounts and secrets",
                onClick = { /* future: clear cache */ }
            )
        }

        // About
        SectionHeader(title = "About")
        GlassCard(padding = 16.dp) {
            Row(verticalAlignment = Alignment.CenterVertically) {
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
                Column {
                    Text("Aruk", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text("Keeper of Secrets and Keys", style = MaterialTheme.typography.bodySmall, color = arukColors.surface.textSecondary)
                }
            }
            Spacer(Modifier.height(12.dp))
            DetailRow("Version", "v$appVersion")
            DetailRow("Build", "Android SDK + Jetpack Compose")
            DetailRow("License", "MIT")
        }

        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun SettingsRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    trailing: @Composable (() -> Unit)? = null
) {
    val arukColors = LocalArukColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = arukColors.emerald.primary, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium, color = arukColors.surface.textPrimary)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = arukColors.surface.textSecondary)
        }
        if (trailing != null) {
            trailing()
        } else {
            Icon(Icons.Rounded.ChevronRight, null, tint = arukColors.surface.textMuted, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    val arukColors = LocalArukColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = arukColors.surface.textMuted)
        Text(value, style = MaterialTheme.typography.bodySmall, color = arukColors.surface.textPrimary)
    }
}
