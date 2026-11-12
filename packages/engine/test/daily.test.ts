import { describe, expect, it } from 'vitest';
import {
  ADD_START,
  BASE_LIVES,
  DAILY_ATTEMPTS_ACCOUNT,
  DAILY_ATTEMPTS_GUEST,
  DAILY_CALENDAR,
  DAILY_EPOCH,
  DAILY_FEW_LIVES,
  DAILY_LIVES,
  DAILY_STREAK_GRACE_EVERY,
  MUL_START,
  addDays,
  dailyModsFor,
  dailyNumber,
  dailyStreak,
  dateKeyFromIndex,
  dayIndex,
  isDateKey,
  weekdayOf,
} from '../src';

const MS_PER_DAY = 86400000;

describe('fechas', () => {
  it('isDateKey acepta fechas de calendario válidas entre 2000 y 2100', () => {
    for (const ok of ['2026-11-12', '2024-02-29', '2000-02-29', '2000-01-01', '2100-12-31', '2026-01-31']) {
      expect(isDateKey(ok), ok).toBe(true);
    }
    for (const bad of [
      '2023-02-29',
      '2100-02-29', // 2100 no es bisiesto
      '1999-12-31',
      '2101-01-01',
      '2026-13-01',
      '2026-00-10',
      '2026-11-00',
      '2026-11-31',
      '2026-1-1',
      ' 2026-11-12',
      '2026-11-12 ',
      '2026-11-12T00:00',
      '2026/11/12',
      '',
      123,
      null,
      undefined,
    ]) {
      expect(isDateKey(bad), String(bad)).toBe(false);
    }
  });

  it('dayIndex y dateKeyFromIndex coinciden con el calendario en todo el rango', () => {
    // los tests sí pueden usar Date: se compara contra la implementación del sistema
    const from = Date.UTC(2000, 0, 1) / MS_PER_DAY;
    const to = Date.UTC(2100, 11, 31) / MS_PER_DAY;
    expect(dayIndex('2000-01-01')).toBe(from);
    expect(dayIndex('2100-12-31')).toBe(to);
    for (let n = from; n <= to; n++) {
      const d = new Date(n * MS_PER_DAY);
      const key = d.toISOString().slice(0, 10);
      expect(dateKeyFromIndex(n)).toBe(key);
      expect(dayIndex(key)).toBe(n);
      expect(weekdayOf(key)).toBe((d.getUTCDay() + 6) % 7);
    }
  });

  it('addDays cruza meses, años y bisiestos', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
    expect(addDays('2026-11-12', 0)).toBe('2026-11-12');
    expect(addDays('2026-11-12', 365)).toBe('2027-11-12');
  });

  it('weekdayOf: 0 = lunes … 6 = domingo', () => {
    expect(weekdayOf('2026-11-09')).toBe(0); // lunes
    expect(weekdayOf('2026-11-12')).toBe(3); // jueves
    expect(weekdayOf('2026-11-15')).toBe(6); // domingo
  });

  it('rechaza fechas inválidas', () => {
    expect(() => dayIndex('2026-02-30')).toThrow();
    expect(() => addDays('hoy', 1)).toThrow();
    expect(() => dateKeyFromIndex(1.5)).toThrow();
  });
});

describe('reto diario', () => {
  it('número del reto: el de DAILY_EPOCH es el #1', () => {
    expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    expect(dailyNumber(addDays(DAILY_EPOCH, 1))).toBe(2);
    expect(dailyNumber(addDays(DAILY_EPOCH, 41))).toBe(42);
    expect(dailyNumber(addDays(DAILY_EPOCH, -1))).toBe(0);
  });

  it('reglas del modo (decisión D8)', () => {
    expect(DAILY_LIVES).toBe(BASE_LIVES);
    expect(DAILY_ATTEMPTS_ACCOUNT).toBe(3);
    expect(DAILY_ATTEMPTS_GUEST).toBe(1);
  });

  it('calendario de modificadores por día de la semana', () => {
    const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
    expect(week.map(weekdayOf)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(week.map(dailyModsFor)).toEqual([
      { mods: null, title: 'Partida normal' },
      { mods: { startAt: ADD_START }, title: 'Directo a las sumas' },
      { mods: { lives: DAILY_FEW_LIVES }, title: `Solo ${DAILY_FEW_LIVES} vidas` },
      { mods: { only: 'mul', startAt: MUL_START }, title: 'Solo multiplicaciones y divisiones' },
      { mods: { noRed: true }, title: 'Sin trampas rojas' },
      { mods: { startAt: MUL_START }, title: 'Directo a las multiplicaciones' },
      { mods: null, title: 'Partida normal' },
    ]);
    expect(dailyModsFor('2026-11-18').title).toBe('Solo 3 vidas');
  });

  it('dailyModsFor devuelve una copia', () => {
    const d = dailyModsFor('2026-11-17');
    d.mods!.startAt = 0;
    expect(DAILY_CALENDAR[1].mods).toEqual({ startAt: ADD_START });
    expect(dailyModsFor('2026-11-17').mods).toEqual({ startAt: ADD_START });
  });
});

describe('racha de días', () => {
  const G = DAILY_STREAK_GRACE_EVERY;
  const TODAY = '2026-11-12';
  /** Fechas a partir de `offsets` (días respecto de hoy: 0 = hoy, −1 = ayer…). */
  const on = (...offsets: number[]) => offsets.map((o) => addDays(TODAY, o));
  /** `n` días seguidos que terminan en `end` (offset respecto de hoy). */
  const run = (n: number, end: number) => Array.from({ length: n }, (_, i) => end - n + 1 + i);

  it(`el perdón es de un día por cada ${G} jugados`, () => {
    expect(G).toBe(7);
  });

  it('sin días jugados', () => {
    expect(dailyStreak([], TODAY)).toEqual({ current: 0, best: 0 });
    expect(dailyStreak(['basura', '2026-02-30'], TODAY)).toEqual({ current: 0, best: 0 });
  });

  it('sigue viva si jugó hoy o ayer', () => {
    expect(dailyStreak(on(0), TODAY)).toEqual({ current: 1, best: 1 });
    expect(dailyStreak(on(-1), TODAY)).toEqual({ current: 1, best: 1 });
    expect(dailyStreak(on(...run(3, 0)), TODAY)).toEqual({ current: 3, best: 3 });
    expect(dailyStreak(on(...run(3, -1)), TODAY)).toEqual({ current: 3, best: 3 });
  });

  it('ignora repetidos, desorden y fechas inválidas', () => {
    const keys = [...on(0, -2, -1, -1, 0), 'x', '2026-13-01'];
    expect(dailyStreak(keys, TODAY)).toEqual({ current: 3, best: 3 });
  });

  it('una fecha posterior a hoy (otra zona horaria) mantiene la racha', () => {
    expect(dailyStreak(on(-1, 0, 1), TODAY)).toEqual({ current: 3, best: 3 });
  });

  it(`perdona un día sin jugar después de ${G} jugados; el hueco no suma`, () => {
    // G seguidos, un día sin jugar, y hoy
    expect(dailyStreak(on(...run(G, -2), 0), TODAY)).toEqual({ current: G + 1, best: G + 1 });
  });

  it(`no perdona con menos de ${G} jugados`, () => {
    expect(dailyStreak(on(...run(G - 1, -2), 0), TODAY)).toEqual({ current: 1, best: G - 1 });
  });

  it('un hueco de dos días siempre corta', () => {
    expect(dailyStreak(on(...run(30, -3), 0), TODAY)).toEqual({ current: 1, best: 30 });
  });

  it('después de un perdón hacen falta otros 7 días para el siguiente', () => {
    // G, hueco, 1, hueco, hoy → el segundo hueco no se perdona
    expect(dailyStreak(on(...run(G, -4), -2, 0), TODAY)).toEqual({ current: 1, best: G + 1 });
    // G, hueco, G, hueco, hoy → ambos se perdonan
    const keys = on(...run(G, -G - 3), ...run(G, -2), 0);
    expect(dailyStreak(keys, TODAY)).toEqual({ current: 2 * G + 1, best: 2 * G + 1 });
    // G, hueco, G − 1, hueco, hoy → el segundo no
    const keys2 = on(...run(G, -G - 2), ...run(G - 1, -2), 0);
    expect(dailyStreak(keys2, TODAY)).toEqual({ current: 1, best: 2 * G - 1 });
  });

  it('anteayer: sigue viva solo si el hueco de ayer sería perdonable', () => {
    expect(dailyStreak(on(...run(G, -2)), TODAY)).toEqual({ current: G, best: G });
    expect(dailyStreak(on(...run(G - 1, -2)), TODAY)).toEqual({ current: 0, best: G - 1 });
    expect(dailyStreak(on(-2), TODAY)).toEqual({ current: 0, best: 1 });
  });

  it('hace tres días o más: la racha vigente es 0, pero queda la mejor', () => {
    expect(dailyStreak(on(...run(20, -3)), TODAY)).toEqual({ current: 0, best: 20 });
  });

  it('la mejor puede ser una racha anterior', () => {
    expect(dailyStreak(on(...run(10, -20), ...run(2, 0)), TODAY)).toEqual({ current: 2, best: 10 });
  });
});
