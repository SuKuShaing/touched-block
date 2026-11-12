import { Module } from '@nestjs/common';
import { StatsModule } from '../stats/stats.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [StatsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
