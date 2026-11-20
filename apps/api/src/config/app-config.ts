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
  /**
   * Sign in with Apple, revocación (guía 5.1.1(v)): con estas cuatro la API canjea el authorizationCode
   * por el refresh token de Apple y lo revoca al eliminar la cuenta. Si falta alguna, el login sigue
   * funcionando y la revocación se omite con un aviso en el log. Cada token se canjea y revoca con el
   * client_id de su autorización (la audiencia del identityToken: el bundle ID en iOS, el Services ID
   * en la web); APPLE_CLIENT_ID es el de respaldo, para los tokens guardados sin él (por defecto, la
   * primera de APPLE_AUDIENCES, que debe ser el bundle ID). APPLE_PRIVATE_KEY es el contenido del .p8
   * (se aceptan los saltos de línea escritos como `\n`).
   */
  readonly appleTeamId = (process.env.APPLE_TEAM_ID ?? '').trim();
  readonly appleKeyId = (process.env.APPLE_KEY_ID ?? '').trim();
  readonly applePrivateKey = (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
  readonly appleClientId = (process.env.APPLE_CLIENT_ID ?? '').trim() || this.appleAudiences[0] || '';
  /**
   * Clave para cifrar ese refresh token de Apple (opcional; mínimo 32 caracteres en producción). Sin
   * ella se usa una derivada de JWT_SECRET; con ella, JWT_SECRET se puede rotar sin perder la
   * revocación. Una vez definida no se cambia: los tokens cifrados con ella dejarían de leerse.
   */
  readonly appleTokenKey = (process.env.APPLE_TOKEN_KEY ?? '').trim();
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
  /**
   * Secreto de la semilla del reto diario (HMAC-SHA256 de la fecha). Obligatorio en producción;
   * fuera de producción tiene un valor de desarrollo para que local y tests funcionen sin configurarlo.
   */
  readonly dailySecret =
    process.env.DAILY_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'desarrollo-secreto-del-reto-diario-no-usar-en-produccion');
  /**
   * Moderación: secreto de los endpoints /admin/* (cabecera `X-Admin-Token`). Vacío = esos
   * endpoints responden 404, como si no existieran. Mínimo 32 caracteres en producción.
   */
  readonly adminToken = (process.env.ADMIN_TOKEN ?? '').trim();
  /**
   * Moderación: aviso por Telegram al dueño con cada reporte nuevo (moderation/telegram.ts). Opcionales:
   * si falta alguna no se envía nada (un aviso en el log al arrancar). El token es SECRETO.
   */
  readonly telegramBotToken = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  readonly telegramChatId = (process.env.TELEGRAM_CHAT_ID ?? '').trim();

  constructor() {
    if (!this.databaseUrl) throw new Error('Falta la variable de entorno DATABASE_URL');
    if (!this.jwtSecret) throw new Error('Falta la variable de entorno JWT_SECRET');
    if (this.nodeEnv === 'production' && this.jwtSecret.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
    }
    if (this.nodeEnv === 'production' && this.appleTokenKey && this.appleTokenKey.length < 32) {
      throw new Error('APPLE_TOKEN_KEY debe tener al menos 32 caracteres en producción');
    }
    if (!this.dailySecret) throw new Error('Falta la variable de entorno DAILY_SECRET');
    if (this.nodeEnv === 'production' && this.dailySecret.length < 32) {
      throw new Error('DAILY_SECRET debe tener al menos 32 caracteres en producción');
    }
    if (this.nodeEnv === 'production' && this.adminToken && this.adminToken.length < 32) {
      throw new Error('ADMIN_TOKEN debe tener al menos 32 caracteres en producción (o déjalo vacío para desactivar /admin)');
    }
  }
}
