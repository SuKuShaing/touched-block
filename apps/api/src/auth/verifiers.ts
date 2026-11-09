import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError, unauthorized } from '../common/errors';
import { AppConfig } from '../config/app-config';

/** Identidad verificada por un proveedor externo. */
export interface VerifiedIdentity {
  subject: string;
  email?: string | null;
  name?: string | null;
}

/**
 * Verificador del idToken de Google. Es una clase abstracta para poder inyectarla y
 * reemplazarla en los tests (`overrideProvider(GoogleVerifier)`).
 */
export abstract class GoogleVerifier {
  abstract verify(idToken: string): Promise<VerifiedIdentity>;
}

/** Verificador del identityToken de Sign in with Apple (mismo patrón que Google). */
export abstract class AppleVerifier {
  abstract verify(identityToken: string): Promise<VerifiedIdentity>;
}

const unavailable = (provider: string) =>
  new ApiError(
    HttpStatus.SERVICE_UNAVAILABLE,
    'provider_unavailable',
    `El inicio de sesión con ${provider} no está disponible.`,
  );
const invalidToken = () =>
  unauthorized('No se pudo verificar tu inicio de sesión. Inténtalo de nuevo.', 'invalid_provider_token');

@Injectable()
export class GoogleAuthLibraryVerifier extends GoogleVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: AppConfig) {
    super();
  }

  async verify(idToken: string): Promise<VerifiedIdentity> {
    if (this.config.googleClientIds.length === 0) throw unavailable('Google');
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.config.googleClientIds });
      payload = ticket.getPayload();
    } catch {
      throw invalidToken();
    }
    if (!payload?.sub) throw invalidToken();
    const name = payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(' ') || null;
    return { subject: payload.sub, email: payload.email ?? null, name };
  }
}

const APPLE_ISSUER = 'https://appleid.apple.com';

@Injectable()
export class JoseAppleVerifier extends AppleVerifier {
  private readonly jwks = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

  constructor(private readonly config: AppConfig) {
    super();
  }

  async verify(identityToken: string): Promise<VerifiedIdentity> {
    if (this.config.appleAudiences.length === 0) throw unavailable('Apple');
    try {
      const { payload } = await jwtVerify(identityToken, this.jwks, {
        issuer: APPLE_ISSUER,
        audience: this.config.appleAudiences,
      });
      if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('sin sub');
      const email = typeof payload.email === 'string' ? payload.email : null;
      // Apple solo entrega el nombre en el primer inicio de sesión, y fuera del token (fullName).
      return { subject: payload.sub, email, name: null };
    } catch {
      throw invalidToken();
    }
  }
}

/** true si se acepta el login de desarrollo (`dev:<sub>:<nombre>`): AUTH_DEV_FAKE=1 y nunca en producción. */
export const devFakeAuthEnabled = (config: Pick<AppConfig, 'authDevFake' | 'nodeEnv'>) =>
  config.authDevFake && config.nodeEnv !== 'production';

const DEV_TOKEN = /^dev:([a-z0-9_.-]{1,64}):(.{1,60})$/;

/**
 * Solo para desarrollo local (AUTH_DEV_FAKE=1 y NODE_ENV distinto de production): acepta
 * idTokens con la forma `dev:<sub>:<nombre>` sin hablar con Google, para poder probar el
 * login de punta a punta. Cualquier otro token pasa al verificador real.
 */
export class DevFakeGoogleVerifier extends GoogleVerifier {
  constructor(private readonly real: GoogleVerifier) {
    super();
  }

  async verify(idToken: string): Promise<VerifiedIdentity> {
    const m = DEV_TOKEN.exec(idToken);
    if (!m) return this.real.verify(idToken);
    return { subject: `dev:${m[1]}`, name: m[2].trim() || null, email: null };
  }
}

/** Elige el verificador de Google según la configuración (el falso solo fuera de producción). */
export function createGoogleVerifier(config: AppConfig): GoogleVerifier {
  const real = new GoogleAuthLibraryVerifier(config);
  if (!devFakeAuthEnabled(config)) return real;
  new Logger('Auth').warn('AUTH_DEV_FAKE=1: /auth/google acepta tokens de desarrollo (dev:<sub>:<nombre>). Nunca en producción.');
  return new DevFakeGoogleVerifier(real);
}
