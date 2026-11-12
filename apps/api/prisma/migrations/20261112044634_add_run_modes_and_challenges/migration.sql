-- CreateEnum
CREATE TYPE "RunMode" AS ENUM ('normal', 'duel', 'daily');

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "challengeCode" VARCHAR(8),
ADD COLUMN     "config" JSONB,
ADD COLUMN     "dailyDate" VARCHAR(10),
ADD COLUMN     "mode" "RunMode" NOT NULL DEFAULT 'normal';

-- CreateTable
CREATE TABLE "Challenge" (
    "code" VARCHAR(8) NOT NULL,
    "seed" INTEGER NOT NULL,
    "fieldW" DOUBLE PRECISION NOT NULL,
    "fieldH" DOUBLE PRECISION NOT NULL,
    "rulesVersion" INTEGER NOT NULL,
    "createdById" UUID,
    "creatorRunId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ChallengeEntry" (
    "id" UUID NOT NULL,
    "challengeCode" VARCHAR(8) NOT NULL,
    "userId" UUID,
    "runId" UUID,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "killed" INTEGER NOT NULL,
    "missed" INTEGER NOT NULL,
    "ticks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Challenge_createdById_idx" ON "Challenge"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEntry_runId_key" ON "ChallengeEntry"("runId");

-- CreateIndex
CREATE INDEX "ChallengeEntry_challengeCode_killed_missed_createdAt_idx" ON "ChallengeEntry"("challengeCode", "killed" DESC, "missed", "createdAt");

-- CreateIndex
CREATE INDEX "ChallengeEntry_userId_idx" ON "ChallengeEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEntry_challengeCode_userId_key" ON "ChallengeEntry"("challengeCode", "userId");

-- CreateIndex
CREATE INDEX "Run_userId_dailyDate_idx" ON "Run"("userId", "dailyDate");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_challengeCode_fkey" FOREIGN KEY ("challengeCode") REFERENCES "Challenge"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
