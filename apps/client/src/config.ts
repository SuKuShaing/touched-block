/**
 * Configuración de build. Expo incrusta en el bundle las variables `EXPO_PUBLIC_*` (solo si se
 * leen así, con `process.env.EXPO_PUBLIC_X` literal). Ver `.env.example`.
 */
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
const googleClientId = (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();
const appleServicesId = (process.env.EXPO_PUBLIC_APPLE_SERVICES_ID ?? '').trim();

export const config = {
  /** URL base de la API (sin `/` final), p. ej. `https://api.ejemplo.cl`. */
  apiUrl,
  /** Client ID web de OAuth de Google (Google Identity Services). */
  googleClientId,
  /**
   * Solo web: Services ID de Sign in with Apple (p. ej. `app.touchedblock.web`). Vacío = la web no
   * muestra el botón de Apple. La app iOS no lo usa (pide el login con el bundle ID).
   */
  appleServicesId,
  /** Solo desarrollo: muestra "Entrar (dev)" (la API debe correr con AUTH_DEV_FAKE=1). */
  authDevFake: process.env.EXPO_PUBLIC_AUTH_DEV_FAKE === '1',
  /**
   * Solo el APK de prueba: todos los premios desbloqueados y rótulo "MODO PRUEBA". Nunca en una
   * versión publicada (lo vigila `lib/unlockGuard.test.ts`).
   */
  unlockAll: process.env.EXPO_PUBLIC_UNLOCK_ALL === '1',
  /** Dirección pública del juego (para compartir e invitar). Con `/` al final. */
  siteUrl: 'https://web.touchedblock.app/',
  /** Sitio principal (landing), donde viven las páginas legales. Con `/` al final. */
  landingUrl: 'https://touchedblock.app/',
} as const;

/**
 * Banderas de funciones. Sin API ni client ID de Google el juego funciona como antes: solo
 * invitado, con el historial local.
 */
export const features = {
  /** Cuentas, login, rankings, social y compartir: pestañas, aviso de la pantalla final y slides 6–7. */
  accounts: !!apiUrl && !!googleClientId,
} as const;
