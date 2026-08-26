// Top-level build file for Aruk Android SDK
// https://docs.gradle.org/current/userguide/building_java_projects.html

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
}

allprojects {
    group = "com.aruk"
    version = "0.2.0"

    repositories {
        google()
        mavenCentral()
    }
}

subprojects {
    afterEvaluate {
        // Enforce consistent Kotlin compiler options across all modules
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            compilerOptions {
                jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
                allWarningsAsErrors.set(false)
            }
        }
    }
}