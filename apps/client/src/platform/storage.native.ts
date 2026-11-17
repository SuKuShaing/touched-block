import { Storage as KV } from 'expo-sqlite/kv-store';
import type { Storage } from './storage.types';

// Equivalente nativo de localStorage: el almacén clave/valor de expo-sqlite, persistente y con
// API síncrona (la interfaz `Storage` es síncrona y se usa al cargar los módulos). Mismas claves
// que en la web. Siempre try/catch: si la base falla, devuelve null o no guarda, nunca lanza.
export const storage: Storage = {
  get(key) {
    try {
      return KV.getItemSync(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      KV.setItemSync(key, value);
    } catch {}
  },
  remove(key) {
    try {
      KV.removeItemSync(key);
    } catch {}
  },
};
