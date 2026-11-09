/**
 * Configuración de build. Expo incrusta en el bundle las variables `EXPO_PUBLIC_*` (solo si se
 * leen así, con `process.env.EXPO_PUBLIC_X` literal). Ver `.env.example`.
 */
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
const googleClientId = (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim();

export const config = {
  /** URL base de la API (sin `/` final), p. ej. `https://api.ejemplo.cl`. */
  apiUrl,
  /** Client ID web de OAuth de Google (Google Identity Services). */
  googleClientId,
  /** Solo desarrollo: muestra "Entrar (dev)" (la API debe correr con AUTH_DEV_FAKE=1). */
  authDevFake: process.env.EXPO_PUBLIC_AUTH_DEV_FAKE === '1',
  /** Dirección pública del juego (para compartir e invitar). */
  siteUrl: 'https://sukushaing.github.io/touched-block/',
} as const;

/**
 * Banderas de funciones. Sin API ni client ID de Google el juego funciona como antes: solo
 * invitado, con el historial local.
 */
export const features = {
  /** Cuentas, login, rankings, social y compartir: pestañas, aviso de la pantalla final y slides 6–7. */
  accounts: !!apiUrl && !!googleClientId,
} as const;
