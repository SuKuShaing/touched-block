-- CreateTable
CREATE TABLE "DailyChallenge" (
    "date" VARCHAR(10) NOT NULL,
    "fieldW" DOUBLE PRECISION NOT NULL,
    "fieldH" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "DailyEntry" (
    "userId" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "runId" UUID,
    "killed" INTEGER NOT NULL,
    "missed" INTEGER NOT NULL,
    "ticks" INTEGER NOT NULL,
    "bestStreak" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "country" CHAR(2),

    CONSTRAINT "DailyEntry_pkey" PRIMARY KEY ("userId","date")
);

-- CreateIndex
CREATE INDEX "DailyEntry_date_killed_missed_achievedAt_idx" ON "DailyEntry"("date", "killed" DESC, "missed", "achievedAt");

-- CreateIndex
CREATE INDEX "DailyEntry_date_country_killed_missed_achievedAt_idx" ON "DailyEntry"("date", "country", "killed" DESC, "missed", "achievedAt");

-- CreateIndex
CREATE INDEX "DailyEntry_runId_idx" ON "DailyEntry"("runId");

-- AddForeignKey
ALTER TABLE "DailyEntry" ADD CONSTRAINT "DailyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEntry" ADD CONSTRAINT "DailyEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
