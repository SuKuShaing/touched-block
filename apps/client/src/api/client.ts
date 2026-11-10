import { config } from '@/config';
import { session } from './session';
import type { LoginResponse } from './types';

/** Error de la API (o de red) con un mensaje en español listo para mostrar. */
export class ApiError extends Error {
  constructor(
    /** HTTP status; 0 si no hubo respuesta (sin red, tiempo agotado, sin API). */
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** Mensaje para mostrar de cualquier error. */
export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Sesión: `none` nunca manda el token; `optional` lo manda si hay sesión; `required` exige sesión. */
export type AuthMode = 'none' | 'optional' | 'required';

export interface RequestOpts {
  body?: unknown;
  auth?: AuthMode;
  signal?: AbortSignal;
  /** Tiempo máximo de la petición (por defecto 15 s). */
  timeoutMs?: number;
}

const GENERIC: Record<number, string> = {
  401: 'Debes iniciar sesión.',
  404: 'No se encontró.',
  429: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.',
};

async function rawFetch(method: string, path: string, body: unknown, token: string | null, opts: RequestOpts) {
  if (!config.apiUrl) throw new ApiError(0, 'no_api', 'El servidor no está configurado.');
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? 15_000);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(config.apiUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch {
      if (timedOut) throw new ApiError(0, 'timeout', 'El servidor tardó demasiado en responder.');
      if (opts.signal?.aborted) throw new ApiError(0, 'aborted', 'Petición cancelada.');
      throw new ApiError(0, 'network', 'No se pudo conectar con el servidor. Revisa tu conexión.');
    }
    let data: Record<string, unknown> = {};
    if (res.status !== 204) {
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = {};
      }
    }
    return { status: res.status, ok: res.ok, data };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

function toError(status: number, data: Record<string, unknown>) {
  const code = typeof data.code === 'string' ? data.code : 'http_' + status;
  const message =
    typeof data.message === 'string' && data.message
      ? data.message
      : (GENERIC[status] ?? (status >= 500 ? 'El servidor tuvo un problema. Inténtalo más tarde.' : 'No se pudo completar la acción.'));
  return new ApiError(status, code, message, data);
}

// ---- refresh con una sola petición en vuelo ----

let refreshing: Promise<void> | null = null;

async function doRefresh(): Promise<void> {
  let rt = session.refreshToken();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!rt) break;
    const r = await rawFetch('POST', '/auth/refresh', { refreshToken: rt }, null, { timeoutMs: 10_000 });
    if (r.ok) {
      session.apply(r.data as unknown as LoginResponse);
      return;
    }
    if (r.status !== 401) throw toError(r.status, r.data);
    // Otra pestaña pudo rotarlo: si en el almacenamiento hay uno distinto, se prueba con ese.
    const now = session.refreshToken();
    if (!now || now === rt) break;
    rt = now;
  }
  session.clear();
  throw new ApiError(401, 'invalid_refresh_token', 'Tu sesión expiró. Vuelve a iniciar sesión.');
}

/** Renueva la sesión (una sola petición a la vez; las demás esperan su resultado). */
export function refreshSession(): Promise<void> {
  if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null));
  return refreshing;
}

/** Access token válido, renovándolo si hace falta. null si no hay sesión. */
async function accessToken(): Promise<string | null> {
  if (session.get().status !== 'authed') return null;
  const t = session.accessToken();
  if (t) return t;
  await refreshSession();
  return session.accessToken();
}

/** Petición JSON a la API. Lanza ApiError (nunca otra cosa). */
export async function api<T>(method: string, path: string, opts: RequestOpts = {}): Promise<T> {
  const auth = opts.auth ?? 'optional';
  let token: string | null = null;
  if (auth !== 'none') {
    try {
      token = await accessToken();
    } catch (e) {
      // sesión inválida: ya quedó como invitado
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
    if (!token && auth === 'required') throw new ApiError(401, 'unauthorized', 'Debes iniciar sesión.');
  }
  let r = await rawFetch(method, path, opts.body, token, opts);
  if (r.status === 401 && token && r.data.code === 'invalid_access_token') {
    try {
      await refreshSession();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && auth === 'optional') {
        // se cerró la sesión: se reintenta como invitado
        r = await rawFetch(method, path, opts.body, null, opts);
        if (r.ok) return r.data as T;
        throw toError(r.status, r.data);
      }
      throw e;
    }
    r = await rawFetch(method, path, opts.body, session.accessToken(), opts);
  }
  if (!r.ok) throw toError(r.status, r.data);
  return r.data as T;
}

/** Calienta la sesión (renueva el access token si venció) sin lanzar errores. */
export function warmSession() {
  warmConnection();
  if (!config.apiUrl || session.get().status !== 'authed' || session.accessToken()) return;
  refreshSession().catch(() => {});
}

/** Cada cuánto se vuelve a abrir la conexión con la API (los navegadores cierran las inactivas). */
const WARM_EVERY_MS = 60_000;
let lastWarm = 0;

/**
 * Abre de antemano la conexión con la API (DNS + TCP + TLS) con un GET /health sin cabeceras
 * extra (no necesita preflight de CORS). En frío, el primer POST /runs tardaba ~1,5 s y la
 * partida empezaba sin semilla del servidor; con la conexión abierta tarda ~0,15 s.
 */
export function warmConnection() {
  if (!config.apiUrl) return;
  const now = Date.now();
  if (now - lastWarm < WARM_EVERY_MS) return;
  lastWarm = now;
  try {
    fetch(config.apiUrl + '/health', { method: 'GET', cache: 'no-store' }).catch(() => {});
  } catch {
    // sin red: la partida igual empieza con semilla local
  }
}
