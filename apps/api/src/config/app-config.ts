import { Injectable } from '@nestjs/common';

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const int = (v: string | undefined, def: number) => {
  const n = v === undefined || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : def;
};

/** Configuración leída de variables de entorno (ver .env.example). */
@Injectable()
export class AppConfig {
  readonly nodeEnv = process.env.NODE_ENV ?? 'development';
  readonly port = int(process.env.PORT, 3000);
  readonly databaseUrl = process.env.DATABASE_URL ?? '';
  readonly jwtSecret = process.env.JWT_SECRET ?? '';
  readonly googleClientIds = list(process.env.GOOGLE_CLIENT_IDS ?? process.env.GOOGLE_CLIENT_ID);
  readonly appleAudiences = list(process.env.APPLE_AUDIENCES);
  readonly corsOrigins = list(process.env.CORS_ORIGINS ?? 'http://localhost:8081');
  /** Solo desarrollo: acepta idTokens `dev:<sub>:<nombre>` en /auth/google. Se ignora en producción. */
  readonly authDevFake = process.env.AUTH_DEV_FAKE === '1';
  readonly throttleLimit = int(process.env.THROTTLE_LIMIT, 120);
  /** Solo para tests e2e: desactiva el límite de peticiones. */
  readonly throttleDisabled = process.env.THROTTLE_DISABLED === '1';
  readonly cleanupIntervalMs = int(process.env.CLEANUP_INTERVAL_MS, 60 * 60 * 1000);
  readonly trustProxy = process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal';
  readonly accessTokenTtlSec = 15 * 60;
  readonly refreshTokenTtlDays = 60;

  constructor() {
    if (!this.databaseUrl) throw new Error('Falta la variable de entorno DATABASE_URL');
    if (!this.jwtSecret) throw new Error('Falta la variable de entorno JWT_SECRET');
    if (this.nodeEnv === 'production' && this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
    }
  }
}
