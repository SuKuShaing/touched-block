import { addDays } from '@tb/engine';
import { describe, expect, it } from 'vitest';
import { dateWindowStart, hasDateStarted, isWithinDateWindow, localDayStart, utcDateKey } from '../common/dates';
import { MAX_RUN_AGE_MS } from '../runs/run-verification';
import { CLAIM_WINDOW_MS, DAILY_STARTED_RUN_TTL_MS } from '../runs/runs.service';
import { dailySeed } from './daily-seed';
import { DAILY_RESULTS_GRACE_MS, betterThanPct, dailyClosesAt, weekOf } from './daily.service';

/** Fecha local de `now` en una zona horaria de `hours` horas al este de UTC. */
const localKey = (now: Date, hours: number) => utcDateKey(new Date(now.getTime() + hours * 3_600_000));

describe('semilla del reto diario', () => {
  it('es determinista, de 31 bits y depende de la fecha y del secreto', () => {
    const s = dailySeed('secreto-de-prueba', '2026-11-12');
    expect(s).toBe(dailySeed('secreto-de-prueba', '2026-11-12'));
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0x7fffffff);
    expect(dailySeed('secreto-de-prueba', '2026-11-13')).not.toBe(s);
    expect(dailySeed('otro-secreto', '2026-11-12')).not.toBe(s);
  });

  it('es HMAC-SHA256(secreto, fecha) recortado a 31 bits', async () => {
    const { createHmac } = await import('node:crypto');
    const h = createHmac('sha256', 'k').update('2026-01-01').digest();
    expect(dailySeed('k', '2026-01-01')).toBe(h.readUInt32BE(0) & 0x7fffffff);
  });
});

describe('ventana de fechas: solo fechas en que alguna zona horaria real (UTC−12 … UTC+14) está ahora', () => {
  const now = new Date('2026-11-12T02:00:00Z');
  it('a las 02:00 UTC: acepta el 12 (UTC) y el 11 (Chile, 23:00), no el 13 (nadie está ahí todavía)', () => {
    expect(utcDateKey(now)).toBe('2026-11-12');
    expect(isWithinDateWindow('2026-11-12', now)).toBe(true);
    expect(isWithinDateWindow('2026-11-11', now)).toBe(true); // Chile (UTC−3): 23:00 del 11
    expect(localKey(now, 13)).toBe('2026-11-12'); // Nueva Zelanda en verano (UTC+13): 15:00 del 12
    expect(localKey(now, 14)).toBe('2026-11-12'); // Kiritimati (UTC+14): 16:00 del 12
    expect(isWithinDateWindow('2026-11-13', now)).toBe(false);
  });

  it('borde UTC+14: el día D empieza a aceptarse a las 10:00 UTC del día anterior', () => {
    expect(isWithinDateWindow('2026-11-13', new Date('2026-11-12T09:59:59.999Z'))).toBe(false);
    const start = new Date('2026-11-12T10:00:00Z');
    expect(localKey(start, 14)).toBe('2026-11-13'); // medianoche en UTC+14
    expect(isWithinDateWindow('2026-11-13', start)).toBe(true);
    expect(dateWindowStart('2026-11-13').toISOString()).toBe(start.toISOString());
  });

  it('borde UTC−12: el día D se acepta hasta las 12:00 UTC del día siguiente (exclusive)', () => {
    const last = new Date('2026-11-13T11:59:59.999Z');
    expect(localKey(last, -12)).toBe('2026-11-12'); // 23:59 del 12 en UTC−12
    expect(isWithinDateWindow('2026-11-12', last)).toBe(true);
    expect(isWithinDateWindow('2026-11-12', new Date('2026-11-13T12:00:00Z'))).toBe(false);
  });

  it('cualquier jugador con el reloj bien puesto, en cualquier zona real, está dentro', () => {
    for (let h = 0; h < 48; h++) {
      const t = new Date(Date.parse('2026-11-12T00:00:00Z') + h * 3_600_000 + 1_234);
      for (let tz = -12; tz <= 14; tz++) expect(isWithinDateWindow(localKey(t, tz), t)).toBe(true);
    }
  });

  it('rechaza fechas a dos días o más y fechas mal formadas', () => {
    expect(isWithinDateWindow('2026-11-10', now)).toBe(false);
    expect(isWithinDateWindow('2026-11-14', now)).toBe(false);
    expect(isWithinDateWindow('2026-11-31', now)).toBe(false);
    expect(isWithinDateWindow('12-11-2026', now)).toBe(false);
    expect(isWithinDateWindow(undefined, now)).toBe(false);
  });

  it('cruza fin de mes y de año', () => {
    const ny = new Date('2027-01-01T00:30:00Z');
    expect(isWithinDateWindow('2026-12-31', ny)).toBe(true);
    expect(isWithinDateWindow('2027-01-01', ny)).toBe(true);
    expect(isWithinDateWindow(addDays('2027-01-01', 1), ny)).toBe(false);
    expect(isWithinDateWindow(addDays('2027-01-01', 1), new Date('2027-01-01T10:00:00Z'))).toBe(true);
    expect(isWithinDateWindow('2026-12-30', ny)).toBe(false);
  });

  it('ranking del día: fechas pasadas y las que ya empezaron en alguna zona, no las futuras', () => {
    expect(hasDateStarted('2020-01-01', now)).toBe(true);
    expect(hasDateStarted('2026-11-12', now)).toBe(true);
    expect(hasDateStarted('2026-11-13', now)).toBe(false);
    expect(hasDateStarted('2026-11-13', new Date('2026-11-12T10:00:00Z'))).toBe(true);
    expect(hasDateStarted('ayer', now)).toBe(false);
  });

  it('inicio del día local según los minutos al este de UTC', () => {
    expect(localDayStart('2026-11-12', 0).toISOString()).toBe('2026-11-12T00:00:00.000Z');
    expect(localDayStart('2026-11-12', -180).toISOString()).toBe('2026-11-12T03:00:00.000Z'); // Chile (UTC−3)
    expect(localDayStart('2026-11-12', 780).toISOString()).toBe('2026-11-11T11:00:00.000Z'); // UTC+13
  });
});

describe('cierre de un día del reto', () => {
  it('cubre el plazo para terminar una partida empezada y para reclamar una de invitado', () => {
    expect(DAILY_RESULTS_GRACE_MS).toBeGreaterThanOrEqual(MAX_RUN_AGE_MS + CLAIM_WINDOW_MS);
  });

  it('cierra cuando la fecha ya salió de la ventana y venció ese plazo, no antes', () => {
    const closes = dailyClosesAt('2026-11-12');
    expect(closes.toISOString()).toBe('2026-11-13T15:00:00.000Z');
    // hasta las 12:00 UTC del 13 (medianoche en UTC−12) todavía se pueden empezar partidas del 12
    const lastStart = new Date('2026-11-13T11:59:59Z');
    expect(isWithinDateWindow('2026-11-12', lastStart)).toBe(true);
    expect(lastStart.getTime() + MAX_RUN_AGE_MS + CLAIM_WINDOW_MS).toBeLessThanOrEqual(closes.getTime());
    expect(isWithinDateWindow('2026-11-12', new Date('2026-11-13T12:00:00Z'))).toBe(false);
  });

  it('la limpieza borra un intento diario abandonado recién cuando su fecha ya cerró', () => {
    // la partida más temprana posible del 12 se empieza al abrirse la ventana (UTC+14)
    const earliest = dateWindowStart('2026-11-12').getTime();
    expect(earliest + DAILY_STARTED_RUN_TTL_MS).toBeGreaterThanOrEqual(dailyClosesAt('2026-11-12').getTime());
  });
});

describe('tira de la semana', () => {
  it('fechas jugadas en los 7 días que terminan en la fecha (incluida), ordenadas y sin repetir', () => {
    const played = ['2026-11-12', '2026-11-05', '2026-11-06', '2026-11-10', '2026-11-10', '2026-11-13', '2025-11-12'];
    expect(weekOf(played, '2026-11-12')).toEqual(['2026-11-06', '2026-11-10', '2026-11-12']);
    expect(weekOf([], '2026-11-12')).toEqual([]);
  });

  it('cruza fin de año', () => {
    expect(weekOf(['2026-12-27', '2026-12-26', '2027-01-02'], '2027-01-02')).toEqual(['2026-12-27', '2027-01-02']);
  });
});

describe('porcentaje "mejor que"', () => {
  it('peores que yo / (total − 1), hacia abajo', () => {
    expect(betterThanPct(9, 10)).toBe(100);
    expect(betterThanPct(0, 10)).toBe(0);
    expect(betterThanPct(2, 4)).toBe(66);
    expect(betterThanPct(72, 101)).toBe(72);
  });

  it('0 si es el único jugador', () => {
    expect(betterThanPct(0, 1)).toBe(0);
    expect(betterThanPct(0, 0)).toBe(0);
  });
});
