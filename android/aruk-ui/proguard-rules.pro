# Aruk UI Library - ProGuard Rules

# Compose
-dontwarn androidx.compose.**

# Keep Compose entry points
-keep class androidx.compose.** { *; }

# Navigation
-keepclassmembers class androidx.navigation.** { *; }

# Vico Charts
-dontwarn com.patrykandpatrick.vico.**

# Coil
-dontwarn coil.**
