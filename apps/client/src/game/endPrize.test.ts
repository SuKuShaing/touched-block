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

  it('primera partida de 20 s o más: primera insignia y dos sonidos', () => {
    const p = endPrize(EMPTY_CATALOG_STATS, stats({ runs: 1, bestTicks: secs(25), totalKilled: 8 }), ALL)!;
    expect(p.tier?.name).toBe('Papel');
    expect(p.firstTier).toBe(true);
    expect(p.items.map((i) => i.id)).toEqual(['suave', 'marimba']);
    expect(prizeTexts(p)).toEqual({ title: '¡Tu primera insignia: Papel!', sub: 'Desbloqueaste Suave y Marimba' });
  });

  it('primera partida corta: solo Suave, sin insignia', () => {
    const p = endPrize(EMPTY_CATALOG_STATS, stats({ runs: 1, bestTicks: secs(15), totalKilled: 4 }), ALL)!;
    expect(p.tier).toBeNull();
    expect(p.firstTier).toBe(false);
    expect(prizeTexts(p)).toEqual({ title: '¡Desbloqueaste Suave!', sub: 'Sonido nuevo' });
  });

  it('subir a Bronce desbloquea Viento: se celebra la insignia primero', () => {
    const a = stats({ runs: 11, bestTicks: secs(ADD_START - 1), totalKilled: 200 });
    const b = stats({ runs: 12, bestTicks: secs(ADD_START), totalKilled: 260 });
    const p = endPrize(a, b, ALL)!;
    expect(p.tier?.name).toBe('Bronce');
    expect(p.firstTier).toBe(false);
    expect(p.items.map((i) => i.id)).toEqual(['viento']);
    expect(prizeTexts(p)).toEqual({ title: '¡Subiste a Bronce!', sub: 'Desbloqueaste Viento' });
  });

  it('solo un premio (sin insignia nueva)', () => {
    const a = stats({ runs: 5, bestTicks: secs(NUM_STEP * 2), bestStreak: 24 });
    const b = stats({ runs: 6, bestTicks: secs(NUM_STEP * 2), bestStreak: 25 });
    const p = endPrize(a, b, ALL)!;
    expect(p.tier).toBeNull();
    expect(prizeTexts(p)).toEqual({ title: '¡Desbloqueaste Confeti!', sub: 'Efecto nuevo' });
  });

  it('varios premios: el primero y cuántos más', () => {
    const a = stats({ runs: 5, bestTicks: secs(NUM_STEP * 2), bestStreak: 24, totalKilled: 290 });
    const b = stats({ runs: 6, bestTicks: secs(NUM_STEP * 2), bestStreak: 25, totalKilled: 320 });
    const p = endPrize(a, b, ALL)!;
    expect(p.items.map((i) => i.id)).toEqual(['pastel', 'confeti']);
    expect(prizeTexts(p).sub).toBe('Paleta nueva · y 1 más en la Colección');
  });

  it('cada insignia trae su sonido (Cartón → Palitos, Madera → Electrónico)', () => {
    const p = endPrize(stats({ runs: 5, bestTicks: secs(NUM_STEP * 3) }), stats({ runs: 6, bestTicks: secs(NUM_STEP * 5) }), ALL)!;
    expect(p.tier?.name).toBe('Madera');
    expect(p.items.map((i) => i.id)).toEqual(['electronico']);
    const carton = endPrize(stats({ runs: 1, bestTicks: secs(NUM_STEP) }), stats({ runs: 2, bestTicks: secs(NUM_STEP * 3) }), ALL)!;
    expect(prizeTexts(carton)).toEqual({ title: '¡Subiste a Cartón!', sub: 'Desbloqueaste Palitos' });
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

  it('la partida también se suma a la base de la cuenta: se anuncia la paleta por nivel', () => {
    // dispositivo nuevo: 20 bloques; cuenta: 290 (nivel 2). Con 15 más la cuenta llega a 305 (nivel 3: Pastel).
    const before = local({ runs: 1, totalKilled: 20, bestTicks: secs(20) });
    const after = local({ runs: 2, totalKilled: 35, bestTicks: secs(30), bestStreak: 6 });
    const me = meWith(account({ totalKilled: 290, totalRuns: 40, bestTicks: secs(200), bestStreak: 30 }));
    const s = endStats({ before, after }, me, run, { normal: true, countsOnAccount: true });
    expect(s.before.totalKilled).toBe(290);
    expect(s.after.totalKilled).toBe(305);
    expect(s.after.runs).toBe(41);
    expect(endPrize(s.before, s.after, ALL)?.items.map((i) => i.id)).toEqual(['pastel']);
  });

  it('sin la cuenta (partida local u offline) no se suma a ella', () => {
    const before = local({ runs: 1, totalKilled: 20 });
    const after = local({ runs: 2, totalKilled: 35 });
    const me = meWith(account({ totalKilled: 290, totalRuns: 40 }));
    const s = endStats({ before, after }, me, run, { normal: true, countsOnAccount: false });
    expect(s.after.totalKilled).toBe(290);
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
    const s = endStats({ before: local({ runs: 0 }), after: local({ runs: 1, totalKilled: 8, bestTicks: secs(25) }) }, null, run, {
      normal: true,
      countsOnAccount: true,
    });
    expect(endPrize(s.before, s.after, ALL)?.tier?.name).toBe('Papel');
  });

  it('porcentaje del reto: como invitado el del dispositivo; con sesión, el de la cuenta', () => {
    const runs = { before: local({}), after: local({ runs: 1 }) };
    const opts = { normal: true, countsOnAccount: true, dailyPct: 40 };
    const guest = endStats(runs, null, run, opts);
    expect([guest.before.bestDailyPct, guest.after.bestDailyPct]).toEqual([40, 40]);
    const logged = endStats(runs, meWith(account({ bestDailyPct: 75 })), run, opts);
    expect([logged.before.bestDailyPct, logged.after.bestDailyPct]).toEqual([75, 75]);
    expect(endStats(runs, meWith(account({})), run, opts).after.bestDailyPct).toBeNull();
  });
});

describe('joinNames (varios)', () => {
  it('joinNames', () => {
    expect(joinNames(['Neón'])).toBe('Neón');
    expect(joinNames(['Neón', 'Chispas'])).toBe('Neón y Chispas');
    expect(joinNames(['Neón', 'Chispas', 'Grilla'])).toBe('Neón, Chispas y Grilla');
  });
});
