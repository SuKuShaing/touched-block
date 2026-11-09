import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { AppleVerifier, GoogleVerifier, JoseAppleVerifier, createGoogleVerifier } from './verifiers';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    { provide: GoogleVerifier, inject: [AppConfig], useFactory: createGoogleVerifier },
    { provide: AppleVerifier, useClass: JoseAppleVerifier },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokensService],
})
export class AuthModule {}
