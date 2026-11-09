import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from './auth.guard';
import { AuthService } from './auth.service';
import { AppleLoginDto, GoogleLoginDto, RefreshDto } from './dto';
import { AppleVerifier, GoogleVerifier } from './verifiers';

@Controller('auth')
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleVerifier,
    private readonly apple: AppleVerifier,
  ) {}

  @Post('google')
  @HttpCode(200)
  async google_(@Body() dto: GoogleLoginDto) {
    const identity = await this.google.verify(dto.idToken);
    return this.auth.login('google', identity, { country: dto.country });
  }

  @Post('apple')
  @HttpCode(200)
  async apple_(@Body() dto: AppleLoginDto) {
    const identity = await this.apple.verify(dto.identityToken);
    return this.auth.login('apple', identity, { country: dto.country, name: dto.fullName ?? null });
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }
}
