-- CreateTable
CREATE TABLE "AICallLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventId" TEXT,
    "conversationId" TEXT,
    "surface" TEXT,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "estimatedInputTokens" INTEGER,
    "estimatedOutputTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "guardHits" JSONB NOT NULL,
    "toolCalls" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentSafetyStatus" TEXT,
    "model" TEXT,
    "aiCallLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AICallLog_userId_createdAt_idx" ON "AICallLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AICallLog_status_idx" ON "AICallLog"("status");

-- CreateIndex
CREATE INDEX "AICallLog_conversationId_idx" ON "AICallLog"("conversationId");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "UserFact_userId_idx" ON "UserFact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFact_userId_key_key" ON "UserFact"("userId", "key");

-- AddForeignKey
ALTER TABLE "AICallLog" ADD CONSTRAINT "AICallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFact" ADD CONSTRAINT "UserFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

