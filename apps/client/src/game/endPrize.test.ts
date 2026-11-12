import { describe, expect, it } from 'vitest';
import { ADD_START, NUM_STEP, TICKS_PER_SECOND } from '@tb/engine';
import type { Me, PlayerStats } from '@/api/types';
import { type CatalogStats, EMPTY_CATALOG_STATS } from '@/cosmetics/catalog';
import { EMPTY_STATS, type LocalStats } from '@/lib/stats';
import { endPrize, endStats, joinNames, prizeTexts } from './endPrize';

const stats = (p: Partial<CatalogStats>): CatalogStats => ({ ...EMPTY_CATALOG_STATS, ...p });
const secs = (s: number) => s * TICKS_PER_SECOND;
const ALL = { accounts: true, daily: true };

describe('premio de la pantalla final', () => {
  it('nada nuevo: sin tarjeta', () => {
    const a = stats({ runs: 3, bestTicks: secs(10), totalKilled: 30 });
    const b = stats({ runs: 4, bestTicks: secs(10), totalKilled: 40 });
    expect(endPrize(a, b, ALL)).toBeNull();
  });

  it('primera partida: primera insignia y el sonido Suave', () => {
    const p = endPrize(EMPTY_CATALOG_STATS, stats({ runs: 1, bestTicks: secs(15), totalKilled: 8 }), ALL)!;
    expect(p.tier?.name).toBe('Madera I');
    expect(p.firstTier).toBe(true);
    expect(p.items.map((i) => i.id)).toEqual(['suave']);
    expect(prizeTexts(p)).toEqual({ title: '¡Tu primera insignia: Madera I!', sub: 'Desbloqueaste Suave' });
  });

  it('subir a Bronce desbloquea Neón: se celebra la insignia primero', () => {
    const a = stats({ runs: 10, bestTicks: secs(ADD_START - 1), totalKilled: 200 });
    const b = stats({ runs: 11, bestTicks: secs(ADD_START), totalKilled: 260 });
    const p = endPrize(a, b, ALL)!;
    expect(p.tier?.name).toBe('Bronce');
    expect(p.firstTier).toBe(false);
    expect(p.items.map((i) => i.id)).toEqual(['neon']);
    expect(prizeTexts(p)).toEqual({ title: '¡Subiste a Bronce!', sub: 'Desbloqueaste Neón' });
  });

  it('solo un premio (sin insignia nueva)', () => {
    const a = stats({ runs: 5, bestTicks: secs(NUM_STEP * 2), bestStreak: 24 });
    const b = stats({ runs: 6, bestTicks: secs(NUM_STEP * 2), bestStreak: 25 });
    const p = endPrize(a, b, ALL)!;
    expect(p.tier).toBeNull();
    expect(prizeTexts(p)).toEqual({ title: '¡Desbloqueaste Confeti!', sub: 'Efecto nuevo' });
  });

  it('varios premios: el primero y cuántos más', () => {
    const a = stats({ runs: 5, bestTicks: secs(NUM_STEP * 2), bestStreak: 24, totalKilled: 490 });
    const b = stats({ runs: 6, bestTicks: secs(NUM_STEP * 2), bestStreak: 25, totalKilled: 520 });
    const p = endPrize(a, b, ALL)!;
    expect(p.items.map((i) => i.id)).toEqual(['confeti', 'grilla']);
    expect(prizeTexts(p).sub).toBe('Efecto nuevo · y 1 más en la Colección');
  });

  it('cada insignia trae su premio (Madera II → Pastel, Madera III → Chispas)', () => {
    const a = stats({ runs: 5, bestTicks: secs(NUM_STEP * 3) });
    const b = stats({ runs: 6, bestTicks: secs(NUM_STEP * 6) });
    const p = endPrize(a, b, ALL)!;
    expect(p.tier?.name).toBe('Madera III');
    // Chispas sale con Madera III
    expect(p.items.map((i) => i.id)).toEqual(['chispas']);
    const onlyTier = endPrize(stats({ runs: 1, bestTicks: secs(NUM_STEP) }), stats({ runs: 2, bestTicks: secs(NUM_STEP * 2) }), ALL)!;
    expect(prizeTexts(onlyTier)).toEqual({ title: '¡Subiste a Madera II!', sub: 'Desbloqueaste Pastel' });
  });

  it('insignia sin premios nuevos: dice a qué llegó', () => {
    const p = { tier: { index: 3, tier: 'bronce', step: 1, name: 'Bronce', at: ADD_START, goal: 'Llegar a las sumas y restas' }, firstTier: false, items: [] } as const;
    expect(prizeTexts({ ...p, items: [] })).toEqual({ title: '¡Subiste a Bronce!', sub: 'Llegaste a las sumas y restas' });
  });

  it('no anuncia lo que necesita funciones que no existen', () => {
    const a = stats({ runs: 3, invitedCount: 0 });
    const b = stats({ runs: 3, invitedCount: 1 });
    expect(endPrize(a, b, { accounts: false, daily: false })).toBeNull();
    expect(endPrize(a, b, ALL)?.items.map((i) => i.id)).toEqual(['corazones']);
  });

  it('joinNames', () => {
    expect(joinNames(['Neón'])).toBe('Neón');
  });
});

describe('endStats: con sesión en otro dispositivo (la cuenta tiene más que este)', () => {
  const local = (p: Partial<LocalStats>): LocalStats => ({ ...EMPTY_STATS, ...p });
  const account = (p: Partial<PlayerStats>): PlayerStats => ({
    bestTicks: 0,
    bestStreak: 0,
    totalKilled: 0,
    totalRuns: 0,
    bonusXp: 0,
    bestDailyPct: null,
    dailyStreakBest: 0,
    ...p,
  });
  const meWith = (s: PlayerStats) => ({ id: 'u1', username: 'seba', invitedCount: 0, stats: s }) as unknown as Me;
  const run = { killed: 15, durationTicks: secs(30), bestStreak: 6 };

  it('la partida también se suma a la base de la cuenta: se anuncia el fondo por nivel', () => {
    // dispositivo nuevo: 20 bloques; cuenta: 490 (nivel 4). Con 15 más la cuenta llega a 505 (nivel 5: Grilla).
    const before = local({ runs: 1, totalKilled: 20, bestTicks: secs(20) });
    const after = local({ runs: 2, totalKilled: 35, bestTicks: secs(30), bestStreak: 6 });
    const me = meWith(account({ totalKilled: 490, totalRuns: 40, bestTicks: secs(200), bestStreak: 30 }));
    const s = endStats({ before, after }, me, run, { normal: true, countsOnAccount: true });
    expect(s.before.totalKilled).toBe(490);
    expect(s.after.totalKilled).toBe(505);
    expect(s.after.runs).toBe(41);
    expect(endPrize(s.before, s.after, ALL)?.items.map((i) => i.id)).toEqual(['grilla']);
  });

  it('sin la cuenta (partida local u offline) no se suma a ella', () => {
    const before = local({ runs: 1, totalKilled: 20 });
    const after = local({ runs: 2, totalKilled: 35 });
    const me = meWith(account({ totalKilled: 490, totalRuns: 40 }));
    const s = endStats({ before, after }, me, run, { normal: true, countsOnAccount: false });
    expect(s.after.totalKilled).toBe(490);
    expect(endPrize(s.before, s.after, ALL)).toBeNull();
  });

  it('partida de reto: suma bloques y partidas, no la duración ni la racha (D6)', () => {
    const me = meWith(account({ totalKilled: 100, totalRuns: 5, bestTicks: secs(10), bestStreak: 2 }));
    const s = endStats({ before: local({}), after: local({ runs: 1, totalKilled: 15 }) }, me, { killed: 15, durationTicks: secs(300), bestStreak: 40 }, {
      normal: false,
      countsOnAccount: true,
    });
    expect(s.after).toMatchObject({ totalKilled: 115, runs: 6, bestTicks: secs(10), bestStreak: 2 });
  });

  it('prevBestTicks: el máximo entre el dispositivo y la cuenta (no felicita hitos ya alcanzados)', () => {
    const me = meWith(account({ bestTicks: secs(150) }));
    const s = endStats({ before: local({ bestTicks: secs(10) }), after: local({ bestTicks: secs(30) }) }, me, run, { normal: true, countsOnAccount: true });
    expect(s.prevBestTicks).toBe(secs(150));
    expect(endStats({ before: local({ bestTicks: secs(10) }), after: local({}) }, null, run, { normal: true, countsOnAccount: false }).prevBestTicks).toBe(
      secs(10),
    );
  });

  it('sin sesión: solo las del dispositivo', () => {
    const s = endStats({ before: local({ runs: 0 }), after: local({ runs: 1, totalKilled: 8, bestTicks: secs(15) }) }, null, run, {
      normal: true,
      countsOnAccount: true,
    });
    expect(endPrize(s.before, s.after, ALL)?.tier?.name).toBe('Madera I');
  });
});

describe('joinNames (varios)', () => {
  it('joinNames', () => {
    expect(joinNames(['Neón'])).toBe('Neón');
    expect(joinNames(['Neón', 'Chispas'])).toBe('Neón y Chispas');
    expect(joinNames(['Neón', 'Chispas', 'Grilla'])).toBe('Neón, Chispas y Grilla');
  });
});
