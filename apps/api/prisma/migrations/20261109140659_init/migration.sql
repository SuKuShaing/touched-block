-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('started', 'valid', 'rejected');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('week', 'month', 'year', 'all');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "displayName" VARCHAR(100),
    "email" VARCHAR(320),
    "country" CHAR(2),
    "countryChangedAt" TIMESTAMP(3),
    "invitedById" UUID,
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "userId" UUID NOT NULL,
    "email" VARCHAR(320),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "claimTokenHash" CHAR(64),
    "seed" INTEGER NOT NULL,
    "rulesVersion" INTEGER NOT NULL,
    "maxLives" INTEGER NOT NULL,
    "fieldW" DOUBLE PRECISION NOT NULL,
    "fieldH" DOUBLE PRECISION NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'started',
    "killed" INTEGER,
    "missed" INTEGER,
    "ticks" INTEGER,
    "durationMs" INTEGER,
    "inputs" JSONB,
    "rejectReason" VARCHAR(32),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestScore" (
    "userId" UUID NOT NULL,
    "rulesVersion" INTEGER NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "periodKey" VARCHAR(8) NOT NULL,
    "country" CHAR(2),
    "killed" INTEGER NOT NULL,
    "missed" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "runId" UUID NOT NULL,

    CONSTRAINT "BestScore_pkey" PRIMARY KEY ("userId","rulesVersion","periodType","periodKey")
);

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" UUID NOT NULL,
    "followeeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followeeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_invitedById_idx" ON "User"("invitedById");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_subject_key" ON "AuthIdentity"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_hash_key" ON "RefreshToken"("hash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Run_userId_status_finishedAt_idx" ON "Run"("userId", "status", "finishedAt" DESC);

-- CreateIndex
CREATE INDEX "Run_status_startedAt_idx" ON "Run"("status", "startedAt");

-- CreateIndex
CREATE INDEX "Run_startedAt_idx" ON "Run"("startedAt");

-- CreateIndex
CREATE INDEX "BestScore_rulesVersion_periodType_periodKey_killed_missed_a_idx" ON "BestScore"("rulesVersion", "periodType", "periodKey", "killed" DESC, "missed", "achievedAt");

-- CreateIndex
CREATE INDEX "BestScore_rulesVersion_periodType_periodKey_country_killed__idx" ON "BestScore"("rulesVersion", "periodType", "periodKey", "country", "killed" DESC, "missed", "achievedAt");

-- CreateIndex
CREATE INDEX "BestScore_runId_idx" ON "BestScore"("runId");

-- CreateIndex
CREATE INDEX "Follow_followeeId_idx" ON "Follow"("followeeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestScore" ADD CONSTRAINT "BestScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestScore" ADD CONSTRAINT "BestScore_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
