import { describe, expect, it } from 'vitest';
import { ADD_START, LIFE_STAGE_START, MUL_START, TICKS_PER_SECOND, TIERS } from '@tb/engine';
import { config } from '@/config';
import { CELL_MISSING, DAILY_URL, dailyShareText, sharePositionLine, tierCells } from './dailyShare';

const secs = (s: number) => s * TICKS_PER_SECOND;

describe('tierCells', () => {
  it('una celda por paso de insignia', () => {
    expect([...tierCells(0)]).toHaveLength(TIERS.length); // un punto de código por celda
    expect(tierCells(secs(10))).toBe('🟫⬛⬛⬛⬛⬛⬛');
    expect(tierCells(secs(100))).toBe('🟫🟫🟫⬛⬛⬛⬛');
    expect(tierCells(secs(ADD_START))).toBe('🟫🟫🟫🟧⬛⬛⬛');
    expect(tierCells(secs(MUL_START))).toBe('🟫🟫🟫🟧⬜⬛⬛');
    expect(tierCells(secs(LIFE_STAGE_START))).toBe('🟫🟫🟫🟧⬜🟨⬛');
    expect(tierCells(secs(10_000))).toBe('🟫🟫🟫🟧⬜🟨🟦');
    expect(tierCells(secs(ADD_START) - 1).endsWith(CELL_MISSING.repeat(4))).toBe(true);
  });

  it('con startAt cuenta la dificultad alcanzada', () => {
    expect(tierCells(secs(10), { startAt: ADD_START })).toBe('🟫🟫🟫🟧⬛⬛⬛');
    expect(tierCells(secs(MUL_START - ADD_START), { startAt: ADD_START })).toBe('🟫🟫🟫🟧⬜⬛⬛');
    expect(tierCells(secs(10), { noRed: true })).toBe('🟫⬛⬛⬛⬛⬛⬛');
  });
});

describe('sharePositionLine', () => {
  it('porcentaje con 10 o más jugadores; si no, el puesto', () => {
    expect(sharePositionLine({ rank: 12, total: 80, betterThanPct: 72 })).toBe('Mejor que el 72 %');
    expect(sharePositionLine({ rank: 2, total: 4, betterThanPct: 66 })).toBe('2.º de 4');
    expect(sharePositionLine({ rank: 0, total: 0, betterThanPct: 0 })).toBeNull();
  });
});

describe('dailyShareText', () => {
  it('como en el plan, sin spoilers', () => {
    const r = dailyShareText({
      number: 42,
      killed: 58,
      bestStreak: 31,
      durationTicks: secs(300),
      position: { rank: 23, total: 80, betterThanPct: 72 },
    });
    expect(r.text).toBe('Touched Block · Reto #42\n58 bloques · racha 31\n🟫🟫🟫🟧⬜⬛⬛\nMejor que el 72 %');
    expect(r.url).toBe(`${config.siteUrl}?diario=1`);
    expect(r.url).toBe(DAILY_URL);
    expect(r.full).toBe(`${r.text}\n${DAILY_URL}`);
  });

  it('pocos jugadores, singular y sin posición', () => {
    expect(
      dailyShareText({ number: 3, killed: 1, bestStreak: 1, durationTicks: secs(5), position: { rank: 2, total: 4, betterThanPct: 66 } }).text,
    ).toBe('Touched Block · Reto #3\n1 bloque · racha 1\n🟫⬛⬛⬛⬛⬛⬛\n2.º de 4');
    expect(dailyShareText({ number: 3, killed: 9, bestStreak: 4, durationTicks: secs(5) }).text.split('\n')).toHaveLength(3);
  });
});
