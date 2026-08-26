# Aruk Core SDK - ProGuard Rules

# Keep all kotlinx.serialization classes used as API models
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# Keep all model classes (they are serialized by name)
-keepclassmembers class com.aruk.core.model.** {
    *** Companion;
}
-keepclasseswithmembers class com.aruk.core.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature
-keepattributes Exceptions

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Hilt
-dontwarn dagger.hilt.**

# Keep enum values (used in routing strategies, statuses, etc.)
-keepclassmembers enum * {
    **[] $VALUES;
    public *;
}