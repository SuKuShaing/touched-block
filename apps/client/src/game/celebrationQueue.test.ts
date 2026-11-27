import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));
vi.mock('@/platform/storage', () => ({
  storage: {
    get: (k: string) => mem.get(k) ?? null,
    set: (k: string, v: string) => void mem.set(k, v),
    remove: (k: string) => void mem.delete(k),
  },
}));
const { beep, buzz } = vi.hoisted(() => ({ beep: vi.fn(), buzz: vi.fn() }));
vi.mock('@/platform/fx', () => ({ fx: { beep, buzz } }));

import { ADD_START, MUL_START, TICKS_PER_SECOND, TIERS } from '@tb/engine';
import { CATALOG, type CatalogStats, EMPTY_CATALOG_STATS } from '@/cosmetics/catalog';
import {
  AFTER_RUN_MS,
  CELEBRATED_KEY,
  PENDING_KEY,
  absorbCelebrated,
  disarmCelebrations,
  dropCelebrations,
  getCelebrationQueue,
  observeCelebrations,
  offerCelebrations,
  offerRunCelebrations,
  parseCelebrated,
  resetCelebrationsForTests,
  seedCelebrated,
} from './celebrationQueue';
import { type Celebration, ownedKeys, runCelebrations } from './celebrations';
import { endPrize } from './endPrize';
import { FANFARE, FANFARE_BUZZ_MS, playFanfare } from './fanfare';

const neon: Celebration = { kind: 'item', key: 'item:palette:neon', item: CATALOG.find((i) => i.id === 'neon')! };
const bronce: Celebration = { kind: 'tier', key: 'tier:3', tier: TIERS[3], first: false };

beforeEach(() => {
  mem.clear();
  resetCelebrationsForTests();
});

describe('registro tb_cele2', () => {
  it('usa las claves nuevas (las de antes del reinicio no se leen)', () => {
    expect([CELEBRATED_KEY, PENDING_KEY]).toEqual(['tb_cele2', 'tb_cele2p']);
    mem.set('tb_cele1', JSON.stringify(['item:palette:neon']));
    mem.set('tb_cele1p', JSON.stringify(['tier:3']));
    expect(getCelebrationQueue().items).toEqual([]);
    expect(offerCelebrations([neon], 0, 0)).toBe(1);
  });

  it('lee solo arreglos de textos; lo dañado vuelve a sembrarse', () => {
    expect(parseCelebrated(null)).toBeNull();
    expect(parseCelebrated('{')).toBeNull();
    expect(parseCelebrated('{"a":1}')).toBeNull();
    expect([...parseCelebrated('["tier:0", 3, "", null, "item:sound:suave"]')!]).toEqual(['tier:0', 'item:sound:suave']);
  });

  it('se siembra una sola vez', () => {
    seedCelebrated(() => ['tier:0']);
    seedCelebrated(() => ['tier:5']);
    expect(JSON.parse(mem.get(CELEBRATED_KEY)!)).toEqual(['tier:0']);
  });

  it('lo ya registrado (sembrado o absorbido) no entra a la cola', () => {
    seedCelebrated(() => ['item:palette:neon']);
    expect(offerCelebrations([bronce, neon], 0, 1000)).toBe(1);
    expect(getCelebrationQueue().items.map((c) => c.key)).toEqual(['tier:3']);
    // queda registrado al ofrecerlo: aunque se cierre la app, no se repite
    resetCelebrationsForTests();
    expect(offerCelebrations([bronce], 0, 1000)).toBe(0);
    absorbCelebrated(['ach:racha:1']);
    expect(JSON.parse(mem.get(CELEBRATED_KEY)!)).toEqual(expect.arrayContaining(['tier:3', 'tier:0', 'ach:racha:1']));
  });

  it('almacenamiento que lanza: sigue en memoria', () => {
    const spy = vi.spyOn(mem, 'get').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(offerCelebrations([neon], 0, 0)).toBe(1);
    expect(offerCelebrations([neon], 0, 0)).toBe(0);
    spy.mockRestore();
  });
});

describe('cola', () => {
  it('espera antes de mostrar, se suman las que llegan y se sacan las vistas', () => {
    offerCelebrations([bronce], 900, 1000);
    expect(getCelebrationQueue().readyAt).toBe(1900);
    offerCelebrations([neon], 0, 1500);
    // una que llega después no atrasa a las que ya esperaban
    expect(getCelebrationQueue()).toMatchObject({ readyAt: 1500 });
    expect(getCelebrationQueue().items.map((c) => c.key)).toEqual(['tier:3', 'item:palette:neon']);
    dropCelebrations(1);
    expect(getCelebrationQueue().items.map((c) => c.key)).toEqual(['item:palette:neon']);
    dropCelebrations(5);
    expect(getCelebrationQueue().items).toEqual([]);
  });
});

describe('jugadores que ya tenían premios (sin tb_cele2)', () => {
  const ALL = { accounts: true, daily: true };
  const st = (p: Partial<CatalogStats>): CatalogStats => ({ ...EMPTY_CATALOG_STATS, ...p });
  const secs = (n: number) => n * TICKS_PER_SECOND;
  const keys = () => getCelebrationQueue().items.map((c) => c.key);
  /** Lo que ve la app: datos del dispositivo (`local`) y el total con la cuenta (`all`). */
  const observe = (viewer: string, local: CatalogStats, all: CatalogStats, now: number) =>
    observeCelebrations({ viewer, local, owned: () => ownedKeys(all) }, ALL, now);
  const celebrationsOf = (before: CatalogStats, after: CatalogStats) =>
    runCelebrations({ prize: endPrize(before, after, ALL), before, after, unlockedFeature: false, ctx: ALL });
  const run = (before: CatalogStats, after: CatalogStats, now: number) => offerRunCelebrations(celebrationsOf(before, after), 900, now);

  it('con muchas estadísticas: se siembra todo sin celebrar; solo se celebra lo que gana una partida', () => {
    const veteran = st({ runs: 80, bestTicks: secs(ADD_START), bestStreak: 60, totalKilled: 3000 });
    expect(observe('guest', veteran, veteran, 0)).toBe(0);
    expect(keys()).toEqual([]);
    const seeded = JSON.parse(mem.get(CELEBRATED_KEY)!) as string[];
    expect(seeded).toEqual(expect.arrayContaining(['tier:3', 'item:palette:neon', 'item:background:estrellas', 'ach:racha:3', 'ach:partidas:2']));
    // la siguiente partida sube a Plata: se celebra eso y nada de lo anterior
    const after = { ...veteran, runs: 81, bestTicks: secs(MUL_START), totalKilled: 3050 };
    expect(run(veteran, after, 1000)).toBeGreaterThan(0);
    expect(keys()).toEqual(['tier:4', 'item:sound:piano']);
  });

  it('las estadísticas de la cuenta que llegan después (GET /me, otro dispositivo) no se celebran', () => {
    const local = st({ runs: 2, bestTicks: secs(20), totalKilled: 40 });
    observe('u1', local, local, 0); // al abrir: tb_me2 sin estadísticas todavía
    const account = st({ runs: 200, bestTicks: secs(MUL_START), bestStreak: 120, totalKilled: 12000, invitedCount: 3, dailyStreakBest: 9, bestDailyPct: 92 });
    expect(observe('u1', local, account, 5000)).toBe(0);
    // ni siquiera dentro de la ventana después de una partida
    run(local, { ...local, runs: 3 }, 6000);
    expect(observe('u1', { ...local, runs: 3 }, { ...account, runs: 201, bestDailyPct: 95 }, 7000)).toBe(0);
    expect(keys()).toEqual([]);
    // quedaron registradas: una partida que "las vuelve a ganar" (p. ej. tras cerrar sesión) no las repite
    expect(offerCelebrations(celebrationsOf(local, account), 0, 8000)).toBe(0);
  });

  it('datos del dispositivo que cambian sin una partida (migración, otra pestaña): no se celebran', () => {
    observe('guest', EMPTY_CATALOG_STATS, EMPTY_CATALOG_STATS, 0);
    const migrated = st({ runs: 30, bestTicks: secs(ADD_START), totalKilled: 2500, bonusXp: 200, bestDailyPct: 80 });
    expect(observe('guest', migrated, migrated, 1000)).toBe(0);
    expect(keys()).toEqual([]);
  });

  it('justo después de una partida: la paleta que completan los bloques extra de una misión, sí', () => {
    const a = st({ runs: 11, bestTicks: secs(30), totalKilled: 270 });
    observe('guest', a, a, 0);
    const b = { ...a, runs: 12, totalKilled: 280 };
    run(a, b, 1000);
    observe('guest', b, b, 1001);
    expect(keys()).toEqual([]);
    const withBonus = { ...b, bonusXp: 30 }; // misión cumplida: nivel 3
    expect(observe('guest', withBonus, withBonus, 3000)).toBe(1);
    expect(keys()).toEqual(['item:palette:pastel']);
  });

  it('fuera de la ventana, o con otra partida en curso, no', () => {
    const a = st({ runs: 11, totalKilled: 270 });
    const bonus = { ...a, runs: 12, bonusXp: 40 };
    observe('guest', a, a, 0);
    run(a, { ...a, runs: 12 }, 1000);
    expect(observe('guest', bonus, bonus, 1000 + AFTER_RUN_MS + 1)).toBe(0);
    resetCelebrationsForTests();
    mem.clear();
    observe('guest', a, a, 0);
    run(a, { ...a, runs: 12 }, 1000);
    disarmCelebrations();
    expect(observe('guest', bonus, bonus, 2000)).toBe(0);
  });
});

describe('cola guardada', () => {
  it('lo que no se alcanzó a ver vuelve al abrir la app, y se borra al verlo', () => {
    offerCelebrations([bronce, neon], 900, 1000);
    expect(JSON.parse(mem.get(PENDING_KEY)!)).toEqual(['tier:3', 'item:palette:neon']);
    resetCelebrationsForTests(); // "se cerró la app"
    expect(getCelebrationQueue()).toMatchObject({ readyAt: 0 });
    expect(getCelebrationQueue().items).toEqual([bronce, neon]);
    dropCelebrations(2);
    expect(mem.has(PENDING_KEY)).toBe(false);
  });

  it('claves desconocidas o dañadas se ignoran', () => {
    mem.set(PENDING_KEY, JSON.stringify(['tier:99', 'item:palette:nada', 'item:palette:clasica', 'ach:racha:9', 'ach:bloques:1', 'x', 'tier:3']));
    expect(getCelebrationQueue().items.map((c) => c.key)).toEqual(['tier:3']);
    resetCelebrationsForTests();
    mem.set(PENDING_KEY, '{');
    expect(getCelebrationQueue().items).toEqual([]);
  });
});

describe('fanfarria', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    beep.mockClear();
    buzz.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('cuatro notas que suben y un acorde, con una vibración corta', () => {
    playFanfare();
    vi.runAllTimers();
    const freqs = beep.mock.calls.map((c) => c[0] as number);
    const run = FANFARE.run.map((n) => n.f);
    expect(freqs.slice(0, 4)).toEqual(run);
    expect([...run].sort((a, b) => a - b)).toEqual(run);
    expect(freqs.slice(4)).toEqual([...FANFARE.chord.notes]);
    expect(buzz.mock.calls).toEqual([[FANFARE_BUZZ_MS]]);
  });

  it('versión corta: dos notas', () => {
    playFanfare(true);
    vi.runAllTimers();
    expect(beep.mock.calls.map((c) => c[0])).toEqual(FANFARE.short.map((n) => n.f));
  });

  it('nunca lanza aunque falle el audio', () => {
    beep.mockImplementation(() => {
      throw new Error('sin audio');
    });
    expect(() => {
      playFanfare();
      vi.runAllTimers();
    }).not.toThrow();
    beep.mockReset();
  });
});
