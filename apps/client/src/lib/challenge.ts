import { storage } from '@/platform/storage';
import { SITE_URL } from './shareText';

/**
 * Reto a un amigo (plan, fase 3.3): el enlace, sus textos y el código pendiente mientras se ve
 * el tutorial. Funciones puras salvo las de `tb_reto1` (almacenamiento, con try/catch).
 */

/** Parámetro del enlace: `https://sukushaing.github.io/touched-block/?reto=K7M2QXAB`. Va por parámetro y no por ruta: en GitHub Pages una ruta responde 404 y rompe la vista previa en WhatsApp. */
export const CHALLENGE_PARAM = 'reto';

/** Mismo alfabeto y largo que la API (`challenge-code.ts`): sin I, L, O, 0 ni 1. */
export const CHALLENGE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CHALLENGE_CODE_LENGTH = 8;
const CODE_RE = new RegExp(`^[${CHALLENGE_CODE_ALPHABET}]{${CHALLENGE_CODE_LENGTH}}$`);

/**
 * Código de reto normalizado (mayúsculas, sin espacios ni guiones), o null si no tiene la forma de
 * un código. Así un enlace mal copiado no hace una petición inútil.
 */
export function parseChallengeCode(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return null;
  const code = v.replace(/[\s-]+/g, '').toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** Lee el parámetro `reto` de una query (`"?reto=k7m2qxab&x=1"`) o de los parámetros de la ruta. */
export function readChallengeParam(src: string | Record<string, unknown> | null | undefined): string | null {
  if (!src) return null;
  if (typeof src !== 'string') return parseChallengeCode(src[CHALLENGE_PARAM]);
  const q = src.startsWith('?') ? src.slice(1) : src;
  for (const part of q.split('&')) {
    const eq = part.indexOf('=');
    const k = eq < 0 ? part : part.slice(0, eq);
    if (k !== CHALLENGE_PARAM) continue;
    try {
      return parseChallengeCode(decodeURIComponent((eq < 0 ? '' : part.slice(eq + 1)).replace(/\+/g, ' ')));
    } catch {
      return null;
    }
  }
  return null;
}

/** Enlace del reto. En desarrollo también apunta al sitio publicado (está bien). */
export const challengeLink = (code: string, site = SITE_URL) => `${site}?${CHALLENGE_PARAM}=${code}`;

const bloques = (n: number) => `${n} ${n === 1 ? 'bloque' : 'bloques'}`;

/** Texto que acompaña el enlace al crear un reto. */
export const challengeShareText = (killed: number) =>
  `Hice ${bloques(killed)} en este reto de Touched Block. Juega la misma partida y supérame`;

// ---------------------------------------------------------------- resultados

/** Resultado de alguien en el reto (como `ChallengeEntry` de la API). */
export interface ChallengeScore {
  username: string | null;
  killed: number;
  missed: number;
  isMe?: boolean;
  isCreator?: boolean;
}

/** "@seba" o "un invitado". */
export const playerName = (username: string | null | undefined) => (username ? '@' + username : 'un invitado');

/** Mismo orden que los rankings: más bloques; a igualdad, menos escapados. >0 si `a` va primero. */
export function compareScores(a: { killed: number; missed: number }, b: { killed: number; missed: number }): number {
  if (a.killed !== b.killed) return a.killed - b.killed;
  return b.missed - a.missed;
}

/**
 * Comparación de la pantalla final: "Tú 52 · @seba 47. ¡Ganaste por 5!". A igualdad de bloques
 * decide quién dejó escapar menos (como en los rankings); si también empatan, empate.
 */
export function compareText(me: { killed: number; missed: number }, other: ChallengeScore): string {
  const head = `Tú ${me.killed} · ${playerName(other.username)} ${other.killed}.`;
  const diff = me.killed - other.killed;
  if (diff > 0) return `${head} ¡Ganaste por ${diff}!`;
  if (diff < 0) return `${head} Perdiste por ${-diff}`;
  const c = compareScores(me, other);
  if (c > 0) return `${head} ¡Ganaste: se te escaparon menos bloques!`;
  if (c < 0) return `${head} Perdiste: se te escaparon más bloques`;
  return `${head} ¡Empate!`;
}

/**
 * Contra quién se compara mi partida: quien creó el reto (si no soy yo) o, si no, el mejor de
 * los demás. null si no hay nadie más.
 */
export function rivalOf(entries: readonly ChallengeScore[]): ChallengeScore | null {
  const others = entries.filter((e) => !e.isMe);
  const creator = entries.some((e) => e.isMe && e.isCreator) ? null : (others.find((e) => e.isCreator) ?? null);
  if (creator) return creator;
  let best: ChallengeScore | null = null;
  for (const e of others) if (!best || compareScores(e, best) > 0) best = e;
  return best;
}

/**
 * Encabezado del resultado de un reto en la pantalla final:
 * - `compare`: hay con quién comparar ("Tú 52 · @seba 47…");
 * - `loading`: la partida todavía se envía, o se está pidiendo el reto;
 * - `failed`: la partida ya se envió, no hay vista y `GET /challenges/:code` falló ("No se pudo
 *   cargar el reto" + "Reintentar"; antes quedaba "Cargando el reto…" para siempre);
 * - `first`: se cargó y no hay nadie más ("Eres el primero en terminar este reto").
 */
export type ChallengeHead = 'compare' | 'loading' | 'failed' | 'first';

export function challengeHead(o: { settled: boolean; hasView: boolean; hasRival: boolean; fetchFailed: boolean }): ChallengeHead {
  if (o.hasRival) return 'compare';
  if (!o.settled) return 'loading';
  if (o.hasView) return 'first';
  return o.fetchFailed ? 'failed' : 'loading';
}

// ---------------------------------------------------------------- dónde se ofrece

/** Desde qué visita se ofrece "Retar a un amigo" (la 1.ª es solo para jugar). */
export const CHALLENGE_FROM_VISIT = 2;

/**
 * ¿Se ofrece "Retar a un amigo" (inicio y pantalla final)? Con la API configurada, desde la 2.ª
 * visita; o antes si el jugador llegó por un enlace de reto (ya sabe de qué se trata).
 */
export const challengeOfferVisible = (o: { accounts: boolean; visits: number; arrivedByLink: boolean }) =>
  o.accounts && (o.visits >= CHALLENGE_FROM_VISIT || o.arrivedByLink);

/** Texto para compartir el resultado: "Tú 52 · @seba 47 en un reto de Touched Block. ¿Me superas?". */
export function resultShareText(me: { killed: number }, rival: ChallengeScore | null): string {
  if (!rival) return challengeShareText(me.killed);
  return `Hice ${bloques(me.killed)} en un reto de Touched Block (${playerName(rival.username)}: ${rival.killed}). Juega la misma partida y supérame`;
}

/**
 * Título de la invitación al abrir el enlace: "Reto de @seba: 47 bloques", "Reto de un invitado:
 * 20 bloques", "Tu reto: 47 bloques" o, si quien lo creó todavía no lo termina, "Te retaron a
 * una partida".
 */
export function inviteTitle(creator: ChallengeScore | null): string {
  if (!creator) return 'Te retaron a una partida';
  if (creator.isMe) return `Tu reto: ${bloques(creator.killed)}`;
  return `Reto de ${playerName(creator.username)}: ${bloques(creator.killed)}`;
}

// ---------------------------------------------------------------- errores al empezar

/** Por qué no se pudo empezar una partida de reto (duel) o del reto diario (daily). */
export type RunStartFailReason =
  | 'off'
  | 'offline'
  | 'outdated'
  | 'challenge_not_found'
  | 'challenge_expired'
  | 'daily_attempts_exhausted'
  | 'daily_date_invalid'
  | 'error';

/** ¿El reto ya no se puede jugar (no tiene sentido reintentar)? */
export const isFatalChallengeReason = (r: RunStartFailReason) => r === 'challenge_not_found' || r === 'challenge_expired';

/** Mensaje para el jugador. `serverMessage` se usa solo en los errores sin texto propio. */
export function startFailureText(mode: 'duel' | 'daily', reason: RunStartFailReason, serverMessage?: string): string {
  const what = mode === 'duel' ? 'El reto' : 'El reto diario';
  switch (reason) {
    case 'off':
    case 'offline':
      return `${what} necesita conexión.`;
    case 'outdated':
      return 'Hay una versión nueva del juego: recarga la página para jugar el reto.';
    case 'challenge_not_found':
      return 'Este reto no existe. Revisa el enlace.';
    case 'challenge_expired':
      return 'Este reto venció.';
    case 'daily_attempts_exhausted':
      return 'Ya usaste tus intentos del reto de hoy.';
    case 'daily_date_invalid':
      return 'La fecha de tu celular no calza con la del reto. Revisa la fecha y la hora.';
    case 'error':
      return serverMessage || `No se pudo empezar ${what.toLowerCase()}. Inténtalo de nuevo.`;
  }
}

// ---------------------------------------------------------------- código pendiente

/**
 * Código de un enlace que todavía no se juega (p. ej. mientras se ve el tutorial de la 1.ª
 * visita, o si se recarga entremedio). Vence solo, para que un enlace viejo no reaparezca días después.
 */
const PENDING_KEY = 'tb_reto1';
export const PENDING_TTL_MS = 2 * 60 * 60 * 1000;

export function savePendingChallenge(code: string, now = Date.now()) {
  try {
    storage.set(PENDING_KEY, JSON.stringify({ code, at: now }));
  } catch {}
}

export function loadPendingChallenge(now = Date.now()): string | null {
  try {
    const raw = storage.get(PENDING_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { code?: unknown; at?: unknown };
    const code = parseChallengeCode(o.code);
    if (!code || typeof o.at !== 'number' || !(now - o.at < PENDING_TTL_MS) || o.at > now + 60_000) {
      storage.remove(PENDING_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearPendingChallenge() {
  try {
    storage.remove(PENDING_KEY);
  } catch {}
}
