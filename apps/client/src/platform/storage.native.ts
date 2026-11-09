import type { Storage } from './storage.types';

// Versión mínima para nativo: en memoria (se pierde al cerrar la app). En la fase app se
// cambia por un almacenamiento persistente (expo-secure-store / MMKV).
const mem = new Map<string, string>();

export const storage: Storage = {
  get: (key) => mem.get(key) ?? null,
  set: (key, value) => void mem.set(key, value),
  remove: (key) => void mem.delete(key),
};
