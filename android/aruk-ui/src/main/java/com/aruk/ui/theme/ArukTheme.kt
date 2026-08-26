package com.aruk.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp

// ════════════════════════════════════════════════════════════════
// Emerald Brand Colors (oklch-matched from Web)
// ════════════════════════════════════════════════════════════════

// --- Emerald Palette ---
val Emerald50  = Color(0xFFECFDF5)
val Emerald100 = Color(0xFFD1FAE5)
val Emerald200 = Color(0xFFA7F3D0)
val Emerald300 = Color(0xFF6EE7B7)
val Emerald400 = Color(0xFF34D399)
val Emerald500 = Color(0xFF10B981)
val Emerald600 = Color(0xFF059669)
val Emerald700 = Color(0xFF047857)
val Emerald800 = Color(0xFF065F46)
val Emerald900 = Color(0xFF064E3B)
val Emerald950 = Color(0xFF022C22)

// --- Surface Colors ---
val SurfaceDark   = Color(0xFF0C0F14)
val SurfaceCard   = Color(0xFF151922)
val SurfaceHover  = Color(0xFF1C2230)
val SurfaceLight  = Color(0xFFF8FAFC)
val SurfaceCardLight = Color(0xFFFFFFFF)
val SurfaceHoverLight = Color(0xFFF1F5F9)

// --- Text Colors ---
val TextPrimary   = Color(0xFFF1F5F9)
val TextSecondary = Color(0xFF94A3B8)
val TextMuted     = Color(0xFF475569)
val TextPrimaryDark  = Color(0xFF0F172A)
val TextSecondaryDark = Color(0xFF475569)

// --- Status Colors ---
val StatusHealthy  = Color(0xFF10B981) // emerald
val StatusWarning  = Color(0xFFF59E0B) // amber
val StatusCritical = Color(0xFFEF4444) // red
val StatusInactive = Color(0xFF6B7280) // gray

// ════════════════════════════════════════════════════════════════
// Extended Color Scheme
// ════════════════════════════════════════════════════════════════

@Immutable
data class ArukColors(
    val emerald: EmeraldPalette,
    val surface: SurfacePalette,
    val status: StatusPalette,
    val glass: GlassPalette
)

@Immutable
data class EmeraldPalette(
    val primary: Color = Emerald500,
    val onPrimary: Color = Color.White,
    val container: Color = Emerald950,
    val onContainer: Color = Emerald100,
    val accent: Color = Emerald400,
    val glow: Color = Color(0x2A10B981) // 16% emerald for glow effects
)

@Immutable
data class SurfacePalette(
    val background: Color,
    val card: Color,
    val hover: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val border: Color
)

@Immutable
data class StatusPalette(
    val healthy: Color = StatusHealthy,
    val warning: Color = StatusWarning,
    val critical: Color = StatusCritical,
    val inactive: Color = StatusInactive
)

@Immutable
data class GlassPalette(
    val background: Color,
    val border: Color,
    val blur: Float = 20f,
    val opacity: Float = 0.6f
)

val LocalArukColors = staticCompositionLocalOf { lightArukColors() }

fun lightArukColors() = ArukColors(
    emerald = EmeraldPalette(
        container = Emerald50,
        onContainer = Emerald900
    ),
    surface = SurfacePalette(
        background = SurfaceLight,
        card = SurfaceCardLight,
        hover = SurfaceHoverLight,
        textPrimary = TextPrimaryDark,
        textSecondary = TextSecondaryDark,
        textMuted = TextSecondaryDark.copy(alpha = 0.6f),
        border = Color(0xFFE2E8F0)
    ),
    glass = GlassPalette(
        background = Color(0xE6FFFFFF),
        border = Color(0x33CBD5E1)
    )
)

fun darkArukColors() = ArukColors(
    emerald = EmeraldPalette(),
    surface = SurfacePalette(
        background = SurfaceDark,
        card = SurfaceCard,
        hover = SurfaceHover,
        textPrimary = TextPrimary,
        textSecondary = TextSecondary,
        textMuted = TextMuted,
        border = Color(0xFF1E293B)
    ),
    glass = GlassPalette(
        background = Color(0x99151922),
        border = Color(0x332D3748)
    )
)

// ════════════════════════════════════════════════════════════════
// Theme
// ════════════════════════════════════════════════════════════════

@Composable
fun ArukTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // We use our own emerald brand
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) darkArukColors() else lightArukColors()

    val colorScheme = if (darkTheme) {
        darkColorScheme(
            primary = colors.emerald.primary,
            onPrimary = colors.emerald.onPrimary,
            primaryContainer = colors.emerald.container,
            onPrimaryContainer = colors.emerald.onContainer,
            secondary = Emerald400,
            background = colors.surface.background,
            surface = colors.surface.card,
            onBackground = colors.surface.textPrimary,
            onSurface = colors.surface.textPrimary,
            outline = colors.surface.border
        )
    } else {
        lightColorScheme(
            primary = colors.emerald.primary,
            onPrimary = colors.emerald.onPrimary,
            primaryContainer = colors.emerald.container,
            onPrimaryContainer = colors.emerald.onContainer,
            secondary = Emerald600,
            background = colors.surface.background,
            surface = colors.surface.card,
            onBackground = colors.surface.textPrimary,
            onSurface = colors.surface.textPrimary,
            outline = colors.surface.border
        )
    }

    CompositionLocalProvider(LocalArukColors provides colors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = ArukTypography,
            content = content
        )
    }
}

// ════════════════════════════════════════════════════════════════
// Typography
// ════════════════════════════════════════════════════════════════

val ArukTypography @Composable get() {
    val base = Typography()
    return Typography(
        displayLarge = base.displayLarge.copy(letterSpacing = (-0.5).sp),
        displayMedium = base.displayMedium.copy(letterSpacing = (-0.25).sp),
        headlineLarge = base.headlineLarge.copy(letterSpacing = (-0.25).sp),
        headlineMedium = base.headlineMedium.copy(letterSpacing = (-0.1).sp),
        titleLarge = base.titleLarge.copy(letterSpacing = (-0.1).sp),
        bodyLarge = base.bodyLarge.copy(letterSpacing = 0.sp),
        bodyMedium = base.bodyMedium.copy(letterSpacing = 0.15.sp),
        labelSmall = base.labelSmall.copy(letterSpacing = 0.5.sp)
    )
}