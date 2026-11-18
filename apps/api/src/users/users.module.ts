import { Module } from '@nestjs/common';
import { AppleTokensModule } from '../auth/apple-tokens';
import { StatsModule } from '../stats/stats.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [StatsModule, AppleTokensModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
