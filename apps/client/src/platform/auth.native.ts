import { GoogleSignin, isCancelledResponse, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { config } from '@/config';
import type { Auth } from './auth.types';

// App (Android): Google Sign-In nativo (Credential Manager). Se configura con el Client ID
// *web* (`webClientId`), así el idToken trae la misma audiencia que en la web y la API lo
// valida igual (`GOOGLE_CLIENT_IDS`). Google exige además un cliente OAuth "Android" en el
// mismo proyecto con el paquete `app.touchedblock` y la huella SHA-1 del certificado que firma
// el APK (hay uno para la clave debug y otro para la release; ver docs/despliegue.md).
let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: config.googleClientId, offlineAccess: false });
  // después de configurar: si falla, el próximo intento vuelve a probar
  configured = true;
}

function messageFor(e: unknown): string | null {
  const code = (e as { code?: string } | null)?.code;
  if (code === statusCodes.SIGN_IN_CANCELLED) return null;
  if (code === statusCodes.IN_PROGRESS) return null;
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Este teléfono no tiene los servicios de Google Play al día.';
  return 'No se pudo iniciar sesión con Google. Revisa tu conexión e inténtalo de nuevo.';
}

export const auth: Auth = {
  googleAvailable: !!config.googleClientId,
  appleAvailable: false,
  // En nativo no hay botón dentro de un View del DOM: la UI usa `signInGoogle` (GoogleButton.native).
  renderGoogleButton: () => () => {},
  async signInGoogle() {
    try {
      ensureConfigured();
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const r = await GoogleSignin.signIn();
      if (isCancelledResponse(r)) return { idToken: null };
      if (isSuccessResponse(r) && r.data.idToken) return { idToken: r.data.idToken };
      return { idToken: null, error: 'Google no entregó la credencial. Inténtalo de nuevo.' };
    } catch (e) {
      const m = messageFor(e);
      return m ? { idToken: null, error: m } : { idToken: null };
    }
  },
  async signOut() {
    try {
      ensureConfigured();
      await GoogleSignin.signOut();
    } catch {}
  },
};
