import { useSyncExternalStore } from 'react';
import { storage } from '@/platform/storage';
import type { CatalogStats } from '@/cosmetics/catalog';
import {
  type Celebration,
  type Snapshot,
  accountCelebrations,
  celebrationFromKey,
  outsideCelebrations,
  pendingCelebrations,
  pendingKey,
} from './celebrations';
import type { PrizeContext } from './endPrize';

/**
 * Cola de celebraciones por mostrar y registro de lo ya celebrado en este dispositivo.
 *
 * `tb_cele2` guarda las claves ya celebradas (`celebrations.ts`), un arreglo JSON de strings.
 * La primera vez se siembra con lo que el jugador ya tiene (`seedCelebrated`), para que quien
 * ya jugaba no reciba de golpe todo lo que ganó antes. Si el almacenamiento falla, se sigue con
 * lo que hay en memoria. La `tb_cele1` de antes del reinicio de datos ya no se lee.
 *
 * `tb_cele2p` guarda las claves de la cola que todavía no se ven: si se cierra la app (o se
 * recarga la web) justo después de la partida, se muestran al volver a abrirla.
 */
export const CELEBRATED_KEY = 'tb_cele2';
export const PENDING_KEY = 'tb_cele2p';
/** Tope de claves guardadas (hoy son menos de 100 posibles: sobra). */
const MAX_KEYS = 500;

/** Lee `tb_cele2`: null si no existe o está dañado (entonces se siembra). */
export function parseCelebrated(raw: string | null): Set<string> | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    return new Set(v.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length < 80).slice(0, MAX_KEYS));
  } catch {
    return null;
  }
}

let seen: Set<string> | null = null;

function load(): Set<string> | null {
  if (!seen) {
    try {
      seen = parseCelebrated(storage.get(CELEBRATED_KEY));
    } catch {
      seen = null;
    }
  }
  return seen;
}

function save() {
  if (!seen) return;
  try {
    storage.set(CELEBRATED_KEY, JSON.stringify([...seen].slice(0, MAX_KEYS)));
  } catch {}
}

/** Siembra el registro si todavía no existe (`keys`: lo que el jugador ya tiene). */
export function seedCelebrated(keys: () => readonly string[]) {
  if (load()) return;
  try {
    seen = new Set(keys());
  } catch {
    seen = new Set();
  }
  save();
}

/** Suma claves al registro sin celebrarlas. */
export function absorbCelebrated(keys: readonly string[]) {
  const s = load() ?? new Set<string>();
  seen = s;
  let changed = false;
  for (const k of keys) {
    if (!s.has(k)) {
      s.add(k);
      changed = true;
    }
  }
  if (changed) save();
}

// ---------------------------------------------------------------- cola

export interface CelebrationQueue {
  items: readonly Celebration[];
  /** No se muestran antes de este instante (ms; el resultado de la partida se ve primero). */
  readyAt: number;
}

let queue: CelebrationQueue | null = null;

/** La cola guardada (sin las claves que ya no existen). */
function restore(): CelebrationQueue {
  let items: Celebration[] = [];
  try {
    const keys = parseCelebrated(storage.get(PENDING_KEY));
    if (keys) items = [...keys].map(celebrationFromKey).filter((c): c is Celebration => c !== null);
  } catch {}
  return { items, readyAt: 0 };
}

function current(): CelebrationQueue {
  if (!queue) queue = restore();
  return queue;
}
const listeners = new Set<() => void>();

function emit(next: CelebrationQueue) {
  queue = next;
  try {
    if (next.items.length) storage.set(PENDING_KEY, JSON.stringify(next.items.map(pendingKey)));
    else storage.remove(PENDING_KEY);
  } catch {}
  listeners.forEach((l) => {
    try {
      l();
    } catch {}
  });
}

/**
 * Agrega celebraciones a la cola, sin las ya celebradas, y las deja registradas (así no se
 * repiten aunque se cierre la app antes de verlas). `delayMs`: espera antes de mostrarlas.
 * Devuelve cuántas quedaron por mostrar.
 */
export function offerCelebrations(list: readonly Celebration[], delayMs = 0, now = Date.now()): number {
  if (!list.length) return 0;
  const { show, mark } = pendingCelebrations(list, load() ?? new Set());
  absorbCelebrated(mark);
  if (!show.length) return 0;
  const q = current();
  const readyAt = q.items.length ? Math.min(q.readyAt, now + delayMs) : now + delayMs;
  emit({ items: [...q.items, ...show], readyAt });
  return show.length;
}

// ---------------------------------------------------------------- lo ganado fuera de la partida

/**
 * Tiempo después de terminar una partida en que se celebra lo que llega tarde por ella (una paleta
 * por los bloques extra de una misión, el mejor resultado de un reto como invitado). Fuera de esa
 * ventana esos cambios del dispositivo se registran sin celebrar.
 */
export const AFTER_RUN_MS = 120_000;
let armedUntil = 0;
/** Hasta este instante se mira el resultado de la última partida: nada se muestra antes. */
let resultUntil = 0;
let prevSnap: Snapshot | null = null;

/**
 * Celebraciones de una partida que terminó: las ofrece y abre la ventana de `AFTER_RUN_MS`. Lo que
 * haya llegado a la cola durante la partida también espera `delayMs`.
 */
export function offerRunCelebrations(list: readonly Celebration[], delayMs = 0, now = Date.now()): number {
  armedUntil = now + AFTER_RUN_MS;
  resultUntil = now + delayMs;
  const n = offerCelebrations(list, delayMs, now);
  const q = current();
  if (q.items.length && q.readyAt < resultUntil) emit({ items: q.items, readyAt: resultUntil });
  return n;
}

/** Empezó otra partida: lo que cambie desde ahora ya no es de la anterior. */
export function disarmCelebrations() {
  armedUntil = 0;
}

/**
 * Lo que tiene el jugador ahora (cada vez que cambia). Siembra `tb_cele2` la primera vez con todo
 * lo que ya tiene (`owned`), en silencio. Después celebra:
 * - lo que cambió en los datos de ESTE dispositivo (`local`), solo dentro de la ventana después de
 *   una partida;
 * - con sesión (`account`: las estadísticas con las de la cuenta), los premios por invitar y por el
 *   porcentaje del reto que todavía no estén registrados, cuando sea que lleguen.
 *
 * Todo lo demás que tenga se registra sin celebrar: partidas de otro dispositivo, datos migrados.
 * Devuelve cuántas celebraciones agregó.
 */
export function observeCelebrations(
  input: { viewer: string; local: CatalogStats; account?: CatalogStats | null; owned: () => readonly string[] },
  ctx: PrizeContext,
  now = Date.now(),
): number {
  seedCelebrated(input.owned);
  const snap: Snapshot = { viewer: input.viewer, stats: input.local };
  const found = [
    ...(now < armedUntil ? outsideCelebrations(prevSnap, snap, ctx) : []),
    ...(input.account ? accountCelebrations(input.account, ctx) : []),
  ];
  prevSnap = snap;
  const n = offerCelebrations(found, Math.max(0, resultUntil - now), now);
  absorbCelebrated(input.owned());
  return n;
}

/** Saca las primeras `n` celebraciones (las que ya se mostraron). */

export function dropCelebrations(n: number) {
  const q = current();
  if (n <= 0 || !q.items.length) return;
  emit({ items: q.items.slice(n), readyAt: q.readyAt });
}

export const getCelebrationQueue = (): CelebrationQueue => current();

export function subscribeCelebrations(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function useCelebrationQueue(): CelebrationQueue {
  return useSyncExternalStore(subscribeCelebrations, getCelebrationQueue, getCelebrationQueue);
}

/** Solo para los tests: vuelve al estado inicial (sin registro en memoria y cola vacía). */
export function resetCelebrationsForTests() {
  seen = null;
  queue = null;
  armedUntil = 0;
  resultUntil = 0;
  prevSnap = null;
}
