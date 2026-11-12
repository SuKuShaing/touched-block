import { describe, expect, it } from 'vitest';
import { END_TAP_GUARD_MS, endTapReady } from './endGuard';

describe('endTapReady: pausa tras terminar la partida', () => {
  it('sin partida terminada, siempre', () => {
    expect(endTapReady(null, 0)).toBe(true);
    expect(endTapReady(Number.NaN, 0)).toBe(true);
  });
  it('ignora las pulsaciones durante la pausa', () => {
    expect(endTapReady(1000, 1000)).toBe(false);
    expect(endTapReady(1000, 1000 + END_TAP_GUARD_MS - 1)).toBe(false);
  });
  it('responde después de la pausa', () => {
    expect(endTapReady(1000, 1000 + END_TAP_GUARD_MS)).toBe(true);
    expect(endTapReady(1000, 60_000)).toBe(true);
  });
  it('si el reloj retrocede, no bloquea', () => {
    expect(endTapReady(5000, 1000)).toBe(true);
  });
  it('la pausa es corta (no se nota al querer jugar otra)', () => {
    expect(END_TAP_GUARD_MS).toBeGreaterThanOrEqual(300);
    expect(END_TAP_GUARD_MS).toBeLessThanOrEqual(600);
  });
});
