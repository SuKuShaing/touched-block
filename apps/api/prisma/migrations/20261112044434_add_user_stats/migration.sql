-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "bestStreak" INTEGER,
ADD COLUMN     "endReason" VARCHAR(16);

-- CreateTable
CREATE TABLE "UserStats" (
    "userId" UUID NOT NULL,
    "bestTicks" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalKilled" INTEGER NOT NULL DEFAULT 0,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "bonusXp" INTEGER NOT NULL DEFAULT 0,
    "bestDailyPct" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Relleno inicial (solo agrega filas; no toca ninguna otra tabla): los jugadores con cuenta
-- reciben lo que ya ganaron con sus partidas válidas. La mejor racha no estaba guardada y parte
-- en 0; la llena scripts/backfill-streaks.mjs repitiendo las partidas de las reglas actuales.
-- Todas las partidas existentes son de modo normal (los retos llegan en la fase 3).
INSERT INTO "UserStats" ("userId", "bestTicks", "bestStreak", "totalKilled", "totalRuns", "bonusXp", "updatedAt")
SELECT "userId", COALESCE(max("ticks"), 0)::int, 0, COALESCE(sum("killed"), 0)::int, count(*)::int, 0, now()
FROM "Run"
WHERE "status" = 'valid' AND "userId" IS NOT NULL
GROUP BY "userId"
ON CONFLICT ("userId") DO NOTHING;
