import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger, Module, Optional } from '@nestjs/common';
import { SignJWT, importPKCS8 } from 'jose';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sign in with Apple: canje del authorizationCode y revocación del token (guía 5.1.1(v) de Apple:
 * al eliminar la cuenta hay que revocar el token con la API REST de Apple).
 *
 * - Al iniciar sesión, el cliente iOS manda el `authorizationCode` (un solo uso, 5 min). Se canjea en
 *   /auth/token por un refresh token, que se guarda **cifrado** en AuthIdentity.providerRefreshToken.
 * - Al eliminar la cuenta se revoca en /auth/revoke antes de borrar. Si Apple falla, se registra y la
 *   cuenta se borra igual.
 * - El client_secret es un JWT ES256 firmado con la clave .p8 (APPLE_PRIVATE_KEY): iss = Team ID,
 *   sub = client_id (bundle ID), aud = https://appleid.apple.com, kid = Key ID, vence en 1 h (Apple
 *   acepta hasta 6 meses).
 * - Sin APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY / client_id, el login con Apple sigue
 *   funcionando y esto se omite con un aviso.
 */

export const APPLE_ORIGIN = 'https://appleid.apple.com';
/** Para los tests: reemplaza `fetch`. */
export const APPLE_FETCH = Symbol('APPLE_FETCH');
type FetchFn = typeof fetch;

const TIMEOUT_MS = 8000;
const SECRET_TTL_SEC = 60 * 60;
const ENC_PREFIX = 'v1';

type RevocationConfig = Pick<AppConfig, 'appleTeamId' | 'appleKeyId' | 'applePrivateKey' | 'appleClientId' | 'jwtSecret'>;

/** Qué variables faltan para canjear y revocar (vacío = configurado). */
export function missingAppleRevocationVars(c: RevocationConfig): string[] {
  const out: string[] = [];
  if (!c.appleTeamId) out.push('APPLE_TEAM_ID');
  if (!c.appleKeyId) out.push('APPLE_KEY_ID');
  if (!c.applePrivateKey) out.push('APPLE_PRIVATE_KEY');
  if (!c.appleClientId) out.push('APPLE_CLIENT_ID (o APPLE_AUDIENCES)');
  return out;
}

/**
 * Cifrado del refresh token de Apple: AES-256-GCM con una clave derivada (HKDF-SHA256) de JWT_SECRET.
 * Si JWT_SECRET cambia, los tokens guardados ya no se pueden descifrar: la revocación de esas cuentas
 * se omite con un aviso (también se cierran todas las sesiones, así que es un cambio poco frecuente).
 */
export class TokenCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = Buffer.from(hkdfSync('sha256', secret, 'touched-block', 'apple-refresh-token-v1', 32));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return [ENC_PREFIX, iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':');
  }

  /** null si el texto no tiene el formato o no se puede descifrar (otra clave, datos alterados). */
  decrypt(enc: string): string | null {
    const [v, iv, tag, ct] = enc.split(':');
    if (v !== ENC_PREFIX || !iv || !tag || ct === undefined) return null;
    try {
      const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
      d.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}

@Injectable()
export class AppleTokensService {
  private readonly log = new Logger('AppleTokens');
  private readonly fetchFn: FetchFn;
  private readonly cipher: TokenCipher;
  private secret: { value: string; until: number } | null = null;
  private warned = false;

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    @Optional() @Inject(APPLE_FETCH) fetchFn?: FetchFn,
  ) {
    this.fetchFn = fetchFn ?? ((...a) => fetch(...a));
    this.cipher = new TokenCipher(config.jwtSecret);
  }

  /** true si están las variables para canjear y revocar. */
  get enabled(): boolean {
    const missing = missingAppleRevocationVars(this.config);
    if (missing.length > 0 && !this.warned) {
      this.warned = true;
      this.log.warn(`Revocación de Sign in with Apple desactivada: faltan ${missing.join(', ')}.`);
    }
    return missing.length === 0;
  }

  /** client_secret para /auth/token y /auth/revoke (JWT ES256, se reutiliza mientras le quede tiempo). */
  async clientSecret(nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
    if (this.secret && this.secret.until > nowSec + 60) return this.secret.value;
    const key = await importPKCS8(this.config.applePrivateKey, 'ES256');
    const value = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: this.config.appleKeyId })
      .setIssuer(this.config.appleTeamId)
      .setSubject(this.config.appleClientId)
      .setAudience(APPLE_ORIGIN)
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + SECRET_TTL_SEC)
      .sign(key);
    this.secret = { value, until: nowSec + SECRET_TTL_SEC };
    return value;
  }

  private async post(path: string, params: Record<string, string>): Promise<Response> {
    const body = new URLSearchParams({
      client_id: this.config.appleClientId,
      client_secret: await this.clientSecret(),
      ...params,
    });
    return this.fetchFn(`${APPLE_ORIGIN}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  /** Canjea el authorizationCode por el refresh token de Apple. Lanza si Apple responde con error. */
  async exchangeCode(code: string): Promise<string> {
    const res = await this.post('/auth/token', { grant_type: 'authorization_code', code });
    const data = (await res.json().catch(() => ({}))) as { refresh_token?: unknown; error?: unknown };
    if (!res.ok) throw new Error(`Apple /auth/token respondió ${res.status} (${String(data.error ?? 'sin detalle')})`);
    if (typeof data.refresh_token !== 'string' || !data.refresh_token) throw new Error('Apple /auth/token no entregó refresh_token');
    return data.refresh_token;
  }

  /** Revoca un refresh token de Apple. Lanza si Apple responde con error. */
  async revoke(refreshToken: string): Promise<void> {
    const res = await this.post('/auth/revoke', { token: refreshToken, token_type_hint: 'refresh_token' });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      throw new Error(`Apple /auth/revoke respondió ${res.status} (${String(data.error ?? 'sin detalle')})`);
    }
  }

  /**
   * Tras un login con Apple: canjea el código y guarda el refresh token cifrado en la identidad.
   * Nunca lanza (el login no depende de esto): los errores quedan en el log.
   */
  async storeFromCode(subject: string, code: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const token = await this.exchangeCode(code);
      await this.prisma.authIdentity.update({
        where: { provider_subject: { provider: 'apple', subject } },
        data: { providerRefreshToken: this.cipher.encrypt(token) },
      });
    } catch (e) {
      this.log.warn(`No se pudo guardar el token de Apple para revocarlo después: ${errText(e)}`);
    }
  }

  /**
   * Antes de borrar una cuenta: revoca los tokens de Apple guardados del usuario. Nunca lanza: si
   * Apple falla, se registra y la cuenta se borra igual.
   */
  async revokeForUser(userId: string): Promise<void> {
    const idents = await this.prisma.authIdentity.findMany({
      where: { userId, provider: 'apple' },
      select: { id: true, providerRefreshToken: true },
    });
    if (idents.length === 0) return;
    for (const ident of idents) {
      if (!ident.providerRefreshToken) {
        this.log.warn(`Cuenta de Apple sin token guardado (identidad ${ident.id}): no se revoca en Apple.`);
        continue;
      }
      if (!this.enabled) continue;
      const token = this.cipher.decrypt(ident.providerRefreshToken);
      if (!token) {
        this.log.warn(`No se pudo descifrar el token de Apple (identidad ${ident.id}; ¿cambió JWT_SECRET?): no se revoca.`);
        continue;
      }
      try {
        await this.revoke(token);
      } catch (e) {
        this.log.error(`Falló la revocación en Apple (identidad ${ident.id}); la cuenta se borra igual: ${errText(e)}`);
      }
    }
  }
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

@Module({
  providers: [AppleTokensService],
  exports: [AppleTokensService],
})
export class AppleTokensModule {}
