-- CreateTable
CREATE TABLE "UserAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ip" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferenceHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreferenceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAuditLog_userId_createdAt_idx" ON "UserAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DataAccessLog_userId_accessedAt_idx" ON "DataAccessLog"("userId", "accessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentLog_userId_type_key" ON "ConsentLog"("userId", "type");

-- CreateIndex
CREATE INDEX "PreferenceHistory_userId_changedAt_idx" ON "PreferenceHistory"("userId", "changedAt");

-- AddForeignKey
ALTER TABLE "UserAuditLog" ADD CONSTRAINT "UserAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAccessLog" ADD CONSTRAINT "DataAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferenceHistory" ADD CONSTRAINT "PreferenceHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
