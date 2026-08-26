package com.aruk.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.aruk.core.model.*
import com.aruk.core.util.*
import com.aruk.ui.theme.*
import kotlinx.coroutines.delay

// ════════════════════════════════════════════════════════════════
// Glass Card — Core glassmorphism component
// ════════════════════════════════════════════════════════════════

/**
 * Glassmorphism card matching the web UI's `bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]`
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    padding: Dp = 20.dp,
    cornerRadius: Dp = 16.dp,
    onClick: (() -> Unit)? = null,
    glow: Boolean = false,
    content: @Composable ColumnScope.() -> Unit
) {
    val arukColors = LocalArukColors.current
    val interaction = remember { MutableInteractionSource() }
    val isPressed by interaction.collectIsPressedAsState()

    Card(
        modifier = modifier
            .then(if (onClick != null) Modifier.clickable(interactionSource = interaction) { onClick() } else Modifier)
            .background(
                color = arukColors.glass.background,
                shape = RoundedCornerShape(cornerRadius)
            )
            .border(
                width = 1.dp,
                color = arukColors.glass.border,
                shape = RoundedCornerShape(cornerRadius)
            ),
        shape = RoundedCornerShape(cornerRadius),
        colors = CardDefaults.cardColors(
            containerColor = Color.Transparent,
            contentColor = arukColors.surface.textPrimary
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        if (glow) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                arukColors.emerald.glow,
                                Color.Transparent
                            )
                        )
                    )
            )
        }
        Column(
            modifier = Modifier
                .padding(padding)
                .alpha(if (isPressed) 0.9f else 1f),
            content = content
        )
    }
}

// ════════════════════════════════════════════════════════════════
// Stat Card — matches web's stat-block pattern
// ════════════════════════════════════════════════════════════════

@Composable
fun StatCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    icon: @Composable (() -> Unit)? = null,
    trend: Trend? = null
) {
    val arukColors = LocalArukColors.current

    GlassCard(modifier = modifier, padding = 16.dp) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = arukColors.surface.textSecondary
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = value,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = arukColors.surface.textPrimary
                )
                if (subtitle != null) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = arukColors.surface.textMuted
                    )
                }
                if (trend != null) {
                    Spacer(Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = trend.value,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (trend.isPositive) StatusHealthy else StatusCritical,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
            if (icon != null) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(arukColors.emerald.container),
                    contentAlignment = Alignment.Center
                ) {
                    icon()
                }
            }
        }
    }
}

data class Trend(val value: String, val isPositive: Boolean)

// ════════════════════════════════════════════════════════════════
// Health Badge — colored dot + label
// ════════════════════════════════════════════════════════════════

@Composable
fun HealthBadge(
    score: Double,
    modifier: Modifier = Modifier
) {
    val category = when {
        score >= 80.0 -> Triple("Healthy", StatusHealthy, StatusHealthy.copy(alpha = 0.15f))
        score >= 50.0 -> Triple("Warning", StatusWarning, StatusWarning.copy(alpha = 0.15f))
        else -> Triple("Critical", StatusCritical, StatusCritical.copy(alpha = 0.15f))
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(100.dp))
            .background(category.third)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(category.second)
        )
        Text(
            text = "${category.first} ${"%.0f".format(score)}",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            color = category.second
        )
    }
}

// ════════════════════════════════════════════════════════════════
// Credit Progress Bar
// ════════════════════════════════════════════════════════════════

@Composable
fun CreditProgressBar(
    remainingPercent: Double,
    unit: CreditUnit,
    modifier: Modifier = Modifier,
    remaining: Double = 0.0,
    total: Double = 0.0,
    showLabel: Boolean = true
) {
    val arukColors = LocalArukColors.current
    val color = when {
        remainingPercent >= 50.0 -> StatusHealthy
        remainingPercent >= 20.0 -> StatusWarning
        else -> StatusCritical
    }

    Column(modifier = modifier) {
        if (showLabel) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${unit.symbol}${remaining.formatCredits()} remaining",
                    style = MaterialTheme.typography.labelSmall,
                    color = arukColors.surface.textSecondary
                )
                Text(
                    text = remainingPercent.formatPercent(),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = color
                )
            }
            Spacer(Modifier.height(6.dp))
        }
        LinearProgressIndicator(
            progress = { remainingPercent / 100f },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color = color,
            trackColor = arukColors.surface.border,
            gapSize = 0.dp
        )
    }
}

// ════════════════════════════════════════════════════════════════
// Emerald Button
// ════════════════════════════════════════════════════════════════

@Composable
fun EmeraldButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: @Composable (() -> Unit)? = null
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(
            containerColor = LocalArukColors.current.emerald.primary,
            contentColor = LocalArukColors.current.emerald.onPrimary,
            disabledContainerColor = LocalArukColors.current.emerald.primary.copy(alpha = 0.3f),
            disabledContentColor = LocalArukColors.current.emerald.onPrimary.copy(alpha = 0.5f)
        ),
        shape = RoundedCornerShape(10.dp),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp)
    ) {
        if (icon != null) {
            icon()
            Spacer(Modifier.width(8.dp))
        }
        Text(text = text, fontWeight = FontWeight.Medium)
    }
}

// ════════════════════════════════════════════════════════════════
// Pulsing Emerald Dot (loading / live indicator)
// ════════════════════════════════════════════════════════════════

@Composable
fun PulsingEmeraldDot(
    modifier: Modifier = Modifier,
    size: Dp = 8.dp
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 0.3f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = EaseInOut),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(LocalArukColors.current.emerald.primary.copy(alpha = alpha))
    )
}

// ════════════════════════════════════════════════════════════════
// Status Chip (for account list items)
// ════════════════════════════════════════════════════════════════

@Composable
fun StatusChip(
    status: AccountStatus,
    modifier: Modifier = Modifier
) {
    val (text, color) = when (status) {
        AccountStatus.ACTIVE -> "Active" to StatusHealthy
        AccountStatus.EXPIRED -> "Expired" to StatusCritical
        AccountStatus.DISABLED -> "Disabled" to StatusInactive
        AccountStatus.BACKUP -> "Backup" to StatusWarning
    }

    Surface(
        modifier = modifier,
        color = color.copy(alpha = 0.12f),
        shape = RoundedCornerShape(100.dp)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            color = color
        )
    }
}

// ════════════════════════════════════════════════════════════════
// Empty State
// ════════════════════════════════════════════════════════════════

@Composable
fun EmptyState(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    icon: @Composable (() -> Unit)? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (icon != null) {
            icon()
            Spacer(Modifier.height(16.dp))
        }
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = LocalArukColors.current.surface.textPrimary
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = LocalArukColors.current.surface.textSecondary,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(20.dp))
            EmeraldButton(text = actionLabel, onClick = onAction)
        }
    }
}

// ════════════════════════════════════════════════════════════════
// Section Header
// ════════════════════════════════════════════════════════════════

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    action: String? = null,
    onAction: (() -> Unit)? = null
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = LocalArukColors.current.surface.textPrimary
        )
        if (action != null && onAction != null) {
            TextButton(onClick = onAction) {
                Text(
                    text = action,
                    color = LocalArukColors.current.emerald.primary,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}