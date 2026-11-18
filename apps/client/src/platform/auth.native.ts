import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { GoogleSignin, isCancelledResponse, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { config } from '@/config';
import type { AppleSignInResult, Auth } from './auth.types';

// App (Android): Google Sign-In nativo (Credential Manager). Se configura con el Client ID
// *web* (`webClientId`), así el idToken trae la misma audiencia que en la web y la API lo
// valida igual (`GOOGLE_CLIENT_IDS`). Google exige además un cliente OAuth "Android" en el
// mismo proyecto con el paquete `app.touchedblock` y la huella SHA-1 del certificado que firma
// el APK (hay uno para la clave debug y otro para la release; ver docs/despliegue.md).
// En iOS se pasa además el cliente OAuth "iOS" (`iosClientId`, no es secreto); con `webClientId` el
// idToken sigue teniendo como audiencia el cliente web, así que la API no cambia. El esquema de URL
// invertido de ese cliente va en app.json (`iosUrlScheme` del plugin de google-signin).
const IOS_GOOGLE_CLIENT_ID = '1065315828810-pgb0mm5hgvgpi6anuvkv3152q7j1qgka.apps.googleusercontent.com';
let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: config.googleClientId,
    ...(Platform.OS === 'ios' ? { iosClientId: IOS_GOOGLE_CLIENT_ID } : {}),
    offlineAccess: false,
  });
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

// Sign in with Apple (solo iOS; Apple lo exige si hay otro login social, guía 4.8). En Android el
// módulo nativo no existe e isAvailableAsync responde false, así que nunca se muestra el botón.
let appleCheck: Promise<boolean> | null = null;
function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  appleCheck ??= AppleAuthentication.isAvailableAsync().catch(() => false);
  return appleCheck;
}

const joinName = (n: AppleAuthentication.AppleAuthenticationFullName | null) =>
  [n?.givenName, n?.middleName, n?.familyName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 100) || null;

async function signInApple(): Promise<AppleSignInResult> {
  try {
    // El correo puede ser una dirección de reenvío privado (@privaterelay.appleid.com): se acepta igual.
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!c.identityToken) return { identityToken: null, error: 'Apple no entregó la credencial. Inténtalo de nuevo.' };
    return { identityToken: c.identityToken, authorizationCode: c.authorizationCode, fullName: joinName(c.fullName) };
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === 'ERR_REQUEST_CANCELED') return { identityToken: null };
    return { identityToken: null, error: 'No se pudo iniciar sesión con Apple. Revisa tu conexión e inténtalo de nuevo.' };
  }
}

export const auth: Auth = {
  googleAvailable: !!config.googleClientId,
  appleAvailable,
  ...(Platform.OS === 'ios' ? { signInApple } : {}),
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
