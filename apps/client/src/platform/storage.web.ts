import type { Storage } from './storage.types';

// localStorage puede no existir o lanzar (modo privado, cookies bloqueadas): siempre try/catch.
export const storage: Storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};
