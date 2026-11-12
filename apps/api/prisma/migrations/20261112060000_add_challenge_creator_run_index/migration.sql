-- CreateIndex
-- Solo agrega un índice (no toca datos): ChallengesService.claimEntry busca el reto por la
-- partida con que se creó al reclamar una partida de invitado.
CREATE INDEX "Challenge_creatorRunId_idx" ON "Challenge"("creatorRunId");
