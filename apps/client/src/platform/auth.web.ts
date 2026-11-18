import { config } from '@/config';
import { appleWebName } from '@/lib/appleName';
import type { AppleSignInResult, Auth } from './auth.types';

// Google Identity Services (https://developers.google.com/identity/gsi/web). El script se carga
// solo cuando se muestra un botón de login.
const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GisId {
  initialize(cfg: Record<string, unknown>): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
type GisWindow = Window & { google?: { accounts?: { id?: GisId } } };

let loading: Promise<GisId> | null = null;

function loadGis(): Promise<GisId> {
  const w = window as GisWindow;
  if (w.google?.accounts?.id) return Promise.resolve(w.google.accounts.id);
  if (loading) return loading;
  loading = new Promise<GisId>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      const id = (window as GisWindow).google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('GIS sin google.accounts.id'));
    };
    s.onerror = () => reject(new Error('No se pudo cargar GIS'));
    document.head.appendChild(s);
  }).catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

let initialized = false;
// El callback de GIS es global: responde al último botón que se tocó.
let current: ((idToken: string) => void) | null = null;

function ensureInit(gis: GisId) {
  if (initialized) return;
  initialized = true;
  gis.initialize({
    client_id: config.googleClientId,
    callback: (resp: { credential?: string }) => {
      if (resp?.credential) current?.(resp.credential);
    },
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
    use_fedcm_for_button: true,
  });
}

// ---- Sign in with Apple JS ----
// https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple
// Flujo de ventana emergente (usePopup: true, response_mode web_message): Apple devuelve el código, el
// identityToken y (solo la 1.ª vez) el nombre a esta misma página; no hace falta ninguna ruta de retorno.
// El redirectURI igual tiene que estar registrado en el Services ID y ser del mismo origen que la
// página: Apple no acepta localhost ni IPs, así que solo funciona en https://web.touchedblock.app.
// El script se carga solo cuando se muestran las opciones de login (appleAvailable) y únicamente si
// hay Services ID: sin EXPO_PUBLIC_APPLE_SERVICES_ID la web se ve como antes.
const APPLE_JS_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
const appleEnabled = !!config.apiUrl && !!config.appleServicesId;

interface AppleSignInResponse {
  authorization?: { code?: string; id_token?: string; state?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
}
interface AppleIdAuth {
  init(cfg: Record<string, unknown>): void;
  signIn(): Promise<AppleSignInResponse>;
}
type AppleWindow = Window & { AppleID?: { auth?: AppleIdAuth } };

let appleLoading: Promise<AppleIdAuth> | null = null;

function loadAppleJs(): Promise<AppleIdAuth> {
  const ready = (window as AppleWindow).AppleID?.auth;
  if (ready) return Promise.resolve(ready);
  if (appleLoading) return appleLoading;
  appleLoading = new Promise<AppleIdAuth>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = APPLE_JS_SRC;
    s.async = true;
    s.onload = () => {
      const a = (window as AppleWindow).AppleID?.auth;
      if (a) resolve(a);
      else reject(new Error('Sign in with Apple JS sin AppleID.auth'));
    };
    s.onerror = () => reject(new Error('No se pudo cargar Sign in with Apple JS'));
    document.head.appendChild(s);
  }).catch((e: unknown) => {
    appleLoading = null;
    throw e;
  });
  return appleLoading;
}

function randomState(): string {
  try {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  }
}

const APPLE_NET_ERROR = 'No se pudo iniciar sesión con Apple. Revisa tu conexión e inténtalo de nuevo.';

async function signInAppleWeb(): Promise<AppleSignInResult> {
  // Si el script ya está (se precarga al mostrar el botón), la ventana se abre sin ninguna espera
  // antes: así sigue "dentro" del toque y el navegador no la bloquea.
  let a = (window as AppleWindow).AppleID?.auth;
  if (!a) {
    try {
      a = await loadAppleJs();
    } catch {
      return { identityToken: null, error: APPLE_NET_ERROR };
    }
  }
  const state = randomState();
  // mismo origen que la página (lo exige web_message); registrado tal cual en el Services ID
  const redirectUri = `${window.location.origin}/`;
  try {
    a.init({ clientId: config.appleServicesId, scope: 'name email', redirectURI: redirectUri, state, usePopup: true });
    const r = await a.signIn();
    const token = r?.authorization?.id_token;
    if (!token || r.authorization?.state !== state) {
      return { identityToken: null, error: 'Apple no entregó la credencial. Inténtalo de nuevo.' };
    }
    return {
      identityToken: token,
      authorizationCode: r.authorization?.code ?? null,
      fullName: appleWebName(r.user),
      redirectUri,
    };
  } catch (e) {
    const code = (e as { error?: string } | null)?.error;
    // cerró la ventana o tocó "Cancelar": no es un error
    if (code === 'popup_closed_by_user' || code === 'user_cancelled_authorize' || code === 'user_trigger_new_signin_flow') {
      return { identityToken: null };
    }
    if (code === 'popup_blocked_by_browser') {
      return { identityToken: null, error: 'El navegador bloqueó la ventana de Apple. Permite las ventanas emergentes e inténtalo de nuevo.' };
    }
    return { identityToken: null, error: APPLE_NET_ERROR };
  }
}

function appleAvailableWeb(): Promise<boolean> {
  if (!appleEnabled) return Promise.resolve(false);
  // precarga el script para que el toque abra la ventana sin esperas
  void loadAppleJs().catch(() => {});
  return Promise.resolve(true);
}

export const auth: Auth = {
  googleAvailable: !!config.googleClientId,
  // Sign in with Apple en la web: solo con Services ID (EXPO_PUBLIC_APPLE_SERVICES_ID) y API.
  appleAvailable: appleAvailableWeb,
  ...(appleEnabled ? { signInApple: signInAppleWeb } : {}),
  renderGoogleButton(host, opts, onCredential, onError) {
    let alive = true;
    const el = host as HTMLElement | null;
    if (!el || typeof el.appendChild !== 'function') return () => {};
    loadGis()
      .then((gis) => {
        if (!alive) return;
        try {
          ensureInit(gis);
          el.innerHTML = '';
          // La página es color-scheme: dark y el iframe de Google es claro: si no coinciden, el
          // navegador pinta un fondo blanco opaco detrás del iframe (el "borde blanco" del botón).
          el.style.colorScheme = 'light';
          gis.renderButton(el, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: opts.text ?? 'signin_with',
            logo_alignment: 'left',
            locale: 'es',
            width: Math.round(Math.max(200, Math.min(400, opts.width))),
            click_listener: () => {
              current = onCredential;
            },
          });
          current = onCredential;
        } catch {
          onError('No se pudo mostrar el botón de Google.');
        }
      })
      .catch(() => {
        if (alive) onError('No se pudo cargar el inicio de sesión con Google. Revisa tu conexión.');
      });
    return () => {
      alive = false;
      if (current === onCredential) current = null;
      try {
        el.innerHTML = '';
      } catch {}
    };
  },
};
