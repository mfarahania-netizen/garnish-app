-- CreateTable
CREATE TABLE "UserFeatureVector" (
    "userId" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeatureVector_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserFeature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "baselineValue" DOUBLE PRECISION,
    "metricValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "improvementPercent" DOUBLE PRECISION,
    "trend" DOUBLE PRECISION,
    "period" TEXT NOT NULL DEFAULT 'weekly',
    "sources" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentityDimension" (
    "userId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "lastEvidenceAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIdentityDimension_pkey" PRIMARY KEY ("userId","dimensionKey")
);

-- CreateTable
CREATE TABLE "UserBehaviorTimeline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBehaviorTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalObservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalName" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBehaviorSignal" (
    "userId" TEXT NOT NULL,
    "signalName" TEXT NOT NULL,
    "signalDomain" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "consistency" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "halfLifeDays" INTEGER NOT NULL DEFAULT 30,
    "lastDetected" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBehaviorSignal_pkey" PRIMARY KEY ("userId","signalName")
);

-- CreateTable
CREATE TABLE "UserEngagementSnapshot" (
    "userId" TEXT NOT NULL,
    "avgSessionDuration" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgTimeBetweenSessions" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "daysSinceLastMealPlan" INTEGER NOT NULL DEFAULT 0,
    "activeDaysLast30" INTEGER NOT NULL DEFAULT 0,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEngagementSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserHealthSnapshot" (
    "userId" TEXT NOT NULL,
    "mealPlanCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "goalCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "nutritionViewFrequency" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hasActiveHealthGoal" BOOLEAN NOT NULL DEFAULT false,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserHealthSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserIdentitySnapshot" (
    "userId" TEXT NOT NULL,
    "recipeSaveRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "recipeCookRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "shoppingCompletionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "aiAcceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "aiDismissRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIdentitySnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserRetentionSnapshot" (
    "userId" TEXT NOT NULL,
    "daysSinceLastActive" INTEGER NOT NULL DEFAULT 0,
    "sessionTrend" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "engagementTrend" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "retentionScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "churnRisk" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRetentionSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "UserFeature_featureKey_value_idx" ON "UserFeature"("featureKey", "value");

-- CreateIndex
CREATE UNIQUE INDEX "UserFeature_userId_featureKey_key" ON "UserFeature"("userId", "featureKey");

-- CreateIndex
CREATE INDEX "UserOutcome_userId_metricName_recordedAt_idx" ON "UserOutcome"("userId", "metricName", "recordedAt");

-- CreateIndex
CREATE INDEX "UserBehaviorTimeline_userId_dimensionKey_recordedAt_idx" ON "UserBehaviorTimeline"("userId", "dimensionKey", "recordedAt");

-- AddForeignKey
ALTER TABLE "SignalObservation" ADD CONSTRAINT "SignalObservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "UserEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
