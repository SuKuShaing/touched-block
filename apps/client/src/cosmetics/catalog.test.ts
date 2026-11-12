import { describe, expect, it } from 'vitest';
import { ADD_START, MUL_START, TICKS_PER_SECOND, TIERS } from '@tb/engine';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import {
  CATALOG,
  type CatalogStats,
  DEFAULT_SELECTION,
  EMPTY_CATALOG_STATS,
  TYPE_ORDER,
  findItem,
  fmtSeconds,
  isUnlocked,
  lockedLine,
  missingText,
  newlyUnlocked,
  resolveSelection,
  tierIndexOfStats,
  tierUp,
  unlockedIds,
} from './catalog';
import { PALETTE_IDS } from './palettes';

const stats = (p: Partial<CatalogStats> = {}): CatalogStats => ({ ...EMPTY_CATALOG_STATS, ...p });
const secs = (s: number) => s * TICKS_PER_SECOND;
const get = (type: Parameters<typeof findItem>[0], id: string) => {
  const it = findItem(type, id);
  if (!it) throw new Error(`no existe ${type}:${id}`);
  return it;
};

describe('catálogo', () => {
  it('tiene ids únicos por tipo y todos los tipos', () => {
    const keys = CATALOG.map((i) => `${i.type}:${i.id}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TYPE_ORDER) expect(CATALOG.some((i) => i.type === t)).toBe(true);
  });

  it('cada paleta del catálogo existe y al revés', () => {
    const ids = CATALOG.filter((i) => i.type === 'palette').map((i) => i.id);
    expect(ids.sort()).toEqual([...PALETTE_IDS].sort());
  });

  it('los valores por defecto coinciden con tb_set1 y vienen desbloqueados', () => {
    expect(DEFAULT_SELECTION).toEqual({
      palette: DEFAULT_SETTINGS.palette,
      soundPack: DEFAULT_SETTINGS.soundPack,
      effect: DEFAULT_SETTINGS.effect,
      background: DEFAULT_SETTINGS.background,
    });
    expect(isUnlocked(get('palette', 'clasica'), EMPTY_CATALOG_STATS)).toBe(true);
    expect(isUnlocked(get('sound', '8bits'), EMPTY_CATALOG_STATS)).toBe(true);
    expect(isUnlocked(get('effect', 'normal'), EMPTY_CATALOG_STATS)).toBe(true);
    expect(isUnlocked(get('background', 'liso'), EMPTY_CATALOG_STATS)).toBe(true);
  });

  it('un jugador nuevo tiene solo lo gratis (con Alto contraste, D9)', () => {
    expect(unlockedIds(EMPTY_CATALOG_STATS)).toEqual(['palette:clasica', 'palette:contraste', 'sound:8bits', 'effect:normal', 'background:liso']);
  });

  it('todo tiene un requisito escrito', () => {
    for (const i of CATALOG) expect(i.goal.length).toBeGreaterThan(3);
    expect(get('palette', 'neon').goal).toBe('Llega a las sumas y restas');
    expect(get('palette', 'pastel').goal).toBe('Llega al 5');
    expect(get('background', 'aurora').goal).toBe('Llega al nivel 20');
  });
});

describe('condiciones', () => {
  it('insignias por duración de la mejor partida', () => {
    const neon = get('palette', 'neon');
    expect(isUnlocked(neon, stats({ runs: 3, bestTicks: secs(ADD_START) - 1 }))).toBe(false);
    expect(isUnlocked(neon, stats({ runs: 3, bestTicks: secs(ADD_START) }))).toBe(true);
    expect(isUnlocked(get('palette', 'retro'), stats({ runs: 1, bestTicks: secs(MUL_START) }))).toBe(true);
    expect(isUnlocked(get('sound', 'marimba'), stats({ runs: 1, bestTicks: secs(MUL_START) }))).toBe(true);
    expect(isUnlocked(get('effect', 'chispas'), stats({ runs: 1, bestTicks: secs(TIERS[2].at) }))).toBe(true);
    expect(isUnlocked(get('palette', 'diamante'), stats({ runs: 1, bestTicks: secs(TIERS[6].at) }))).toBe(true);
  });

  it('partidas, racha, invitados, nivel y reto diario', () => {
    expect(isUnlocked(get('sound', 'suave'), stats({ runs: 1 }))).toBe(true);
    expect(isUnlocked(get('effect', 'confeti'), stats({ bestStreak: 24 }))).toBe(false);
    expect(isUnlocked(get('effect', 'confeti'), stats({ bestStreak: 25 }))).toBe(true);
    expect(isUnlocked(get('effect', 'corazones'), stats({ invitedCount: 1 }))).toBe(true);
    // nivel 5 = 500 bloques, sumando los extra de las misiones
    expect(isUnlocked(get('background', 'grilla'), stats({ totalKilled: 499 }))).toBe(false);
    expect(isUnlocked(get('background', 'grilla'), stats({ totalKilled: 450, bonusXp: 50 }))).toBe(true);
    expect(isUnlocked(get('background', 'estrellas'), stats({ totalKilled: 2250 }))).toBe(true);
    expect(isUnlocked(get('background', 'aurora'), stats({ totalKilled: 9499 }))).toBe(false);
    expect(isUnlocked(get('palette', 'constancia'), stats({ dailyStreakBest: 7 }))).toBe(true);
  });

  it('la insignia necesita al menos una partida', () => {
    expect(tierIndexOfStats(stats())).toBe(-1);
    expect(tierIndexOfStats(stats({ runs: 1, bestTicks: 600 }))).toBe(0);
    expect(tierIndexOfStats(stats({ runs: 1, bestTicks: secs(ADD_START) }))).toBe(3);
  });
});

describe('newlyUnlocked y tierUp', () => {
  it('detecta lo que desbloqueó una partida', () => {
    const before = stats({ runs: 4, bestTicks: secs(120), totalKilled: 480, bestStreak: 20 });
    const after = stats({ runs: 5, bestTicks: secs(150), totalKilled: 530, bestStreak: 26 });
    expect(newlyUnlocked(before, after).map((i) => i.id)).toEqual(['neon', 'confeti', 'grilla']);
    expect(tierUp(before, after)?.name).toBe('Bronce');
  });

  it('la primera partida da Suave y Madera I', () => {
    const after = stats({ runs: 1, bestTicks: secs(15), totalKilled: 4 });
    expect(newlyUnlocked(EMPTY_CATALOG_STATS, after).map((i) => i.id)).toEqual(['suave']);
    expect(tierUp(EMPTY_CATALOG_STATS, after)?.name).toBe('Madera I');
  });

  it('nada nuevo si no cambió nada', () => {
    const s = stats({ runs: 9, bestTicks: secs(200) });
    expect(newlyUnlocked(s, s)).toEqual([]);
    expect(tierUp(s, s)).toBeNull();
  });
});

describe('missingText', () => {
  it('insignias: cuánto le faltó a la mejor partida', () => {
    const neon = get('palette', 'neon');
    expect(missingText(neon, stats({ runs: 2, bestTicks: secs(112) }))).toBe('te faltaron 28 s');
    expect(missingText(neon, stats({ runs: 2, bestTicks: secs(112) + 30 }))).toBe('te faltaron 28 s'); // 27,5 s → 28
    expect(missingText(neon, stats())).toBe('te faltan 2 min 20 s');
    expect(missingText(neon, stats({ runs: 2, bestTicks: secs(ADD_START) }))).toBeNull();
  });

  it('bloques, partidas, racha, amigos y días', () => {
    expect(missingText(get('background', 'grilla'), stats({ totalKilled: 380 }))).toBe('te faltan 120 bloques');
    expect(missingText(get('background', 'grilla'), stats({ totalKilled: 499 }))).toBe('te falta 1 bloque');
    expect(missingText(get('background', 'estrellas'), stats({ totalKilled: 600 }))).toBe('te faltan 1.650 bloques');
    const threeRuns = { ...get('sound', 'suave'), req: { kind: 'runs' as const, n: 3 } };
    expect(missingText(threeRuns, stats({ runs: 1 }))).toBe('te faltan 2 partidas');
    expect(missingText(get('effect', 'confeti'), stats({ bestStreak: 12 }))).toBe('te faltaron 13 bloques seguidos');
    const twoFriends = { ...get('effect', 'corazones'), req: { kind: 'invited' as const, n: 2 } };
    expect(missingText(twoFriends, stats({ invitedCount: 1 }))).toBe('te falta 1 amigo');
    expect(missingText(get('palette', 'constancia'), stats({ dailyStreakBest: 3 }))).toBe('te faltaron 4 días');
    expect(missingText(get('palette', 'clasica'), stats())).toBeNull();
  });

  it('sin avance no repite el requisito', () => {
    expect(missingText(get('sound', 'suave'), stats())).toBeNull();
    expect(missingText(get('effect', 'confeti'), stats())).toBeNull();
    expect(missingText(get('effect', 'corazones'), stats())).toBeNull();
    expect(missingText(get('palette', 'constancia'), stats())).toBeNull();
    expect(lockedLine(get('sound', 'suave'), stats())).toBe('Suave: termina 1 partida');
  });

  it('arma la línea del premio bloqueado', () => {
    expect(lockedLine(get('palette', 'neon'), stats({ runs: 1, bestTicks: secs(112) }))).toBe(
      'Neón: llega a las sumas y restas · te faltaron 28 s',
    );
  });

  it('formatea segundos', () => {
    expect(fmtSeconds(28)).toBe('28 s');
    expect(fmtSeconds(27.2)).toBe('28 s');
    expect(fmtSeconds(60)).toBe('1 min');
    expect(fmtSeconds(390)).toBe('6 min 30 s');
  });
});

describe('resolveSelection', () => {
  const pro = stats({ runs: 50, bestTicks: secs(300), totalKilled: 3000, bestStreak: 40 });

  it('usa lo elegido si está desbloqueado', () => {
    expect(resolveSelection({ palette: 'retro', soundPack: 'marimba', effect: 'confeti', background: 'estrellas' }, pro)).toEqual({
      palette: 'retro',
      soundPack: 'marimba',
      effect: 'confeti',
      background: 'estrellas',
    });
    expect(resolveSelection({ palette: 'contraste' }, EMPTY_CATALOG_STATS).palette).toBe('contraste');
  });

  it('vuelve al valor por defecto si está bloqueado o no existe', () => {
    expect(resolveSelection({ palette: 'dorado', soundPack: 'nada', effect: 'corazones', background: 'aurora' }, pro)).toEqual(
      DEFAULT_SELECTION,
    );
    expect(resolveSelection({}, pro)).toEqual(DEFAULT_SELECTION);
    // un id de otro tipo no sirve
    expect(resolveSelection({ palette: 'suave' }, pro).palette).toBe('clasica');
  });
});
