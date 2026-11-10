import { config } from '@/config';
import type { Auth } from './auth.types';

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

export const auth: Auth = {
  googleAvailable: !!config.googleClientId,
  appleAvailable: false,
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
