-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceKey" TEXT,
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_deviceKey_key" ON "User"("deviceKey");
