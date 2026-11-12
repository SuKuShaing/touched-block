// Reto diario (plan de jugabilidad, fases 4.1 y 5.1): fechas, número del reto, intentos,
// calendario de modificadores y racha de días. Funciones puras con aritmética entera (sin
// `Date`), para que el cliente y el servidor den siempre lo mismo.
import { ADD_START, BASE_LIVES, MUL_START } from './constants';
import type { GameMods } from './game';

/** Fecha de calendario 'AAAA-MM-DD' (la fecha local del jugador, decisión D7). */
export type DateKey = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DATE_KEY_MIN_YEAR = 2000;
export const DATE_KEY_MAX_YEAR = 2100;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const daysInMonth = (y: number, m: number) => (m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m - 1]);

function parse(key: string): [number, number, number] | null {
  const m = DATE_RE.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < DATE_KEY_MIN_YEAR || y > DATE_KEY_MAX_YEAR) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > daysInMonth(y, mo)) return null;
  return [y, mo, d];
}

/** ¿Es una fecha de calendario válida 'AAAA-MM-DD' entre los años 2000 y 2100? */
export function isDateKey(s: unknown): s is DateKey {
  return typeof s === 'string' && parse(s) !== null;
}

function parseOrThrow(key: DateKey): [number, number, number] {
  const p = typeof key === 'string' ? parse(key) : null;
  if (!p) throw new Error(`fecha inválida: ${String(key)}`);
  return p;
}

/** Días desde el 1970-01-01 (algoritmo days-from-civil, solo enteros). */
export function dayIndex(key: DateKey): number {
  const [y0, m, d] = parseOrThrow(key);
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

const pad = (n: number, w: number) => String(n).padStart(w, '0');

/** Inversa de `dayIndex` (algoritmo civil-from-days). */
export function dateKeyFromIndex(n: number): DateKey {
  if (!Number.isInteger(n)) throw new Error(`índice de día inválido: ${n}`);
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

/** La fecha `n` días después (o antes, si `n` es negativo). */
export function addDays(key: DateKey, n: number): DateKey {
  return dateKeyFromIndex(dayIndex(key) + n);
}

/** Día de la semana: 0 = lunes … 6 = domingo. */
export function weekdayOf(key: DateKey): number {
  // el 1970-01-01 fue jueves (3)
  return (((dayIndex(key) + 3) % 7) + 7) % 7;
}

// ---- Número del reto ----

/** Fecha del reto #1 (provisorio). */
export const DAILY_EPOCH: DateKey = '2026-11-12';

/** Número del reto de esa fecha ("Reto #42"); el de DAILY_EPOCH es el 1. */
export function dailyNumber(key: DateKey): number {
  return dayIndex(key) - dayIndex(DAILY_EPOCH) + 1;
}

// ---- Reglas del modo ----

/** Vidas del reto diario (igual para todos, sin los corazones por invitar). */
export const DAILY_LIVES = BASE_LIVES;
/** Intentos por día con cuenta (decisión D8). Cuenta el mejor. */
export const DAILY_ATTEMPTS_ACCOUNT = 3;
/** Intentos por día como invitado (decisión D8). */
export const DAILY_ATTEMPTS_GUEST = 1;
/** La racha de días tolera un día sin jugar por cada tantos jugados (provisorio). */
export const DAILY_STREAK_GRACE_EVERY = 7;
/** Vidas del día "Solo N vidas" del calendario (provisorio). */
export const DAILY_FEW_LIVES = 3;

// ---- Calendario de modificadores (provisorio) ----

export interface DailyMods {
  /** Modificadores del día, o null si es una partida normal. */
  mods: GameMods | null;
  /** Para "Hoy: …": "Directo a las sumas", "Partida normal"… */
  title: string;
}

/** Modificador de cada día de la semana, indexado como `weekdayOf` (0 = lunes … 6 = domingo). */
export const DAILY_CALENDAR: readonly Readonly<DailyMods>[] = [
  { mods: null, title: 'Partida normal' },
  { mods: { startAt: ADD_START }, title: 'Directo a las sumas' },
  { mods: { lives: DAILY_FEW_LIVES }, title: `Solo ${DAILY_FEW_LIVES} vidas` },
  // solo multiplicaciones, partiendo en su dificultad (sin startAt eran 275 s de "2×2": largo y fácil)
  { mods: { only: 'mul', startAt: MUL_START }, title: 'Solo multiplicaciones y divisiones' },
  { mods: { noRed: true }, title: 'Sin trampas rojas' },
  { mods: { startAt: MUL_START }, title: 'Directo a las multiplicaciones' },
  { mods: null, title: 'Partida normal' },
];

/** Modificadores del reto de esa fecha (una copia: se puede guardar o modificar sin riesgo). */
export function dailyModsFor(key: DateKey): DailyMods {
  const day = DAILY_CALENDAR[weekdayOf(key)];
  return { mods: day.mods ? { ...day.mods } : null, title: day.title };
}

// ---- Racha de días ----

export interface DailyStreak {
  /** Racha vigente (0 si ya se cortó). */
  current: number;
  /** Mejor racha histórica (incluye la vigente). */
  best: number;
}

/**
 * Racha de días jugados en el reto diario, con perdón (provisorio):
 *
 * - Cada día jugado suma 1. Los días repetidos cuentan una vez; las fechas inválidas se ignoran.
 * - Un hueco de **exactamente un día** sin jugar no corta la racha si, desde que empezó la racha
 *   (o desde el último perdón), se jugaron al menos DAILY_STREAK_GRACE_EVERY días. El día del
 *   hueco no suma, y la cuenta para el siguiente perdón vuelve a empezar desde ahí.
 *   Ej.: 7 días seguidos, uno sin jugar y otro jugado = racha de 8.
 * - Un hueco de dos días o más (o de uno sin perdón disponible) corta la racha.
 * - La racha vigente sigue viva si el último día jugado es hoy o ayer (o una fecha posterior a
 *   `today`, por la diferencia de zona horaria), o anteayer si el hueco de ayer sería perdonable
 *   (todavía puede jugar hoy y conservarla). Si no, `current` es 0.
 */
export function dailyStreak(keys: readonly string[], today: DateKey): DailyStreak {
  const todayIdx = dayIndex(today);
  const days = [...new Set(keys.filter(isDateKey).map(dayIndex))].sort((a, b) => a - b);
  if (days.length === 0) return { current: 0, best: 0 };

  let run = 1; // días jugados en la racha
  let sinceGrace = 1; // días jugados desde el inicio de la racha o el último perdón
  let best = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = days[i] - days[i - 1];
    if (gap === 1) {
      run++;
      sinceGrace++;
    } else if (gap === 2 && sinceGrace >= DAILY_STREAK_GRACE_EVERY) {
      run++; // se perdona el día sin jugar (no suma)
      sinceGrace = 1;
    } else {
      run = 1;
      sinceGrace = 1;
    }
    if (run > best) best = run;
  }

  const since = todayIdx - days[days.length - 1];
  const alive = since <= 1 || (since === 2 && sinceGrace >= DAILY_STREAK_GRACE_EVERY);
  return { current: alive ? run : 0, best };
}
