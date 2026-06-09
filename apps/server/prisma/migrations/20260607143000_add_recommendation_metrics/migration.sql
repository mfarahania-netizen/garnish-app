-- CreateTable
CREATE TABLE "RecommendationMetrics" (
    "id" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowDays" INTEGER NOT NULL DEFAULT 7,
    "totalImpressions" INTEGER NOT NULL DEFAULT 0,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalSaves" INTEGER NOT NULL DEFAULT 0,
    "totalCooks" INTEGER NOT NULL DEFAULT 0,
    "totalDismisses" INTEGER NOT NULL DEFAULT 0,
    "totalExposures" INTEGER NOT NULL DEFAULT 0,
    "clickThroughRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saveRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cookRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frictionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recommendationQuality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recommendationReward" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topSignals" JSONB,
    "topFeatures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationMetrics_metricDate_windowDays_key" ON "RecommendationMetrics"("metricDate", "windowDays");

-- CreateIndex
CREATE INDEX "RecommendationMetrics_metricDate_windowDays_idx" ON "RecommendationMetrics"("metricDate", "windowDays");
