package com.aruk.core.db

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): ArukDatabase =
        Room.databaseBuilder(
            context,
            ArukDatabase::class.java,
            "aruk_cache.db"
        )
        .fallbackToDestructiveMigration() // For development — use migrations in production
        .build()

    @Provides
    @Singleton
    fun provideAccountDao(db: ArukDatabase): CachedAccountDao = db.accountDao()

    @Provides
    @Singleton
    fun provideSecretDao(db: ArukDatabase): CachedSecretDao = db.secretDao()
}