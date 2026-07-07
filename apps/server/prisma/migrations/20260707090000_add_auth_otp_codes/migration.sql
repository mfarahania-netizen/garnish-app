CREATE TABLE "AuthOtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthOtpCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthOtpCode_phone_createdAt_idx" ON "AuthOtpCode"("phone", "createdAt");
CREATE INDEX "AuthOtpCode_userId_createdAt_idx" ON "AuthOtpCode"("userId", "createdAt");
CREATE INDEX "AuthOtpCode_expiresAt_idx" ON "AuthOtpCode"("expiresAt");
CREATE INDEX "AuthOtpCode_phone_purpose_consumedAt_idx" ON "AuthOtpCode"("phone", "purpose", "consumedAt");

ALTER TABLE "AuthOtpCode"
  ADD CONSTRAINT "AuthOtpCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
