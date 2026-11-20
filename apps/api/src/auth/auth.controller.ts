import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AppleTokensService } from './apple-tokens';
import { Public } from './auth.guard';
import { AuthService } from './auth.service';
import { AppleLoginDto, AppleNotificationDto, GoogleLoginDto, RefreshDto } from './dto';
import { AppleVerifier, GoogleVerifier } from './verifiers';

/**
 * Avisos de Apple que significan que el usuario dejó de usar Sign in with Apple con la app. La
 * documentación de Apple usa `account-deleted` en los ejemplos y `account-delete` en otras partes:
 * se aceptan los dos.
 */
const APPLE_DELETE_EVENTS = new Set(['consent-revoked', 'account-delete', 'account-deleted']);

@Controller('auth')
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  private readonly log = new Logger('Auth');

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleVerifier,
    private readonly apple: AppleVerifier,
    private readonly appleTokens: AppleTokensService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
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
    const res = await this.auth.login('apple', identity, { country: dto.country, name: dto.fullName ?? null });
    // para poder revocar el token al eliminar la cuenta (guía 5.1.1(v)); nunca hace fallar el login
    // con el client_id de la autorización (bundle ID en iOS, Services ID en la web) y, en la web, su redirect_uri
    if (dto.authorizationCode) {
      // sin await: el canje habla con Apple (hasta 8 s) y el login no debe esperarlo; storeFromCode nunca lanza
      void this.appleTokens.storeFromCode(identity.subject, dto.authorizationCode, {
        clientId: identity.audience,
        redirectUri: dto.redirectUri,
      });
    }
    return res;
  }

  /**
   * Notificaciones servidor a servidor de Sign in with Apple (se configuran en Apple Developer).
   * `consent-revoked` (dejó de usar su Apple ID con la app) y `account-delete(d)` (borró su Apple ID)
   * eliminan la cuenta; los demás avisos se ignoran. Responde 200 aunque la cuenta no exista.
   */
  @Post('apple/notifications')
  @HttpCode(200)
  async appleNotifications(@Body() dto: AppleNotificationDto) {
    const ev = await this.apple.verifyNotification(dto.payload);
    if (!APPLE_DELETE_EVENTS.has(ev.type)) return { ok: true };
    const ident = await this.prisma.authIdentity.findUnique({
      where: { provider_subject: { provider: 'apple', subject: ev.subject } },
      select: { userId: true, createdAt: true },
    });
    // un aviso anterior a la identidad (p. ej. un reintento del que borró la cuenta anterior del mismo
    // Apple ID) no puede borrar la cuenta creada después
    if (ident && ev.eventTime && ev.eventTime.getTime() < ident.createdAt.getTime()) {
      this.log.log(`Aviso de Apple (${ev.type}) anterior a la cuenta actual: se ignora.`);
      return { ok: true };
    }
    if (ident) {
      // Apple ya cortó el vínculo: no hace falta revocar el token
      await this.users.deleteMe(ident.userId, { revokeApple: false });
      this.log.log(`Cuenta ${ident.userId} eliminada por aviso de Apple (${ev.type}).`);
    }
    return { ok: true };
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
