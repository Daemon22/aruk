package com.aruk.core.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.aruk.core.model.*

// ════════════════════════════════════════════════════════════════
// Room Converters
// ════════════════════════════════════════════════════════════════

class Converters {
    // Room doesn't natively support enums — stored as strings
    // The entity classes use String fields that we convert to enums
    // at the repository level, keeping Room simple.
}

// ════════════════════════════════════════════════════════════════
// Entities (Local Cache)
// ════════════════════════════════════════════════════════════════

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo

/**
 * Cached account for offline access / fast UI load.
 * This is a local copy — the source of truth is the server.
 */
@Entity(tableName = "cached_accounts")
data class CachedAccount(
    @PrimaryKey val id: String,
    val name: String,
    val providerName: String,
    val status: String,       // AccountStatus name
    val priority: Int,
    val totalCredits: Double,
    val usedCredits: Double,
    val creditUnit: String,   // CreditUnit name
    val healthScore: Double,
    val avgLatencyMs: Double,
    val successRate: Double,
    val totalRequests: Int,
    val todayRequests: Int,
    val remainingCredits: Double,
    val remainingPercent: Double,
    @ColumnInfo(defaultValue = "0")
    val isStale: Boolean = false,
    val cachedAt: Long = System.currentTimeMillis()
)

/**
 * Cached secret (credentials encrypted via Android Keystore at a higher layer).
 */
@Entity(tableName = "cached_secrets")
data class CachedSecret(
    @PrimaryKey val id: String,
    val name: String,
    val type: String,
    val provider: String,
    val purpose: String?,
    val status: String,
    val fieldCount: Int,
    val expiresAt: String?,
    val cachedAt: Long = System.currentTimeMillis()
)

// ════════════════════════════════════════════════════════════════
// DAOs
// ════════════════════════════════════════════════════════════════

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface CachedAccountDao {
    @Query("SELECT * FROM cached_accounts ORDER BY priority DESC, healthScore DESC")
    fun getAllFlow(): Flow<List<CachedAccount>>

    @Query("SELECT * FROM cached_accounts WHERE status = 'active' ORDER BY priority DESC")
    fun getActiveFlow(): Flow<List<CachedAccount>>

    @Query("SELECT * FROM cached_accounts WHERE id = :id")
    suspend fun getById(id: String): CachedAccount?

    @Query("SELECT * FROM cached_accounts WHERE providerName = :provider ORDER BY priority DESC")
    suspend fun getByProvider(provider: String): List<CachedAccount>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(accounts: List<CachedAccount>)

    @Query("DELETE FROM cached_accounts")
    suspend fun clearAll()

    @Query("UPDATE cached_accounts SET isStale = 1")
    suspend fun markAllStale()
}

@Dao
interface CachedSecretDao {
    @Query("SELECT * FROM cached_secrets ORDER BY name ASC")
    fun getAllFlow(): Flow<List<CachedSecret>>

    @Query("SELECT * FROM cached_secrets WHERE purpose = :purpose")
    suspend fun getByPurpose(purpose: String): List<CachedSecret>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(secrets: List<CachedSecret>)

    @Query("DELETE FROM cached_secrets WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM cached_secrets")
    suspend fun clearAll()
}

// ════════════════════════════════════════════════════════════════
// Database
// ════════════════════════════════════════════════════════════════

@Database(
    entities = [CachedAccount::class, CachedSecret::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class ArukDatabase : RoomDatabase() {
    abstract fun accountDao(): CachedAccountDao
    abstract fun secretDao(): CachedSecretDao
}

// ════════════════════════════════════════════════════════════════
// Mappers (Server Model ↔ Cache Entity)
// ════════════════════════════════════════════════════════════════

fun AccountInfo.toCached(): CachedAccount = CachedAccount(
    id = id,
    name = name,
    providerName = providerName,
    status = status.name.lowercase(),
    priority = priority,
    totalCredits = totalCredits,
    usedCredits = usedCredits,
    creditUnit = creditUnit.name.lowercase(),
    healthScore = healthScore,
    avgLatencyMs = avgLatencyMs,
    successRate = successRate,
    totalRequests = totalRequests,
    todayRequests = todayRequests,
    remainingCredits = remainingCredits,
    remainingPercent = remainingPercent
)

fun CachedAccount.toModel(): AccountInfo = AccountInfo(
    id = id,
    name = name,
    providerName = providerName,
    status = AccountStatus.fromValue(status),
    priority = priority,
    totalCredits = totalCredits,
    usedCredits = usedCredits,
    creditUnit = CreditUnit.fromValue(creditUnit),
    healthScore = healthScore,
    avgLatencyMs = avgLatencyMs,
    successRate = successRate,
    totalRequests = totalRequests,
    todayRequests = todayRequests,
    remainingCredits = remainingCredits,
    remainingPercent = remainingPercent
)

fun SecretEntry.toCached(): CachedSecret = CachedSecret(
    id = id,
    name = name,
    type = type.name.lowercase(),
    provider = provider,
    purpose = purpose?.name?.lowercase(),
    status = status,
    fieldCount = credentials.size
)

fun SecretListItem.toCached(): CachedSecret = CachedSecret(
    id = id,
    name = name,
    type = type.name.lowercase(),
    provider = provider,
    purpose = purpose?.name?.lowercase(),
    status = status,
    fieldCount = fields.size
)
