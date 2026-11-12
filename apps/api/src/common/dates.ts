import { type DateKey, dayIndex, isDateKey } from '@tb/engine';

/** Fecha UTC de `d` como 'AAAA-MM-DD'. */
export const utcDateKey = (d: Date): DateKey => d.toISOString().slice(0, 10);

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** La zona horaria más adelantada (UTC+14) empieza cada día 14 h antes que UTC. */
export const EARLIEST_TZ_AHEAD_MS = 14 * HOUR_MS;
/** La más atrasada (UTC−12) termina cada día 12 h después que UTC. */
export const LATEST_TZ_BEHIND_MS = 12 * HOUR_MS;

/** Primer instante en que alguna zona horaria real (UTC+14) está en la fecha `key`. */
export function dateWindowStart(key: DateKey): Date {
  return new Date(dayIndex(key) * DAY_MS - EARLIEST_TZ_AHEAD_MS);
}

/** Instante en que la última zona horaria real (UTC−12) deja la fecha `key` (exclusivo). */
export function dateWindowEnd(key: DateKey): Date {
  return new Date((dayIndex(key) + 1) * DAY_MS + LATEST_TZ_BEHIND_MS);
}

/**
 * ¿`key` es la fecha local de alguna zona horaria real en este momento (de UTC−12 a UTC+14)?
 * `D 00:00 UTC − 14 h ≤ now < (D+1) 00:00 UTC + 12 h`. Acepta la fecha de cualquier jugador con
 * el reloj bien puesto (D7) y nunca una fecha que todavía no empezó en ningún lugar, así que
 * nadie recibe antes de tiempo la semilla de un reto diario.
 */
export function isWithinDateWindow(key: unknown, now = new Date()): key is DateKey {
  if (!isDateKey(key)) return false;
  const t = now.getTime();
  return dateWindowStart(key).getTime() <= t && t < dateWindowEnd(key).getTime();
}

/** ¿La fecha `key` ya empezó en alguna zona horaria real? (las pasadas también) */
export function hasDateStarted(key: unknown, now = new Date()): key is DateKey {
  return isDateKey(key) && dateWindowStart(key).getTime() <= now.getTime();
}

/** Inicio (UTC) del día local `key` para un desfase de `tzMinutes` minutos al este de UTC. */
export function localDayStart(key: DateKey, tzMinutes: number): Date {
  return new Date(dayIndex(key) * DAY_MS - tzMinutes * 60_000);
}
