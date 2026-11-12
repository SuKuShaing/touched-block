import { Module } from '@nestjs/common';
import { ChallengesModule } from '../challenges/challenges.module';
import { DailyModule } from '../daily/daily.module';
import { LeaderboardsModule } from '../leaderboards/leaderboards.module';
import { StatsModule } from '../stats/stats.module';
import { UsersModule } from '../users/users.module';
import { CommonFieldModule } from './common-field.module';
import { RunsCleanupService } from './runs-cleanup.service';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [UsersModule, LeaderboardsModule, StatsModule, CommonFieldModule, ChallengesModule, DailyModule],
  controllers: [RunsController],
  providers: [RunsService, RunsCleanupService],
  exports: [RunsService],
})
export class RunsModule {}
