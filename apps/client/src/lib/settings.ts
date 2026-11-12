import { useSyncExternalStore } from 'react';
import { storage } from '@/platform/storage';

/**
 * Ajustes de este dispositivo (clave `tb_set1`): sonido, vibración y los premios elegidos.
 * No dependen de la versión de reglas. Los ids de premios vienen de `cosmetics/catalog.ts`;
 * si un id guardado ya no existe o no está desbloqueado, quien lo usa cae al valor por defecto.
 */
export const SETTINGS_KEY = 'tb_set1';

export interface Settings {
  /** Sonidos del juego. */
  sound: boolean;
  /** Vibración. */
  haptics: boolean;
  /** Paleta de los bloques (id del catálogo). */
  palette: string;
  /** Paquete de sonidos (id del catálogo). */
  soundPack: string;
  /** Efecto al destruir un bloque (id del catálogo). */
  effect: string;
  /** Fondo del campo (id del catálogo). */
  background: string;
  /** El jugador descartó para siempre la tarjeta de instalar la web. */
  installDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  haptics: true,
  palette: 'clasica',
  soundPack: '8bits',
  effect: 'normal',
  background: 'liso',
  installDismissed: false,
};

function read(): Settings {
  try {
    const raw: unknown = JSON.parse(storage.get(SETTINGS_KEY) || '{}');
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const out = { ...DEFAULT_SETTINGS };
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      if (typeof o[k] === typeof DEFAULT_SETTINGS[k]) (out as Record<string, unknown>)[k] = o[k];
    }
    return out;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let current: Settings | null = null;
const listeners = new Set<() => void>();

/** Ajustes actuales (se leen una vez y quedan en memoria). */
export function getSettings(): Settings {
  if (!current) current = read();
  return current;
}

/** Cambia uno o más ajustes, los guarda y avisa a quien escuche. */
export function updateSettings(patch: Partial<Settings>): Settings {
  current = { ...getSettings(), ...patch };
  try {
    storage.set(SETTINGS_KEY, JSON.stringify(current));
  } catch {}
  listeners.forEach((l) => l());
  return current;
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Hook: ajustes actuales, se vuelve a dibujar al cambiar. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
