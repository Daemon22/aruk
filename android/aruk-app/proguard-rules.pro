# Aruk App - ProGuard Rules

# Keep application classes
-keep class com.aruk.app.** { *; }

# Compose navigation arguments
-keepclassmembers class * {
    ** navigationArgs();
}

# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# Keep model classes used in navigation
-keep class com.aruk.core.model.** { *; }