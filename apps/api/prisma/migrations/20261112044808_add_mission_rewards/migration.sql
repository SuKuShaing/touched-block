-- CreateTable
CREATE TABLE "MissionReward" (
    "userId" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "missionId" VARCHAR(32) NOT NULL,
    "reward" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionReward_pkey" PRIMARY KEY ("userId","date","missionId")
);

-- AddForeignKey
ALTER TABLE "MissionReward" ADD CONSTRAINT "MissionReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
