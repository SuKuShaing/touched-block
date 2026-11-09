import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AppConfig } from './config/app-config';
import { HealthController } from './health/health.controller';
import { LeaderboardsModule } from './leaderboards/leaderboards.module';
import { CoreModule } from './prisma/core.module';
import { RunsModule } from './runs/runs.module';
import { SocialModule } from './social/social.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    CoreModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: config.throttleLimit }],
        skipIf: () => config.throttleDisabled,
        errorMessage: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
      }),
    }),
    AuthModule,
    UsersModule,
    SocialModule,
    RunsModule,
    LeaderboardsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
