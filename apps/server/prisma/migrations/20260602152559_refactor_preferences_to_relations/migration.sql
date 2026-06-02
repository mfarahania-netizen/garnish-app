/*
  Warnings:

  - You are about to drop the column `allergies` on the `UserPreference` table. All the data in the column will be lost.
  - You are about to drop the column `cuisine` on the `UserPreference` table. All the data in the column will be lost.
  - You are about to drop the column `healthGoals` on the `UserPreference` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserPreference" DROP COLUMN "allergies",
DROP COLUMN "cuisine",
DROP COLUMN "healthGoals";

-- CreateTable
CREATE TABLE "allergies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuisines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "cuisines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_goals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "health_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_allergies" (
    "userId" TEXT NOT NULL,
    "allergyId" TEXT NOT NULL,

    CONSTRAINT "user_allergies_pkey" PRIMARY KEY ("userId","allergyId")
);

-- CreateTable
CREATE TABLE "user_cuisines" (
    "userId" TEXT NOT NULL,
    "cuisineId" TEXT NOT NULL,

    CONSTRAINT "user_cuisines_pkey" PRIMARY KEY ("userId","cuisineId")
);

-- CreateTable
CREATE TABLE "user_health_goals" (
    "userId" TEXT NOT NULL,
    "healthGoalId" TEXT NOT NULL,

    CONSTRAINT "user_health_goals_pkey" PRIMARY KEY ("userId","healthGoalId")
);

-- CreateIndex
CREATE UNIQUE INDEX "allergies_name_key" ON "allergies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cuisines_name_key" ON "cuisines"("name");

-- CreateIndex
CREATE UNIQUE INDEX "health_goals_name_key" ON "health_goals"("name");

-- AddForeignKey
ALTER TABLE "user_allergies" ADD CONSTRAINT "user_allergies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_allergies" ADD CONSTRAINT "user_allergies_allergyId_fkey" FOREIGN KEY ("allergyId") REFERENCES "allergies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cuisines" ADD CONSTRAINT "user_cuisines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cuisines" ADD CONSTRAINT "user_cuisines_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "cuisines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_health_goals" ADD CONSTRAINT "user_health_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_health_goals" ADD CONSTRAINT "user_health_goals_healthGoalId_fkey" FOREIGN KEY ("healthGoalId") REFERENCES "health_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
