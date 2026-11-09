import { Module } from '@nestjs/common';
import { LeaderboardsModule } from '../leaderboards/leaderboards.module';
import { UsersModule } from '../users/users.module';
import { RunsCleanupService } from './runs-cleanup.service';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [UsersModule, LeaderboardsModule],
  controllers: [RunsController],
  providers: [RunsService, RunsCleanupService],
  exports: [RunsService],
})
export class RunsModule {}
