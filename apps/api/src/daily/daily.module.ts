import { Module } from '@nestjs/common';
import { CommonFieldModule } from '../runs/common-field.module';
import { StatsModule } from '../stats/stats.module';
import { DailyController } from './daily.controller';
import { DailyService } from './daily.service';

@Module({
  imports: [StatsModule, CommonFieldModule],
  controllers: [DailyController],
  providers: [DailyService],
  exports: [DailyService],
})
export class DailyModule {}
