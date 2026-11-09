import { Module } from '@nestjs/common';
import { BestScoresService } from './best-scores.service';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsService } from './leaderboards.service';

@Module({
  controllers: [LeaderboardsController],
  providers: [LeaderboardsService, BestScoresService],
  exports: [BestScoresService],
})
export class LeaderboardsModule {}
