plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.aruk.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.aruk.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        vectorDrawables {
            useSupportLibrary = true
        }
    }

    val releaseStoreFile = providers.gradleProperty("ARUK_ANDROID_KEYSTORE").orElse(providers.environmentVariable("ARUK_ANDROID_KEYSTORE"))
    val releaseStorePassword = providers.gradleProperty("ARUK_ANDROID_KEYSTORE_PASSWORD").orElse(providers.environmentVariable("ARUK_ANDROID_KEYSTORE_PASSWORD"))
    val releaseKeyAlias = providers.gradleProperty("ARUK_ANDROID_KEY_ALIAS").orElse(providers.environmentVariable("ARUK_ANDROID_KEY_ALIAS"))
    val releaseKeyPassword = providers.gradleProperty("ARUK_ANDROID_KEY_PASSWORD").orElse(providers.environmentVariable("ARUK_ANDROID_KEY_PASSWORD"))

    signingConfigs {
        if (releaseStoreFile.isPresent && releaseStorePassword.isPresent && releaseKeyAlias.isPresent && releaseKeyPassword.isPresent) {
            create("release") {
                storeFile = file(releaseStoreFile.get())
                storePassword = releaseStorePassword.get()
                keyAlias = releaseKeyAlias.get()
                keyPassword = releaseKeyPassword.get()
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    applicationVariants.all {
        val variant = this
        variant.outputs.all {
            val output = this as com.android.build.gradle.internal.api.ApkVariantOutputImpl
            output.outputFileName = "aruk-${variant.versionName}-${variant.buildType.name}.apk"
        }
    }
}

dependencies {
    // Aruk UI (transitively includes aruk-core)
    implementation(project(":aruk-ui"))

    // Compose BOM
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons.extended)
    debugImplementation(libs.compose.ui.tooling)

    // Lifecycle
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Navigation
    implementation(libs.navigation.compose)

    // Hilt
    implementation(libs.google.dagger.hilt.android)
    ksp(libs.google.dagger.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    // Charts
    implementation(libs.vico.compose.m3)
    implementation(libs.vico.core)

    // Coil
    implementation(libs.coil.compose)

    // Testing
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(libs.compose.ui.test.junit4)
    debugImplementation(libs.compose.ui.test.manifest)
}