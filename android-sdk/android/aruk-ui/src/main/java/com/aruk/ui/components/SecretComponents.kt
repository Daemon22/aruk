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
// Secret Card
// ════════════════════════════════════════════════════════════════

@Composable
fun SecretCard(
    secret: SecretEntry,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    showCredentials: Boolean = false
) {
    val arukColors = LocalArukColors.current

    GlassCard(modifier = modifier, onClick = onClick) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(arukColors.emerald.container),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = secret.type.icon,
                    fontSize = MaterialTheme.typography.titleMedium.fontSize
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = secret.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = arukColors.surface.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = secret.provider,
                        style = MaterialTheme.typography.bodySmall,
                        color = arukColors.surface.textSecondary
                    )
                    if (secret.purpose != null) {
                        Surface(
                            color = arukColors.surface.border,
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = secret.purpose.displayName,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = arukColors.surface.textSecondary,
                                fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.85f
                            )
                        }
                    }
                }
            }
            // Status indicator
            Surface(
                color = when (secret.status) {
                    "active" -> StatusHealthy.copy(alpha = 0.12f)
                    "disabled" -> StatusInactive.copy(alpha = 0.12f)
                    "expired" -> StatusCritical.copy(alpha = 0.12f)
                    else -> StatusInactive.copy(alpha = 0.12f)
                },
                shape = RoundedCornerShape(100.dp)
            ) {
                Text(
                    text = secret.status.replaceFirstChar { it.uppercase() },
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = when (secret.status) {
                        "active" -> StatusHealthy
                        "disabled" -> StatusInactive
                        "expired" -> StatusCritical
                        else -> StatusInactive
                    }
                )
            }
        }

        // Credential fields (if revealed)
        if (showCredentials && secret.credentials.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                secret.credentials.forEach { (key, value) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = key,
                            style = MaterialTheme.typography.labelSmall,
                            color = arukColors.surface.textMuted
                        )
                        Text(
                            text = maskValue(value),
                            style = MaterialTheme.typography.labelSmall,
                            color = arukColors.surface.textSecondary,
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                        )
                    }
                }
            }
        }

        // Notes
        if (secret.notes != null) {
            Spacer(Modifier.height(8.dp))
            Text(
                text = secret.notes,
                style = MaterialTheme.typography.bodySmall,
                color = arukColors.surface.textMuted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }

        // Footer
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = secret.createdAt.toRelativeTime(),
                style = MaterialTheme.typography.labelSmall,
                color = arukColors.surface.textMuted
            )
            if (secret.expiresAt != null) {
                val isExpired = try {
                    java.time.Instant.parse(secret.expiresAt).isBefore(java.time.Instant.now())
                } catch (_: Exception) { false }
                Text(
                    text = if (isExpired) "Expired" else "Exp: ${secret.expiresAt?.toRelativeTime()}",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isExpired) StatusCritical else arukColors.surface.textMuted
                )
            }
        }
    }
}

private fun maskValue(value: String): String =
    if (value.length > 8) "${value.take(4)}${"\u2022".repeat(8)}${value.takeLast(4)}"
    else "${"\u2022".repeat(value.length)}"

// ════════════════════════════════════════════════════════════════
// Secret List
// ════════════════════════════════════════════════════════════════

@Composable
fun SecretList(
    secrets: List<SecretEntry>,
    modifier: Modifier = Modifier,
    onSecretClick: ((SecretEntry) -> Unit)? = null,
    isLoading: Boolean = false,
    emptyTitle: String = "No Secrets",
    emptySubtitle: String = "Your vault is empty. Add a secret to store it securely."
) {
    if (isLoading) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = LocalArukColors.current.emerald.primary)
        }
        return
    }

    if (secrets.isEmpty()) {
        EmptyState(
            title = emptyTitle,
            subtitle = emptySubtitle,
            modifier = modifier,
            icon = {
                Icon(
                    imageVector = Icons.Rounded.Lock,
                    contentDescription = null,
                    tint = LocalArukColors.current.surface.textMuted,
                    modifier = Modifier.size(48.dp)
                )
            }
        )
        return
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(secrets, key = { it.id }) { secret ->
            SecretCard(
                secret = secret,
                onClick = onSecretClick?.let { { it(secret) } }
            )
        }
    }
}