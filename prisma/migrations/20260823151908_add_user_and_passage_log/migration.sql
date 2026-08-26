/*
  Warnings:

  - You are about to drop the `DataOffload` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `offloadCount` on the `CloudAccount` table. All the data in the column will be lost.
  - You are about to drop the column `storageQuotaBytes` on the `CloudAccount` table. All the data in the column will be lost.
  - You are about to drop the column `storageUsedBytes` on the `CloudAccount` table. All the data in the column will be lost.
  - Added the required column `userId` to the `AccessPolicy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ApiAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `AuditEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `CloudAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Daemon` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PassageRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Secret` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DataOffload";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PassageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cloudAccountId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "remotePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PassageLog_cloudAccountId_fkey" FOREIGN KEY ("cloudAccountId") REFERENCES "CloudAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AccessPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effect" TEXT NOT NULL DEFAULT 'allow',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "daemonId" TEXT,
    "daemonRole" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "conditions" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'read',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccessPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessPolicy_daemonId_fkey" FOREIGN KEY ("daemonId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AccessPolicy" ("conditions", "createdAt", "daemonId", "daemonRole", "description", "effect", "id", "name", "priority", "resourceId", "resourceType", "scope", "status", "updatedAt") SELECT "conditions", "createdAt", "daemonId", "daemonRole", "description", "effect", "id", "name", "priority", "resourceId", "resourceType", "scope", "status", "updatedAt" FROM "AccessPolicy";
DROP TABLE "AccessPolicy";
ALTER TABLE "new_AccessPolicy" RENAME TO "AccessPolicy";
CREATE TABLE "new_ApiAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "totalCredits" REAL NOT NULL DEFAULT 0,
    "usedCredits" REAL NOT NULL DEFAULT 0,
    "creditUnit" TEXT NOT NULL DEFAULT 'USD',
    "healthScore" REAL NOT NULL DEFAULT 100,
    "avgLatencyMs" REAL NOT NULL DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 100,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "todayRequests" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApiAccount_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiAccount" ("apiKey", "avgLatencyMs", "createdAt", "creditUnit", "errorCount", "expiresAt", "healthScore", "id", "lastUsedAt", "name", "notes", "priority", "providerId", "status", "successRate", "todayRequests", "totalCredits", "totalRequests", "updatedAt", "usedCredits") SELECT "apiKey", "avgLatencyMs", "createdAt", "creditUnit", "errorCount", "expiresAt", "healthScore", "id", "lastUsedAt", "name", "notes", "priority", "providerId", "status", "successRate", "todayRequests", "totalCredits", "totalRequests", "updatedAt", "usedCredits" FROM "ApiAccount";
DROP TABLE "ApiAccount";
ALTER TABLE "new_ApiAccount" RENAME TO "ApiAccount";
CREATE TABLE "new_AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "passId" TEXT,
    "policyId" TEXT,
    "reason" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'allowed',
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_passId_fkey" FOREIGN KEY ("passId") REFERENCES "AccessPass" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditEvent" ("action", "actorId", "actorName", "actorRole", "createdAt", "details", "id", "ipAddress", "outcome", "passId", "policyId", "reason", "resourceId", "resourceType") SELECT "action", "actorId", "actorName", "actorRole", "createdAt", "details", "id", "ipAddress", "outcome", "passId", "policyId", "reason", "resourceId", "resourceType" FROM "AuditEvent";
DROP TABLE "AuditEvent";
ALTER TABLE "new_AuditEvent" RENAME TO "AuditEvent";
CREATE TABLE "new_CloudAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "projectId" TEXT,
    "bucketName" TEXT NOT NULL,
    "region" TEXT,
    "credentials" TEXT NOT NULL,
    "credentialsMasked" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CloudAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CloudAccount" ("bucketName", "connectedAt", "createdAt", "credentials", "credentialsMasked", "id", "lastCheckedAt", "name", "notes", "projectId", "provider", "region", "status", "updatedAt") SELECT "bucketName", "connectedAt", "createdAt", "credentials", "credentialsMasked", "id", "lastCheckedAt", "name", "notes", "projectId", "provider", "region", "status", "updatedAt" FROM "CloudAccount";
DROP TABLE "CloudAccount";
ALTER TABLE "new_CloudAccount" RENAME TO "CloudAccount";
CREATE TABLE "new_Daemon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parentId" TEXT,
    "creatorId" TEXT,
    "description" TEXT,
    "purpose" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "trustLevel" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Daemon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Daemon_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Daemon_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Daemon" ("capabilities", "createdAt", "creatorId", "description", "designation", "id", "name", "parentId", "purpose", "role", "status", "trustLevel", "updatedAt") SELECT "capabilities", "createdAt", "creatorId", "description", "designation", "id", "name", "parentId", "purpose", "role", "status", "trustLevel", "updatedAt" FROM "Daemon";
DROP TABLE "Daemon";
ALTER TABLE "new_Daemon" RENAME TO "Daemon";
CREATE UNIQUE INDEX "Daemon_userId_name_key" ON "Daemon"("userId", "name");
CREATE TABLE "new_PassageRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "description" TEXT,
    "dataType" TEXT NOT NULL,
    "pattern" TEXT,
    "action" TEXT NOT NULL DEFAULT 'allow',
    "daemonRole" TEXT,
    "resourceType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PassageRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PassageRule" ("action", "createdAt", "daemonRole", "dataType", "description", "direction", "hitCount", "id", "name", "pattern", "priority", "resourceType", "status", "updatedAt") SELECT "action", "createdAt", "daemonRole", "dataType", "description", "direction", "hitCount", "id", "name", "pattern", "priority", "resourceType", "status", "updatedAt" FROM "PassageRule";
DROP TABLE "PassageRule";
ALTER TABLE "new_PassageRule" RENAME TO "PassageRule";
CREATE TABLE "new_Secret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "purpose" TEXT,
    "credentials" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "expiresAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Secret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Secret" ("createdAt", "credentials", "expiresAt", "id", "lastUsedAt", "name", "notes", "provider", "purpose", "status", "type", "updatedAt") SELECT "createdAt", "credentials", "expiresAt", "id", "lastUsedAt", "name", "notes", "provider", "purpose", "status", "type", "updatedAt" FROM "Secret";
DROP TABLE "Secret";
ALTER TABLE "new_Secret" RENAME TO "Secret";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
