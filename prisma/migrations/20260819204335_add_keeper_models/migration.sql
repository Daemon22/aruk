-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "website" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApiAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "ApiAccount_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ApiAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoutingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceAccountId" TEXT,
    "targetAccountId" TEXT,
    "reason" TEXT NOT NULL,
    "provider" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutingEvent_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "ApiAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoutingEvent_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "ApiAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Daemon" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Daemon_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Daemon_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "AccessPolicy_daemonId_fkey" FOREIGN KEY ("daemonId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessPass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "daemonId" TEXT,
    "requesterName" TEXT NOT NULL,
    "policyId" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'read',
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "lastUsedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reason" TEXT,
    CONSTRAINT "AccessPass_daemonId_fkey" FOREIGN KEY ("daemonId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccessPass_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AccessPolicy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Daemon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_passId_fkey" FOREIGN KEY ("passId") REFERENCES "AccessPass" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PassageRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Daemon_name_key" ON "Daemon"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPass_token_key" ON "AccessPass"("token");
