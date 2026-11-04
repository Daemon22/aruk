CREATE TABLE "VaultFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "sizeBytes" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "compressed" BOOLEAN NOT NULL DEFAULT false,
    "sha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaultFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VaultFile_userId_createdAt_idx" ON "VaultFile"("userId", "createdAt");
