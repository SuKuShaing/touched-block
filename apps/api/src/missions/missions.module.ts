import { Module } from '@nestjs/common';
import { StatsModule } from '../stats/stats.module';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [StatsModule],
  controllers: [MissionsController],
  providers: [MissionsService],
})
export class MissionsModule {}
