import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/app-config';
import { DevFakeGoogleVerifier, GoogleAuthLibraryVerifier, createGoogleVerifier, devFakeAuthEnabled } from './verifiers';

// Sin client IDs el verificador real responde 503 sin salir a la red.
const code = (p: Promise<unknown>) => p.then(
  () => 'ok',
  (e: { getResponse?: () => { code?: string } }) => e.getResponse?.().code,
);

const cfg = (over: Partial<AppConfig>) =>
  ({ nodeEnv: 'development', authDevFake: false, googleClientIds: [] as string[], ...over }) as AppConfig;

describe('login de desarrollo (AUTH_DEV_FAKE)', () => {
  it('está apagado por defecto', () => {
    expect(devFakeAuthEnabled(cfg({}))).toBe(false);
    expect(createGoogleVerifier(cfg({}))).toBeInstanceOf(GoogleAuthLibraryVerifier);
  });

  it('nunca se activa en producción, aunque AUTH_DEV_FAKE=1', async () => {
    const config = cfg({ nodeEnv: 'production', authDevFake: true });
    expect(devFakeAuthEnabled(config)).toBe(false);
    const v = createGoogleVerifier(config);
    expect(v).toBeInstanceOf(GoogleAuthLibraryVerifier);
    expect(await code(v.verify('dev:ana:Ana Pérez'))).toBe('provider_unavailable');
  });

  it('fuera de producción acepta dev:<sub>:<nombre> y delega el resto al verificador real', async () => {
    const v = createGoogleVerifier(cfg({ authDevFake: true }));
    expect(v).toBeInstanceOf(DevFakeGoogleVerifier);
    await expect(v.verify('dev:ana:Ana Pérez')).resolves.toEqual({ subject: 'dev:ana', name: 'Ana Pérez', email: null });
    expect(await code(v.verify('eyJhbGciOi.no-es-un-jwt.valido'))).toBe('provider_unavailable');
  });
});
