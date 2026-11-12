import { Module } from '@nestjs/common';
import { StatsModule } from '../stats/stats.module';
import { BestScoresService } from './best-scores.service';
import { LeaderboardsController } from './leaderboards.controller';
import { LeaderboardsService } from './leaderboards.service';

@Module({
  imports: [StatsModule],
  controllers: [LeaderboardsController],
  providers: [LeaderboardsService, BestScoresService],
  exports: [BestScoresService],
})
export class LeaderboardsModule {}
