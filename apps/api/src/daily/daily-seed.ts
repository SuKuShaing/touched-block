import { createHmac } from 'node:crypto';
import type { DateKey } from '@tb/engine';

/**
 * Semilla del reto diario: HMAC-SHA256(DAILY_SECRET, fecha) recortada a 31 bits (cabe en un
 * INTEGER de Postgres). Sin tabla ni tarea programada, y nadie puede adivinar la de mañana.
 */
export function dailySeed(secret: string, date: DateKey): number {
  return createHmac('sha256', secret).update(date).digest().readUInt32BE(0) & 0x7fffffff;
}
