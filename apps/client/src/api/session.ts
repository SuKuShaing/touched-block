import { useSyncExternalStore } from 'react';
import { storage } from '@/platform/storage';
import type { LoginResponse, Me } from './types';

/**
 * Sesión: el access token vive solo en memoria; el refresh token (rota en cada uso) y una copia
 * del usuario quedan en el almacenamiento para seguir con la sesión al volver a abrir la web.
 */
const RT_KEY = 'tb_rt1';
const ME_KEY = 'tb_me1';

export interface SessionState {
  /** `authed` si hay refresh token guardado (aunque el usuario aún no se haya cargado). */
  status: 'guest' | 'authed';
  user: Me | null;
}

function readUser(): Me | null {
  try {
    const raw = storage.get(ME_KEY);
    const u = raw ? (JSON.parse(raw) as Me) : null;
    return u && typeof u.id === 'string' && typeof u.username === 'string' ? u : null;
  } catch {
    return null;
  }
}

let state: SessionState = storage.get(RT_KEY) ? { status: 'authed', user: readUser() } : { status: 'guest', user: null };
let access: { token: string; exp: number } | null = null;
const listeners = new Set<() => void>();

function emit(next: SessionState) {
  state = next;
  for (const l of listeners) {
    try {
      l();
    } catch {}
  }
}

export const session = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  /** Access token vigente (con 20 s de margen) o null. */
  accessToken(): string | null {
    return access && access.exp - 20_000 > Date.now() ? access.token : null;
  },
  refreshToken: () => storage.get(RT_KEY),
  /** Guarda la sesión de un login o refresh. */
  apply(r: LoginResponse) {
    access = { token: r.accessToken, exp: Date.now() + r.accessTokenExpiresIn * 1000 };
    storage.set(RT_KEY, r.refreshToken);
    storage.set(ME_KEY, JSON.stringify(r.user));
    emit({ status: 'authed', user: r.user });
  },
  setUser(user: Me) {
    if (state.status !== 'authed') return;
    storage.set(ME_KEY, JSON.stringify(user));
    emit({ status: 'authed', user });
  },
  /** Cierra la sesión local (sin llamar a la API). */
  clear() {
    access = null;
    storage.remove(RT_KEY);
    storage.remove(ME_KEY);
    if (state.status !== 'guest' || state.user) emit({ status: 'guest', user: null });
  },
};

/** Estado de la sesión para React. */
export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}
