-- CreateTable
CREATE TABLE "CloudAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "projectId" TEXT,
    "bucketName" TEXT NOT NULL,
    "region" TEXT,
    "credentials" TEXT NOT NULL,
    "credentialsMasked" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "storageUsedBytes" INTEGER NOT NULL DEFAULT 0,
    "storageQuotaBytes" INTEGER,
    "offloadCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DataOffload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cloudAccountId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "remotePath" TEXT NOT NULL,
    "localFingerprint" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'offloaded',
    "offloadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retrievedAt" DATETIME,
    "expiresAt" DATETIME,
    "reason" TEXT NOT NULL,
    "retrievalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataOffload_cloudAccountId_fkey" FOREIGN KEY ("cloudAccountId") REFERENCES "CloudAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
