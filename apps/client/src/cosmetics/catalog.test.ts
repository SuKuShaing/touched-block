import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENTS, ADD_START, MUL_START, TICKS_PER_SECOND, TIERS } from '@tb/engine';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import {
  CATALOG,
  type CatalogStats,
  type CosmeticType,
  DEFAULT_SELECTION,
  EMPTY_CATALOG_STATS,
  findItem,
  fmtSeconds,
  isUnlocked,
  itemsOfType,
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
const get = (type: CosmeticType, id: string) => {
  const it = findItem(type, id);
  if (!it) throw new Error(`no existe ${type}:${id}`);
  return it;
};
const ids = (type: CosmeticType) => itemsOfType(type).map((i) => i.id);

describe('catálogo', () => {
  it('tiene 55 premios con ids únicos', () => {
    expect(CATALOG).toHaveLength(55);
    expect(new Set(CATALOG.map((i) => i.id + ':' + i.type)).size).toBe(55);
  });

  it('en este orden', () => {
    expect(ids('palette').join(' ')).toBe(
      'clasica contraste pastel neon tenue cristal retro boton contorno degrade dorado esmerilado diamante constancia',
    );
    expect(ids('sound').join(' ')).toBe('8bits suave marimba palitos electronico viento piano guitarra futurista');
    expect(ids('effect').join(' ')).toBe(
      'normal chispas emojis confeti burbujas ondas rayos monedas pixeles fugaces fuegos corazones',
    );
    expect(ids('background').join(' ')).toBe(
      'liso grilla rayas estrellas puntos circuito aurora hexagonos atardecer topografia oceano ciudad cristales lluvia nebulosa nieve luciernagas vitral galaxia bosque',
    );
    // por tipo y sin mezclar
    expect(CATALOG.map((i) => i.type)).toEqual([
      ...Array(14).fill('palette'),
      ...Array(9).fill('sound'),
      ...Array(12).fill('effect'),
      ...Array(20).fill('background'),
    ]);
  });

  it('las paletas que ya se dibujan están en el catálogo', () => {
    expect(PALETTE_IDS.filter((id) => !findItem('palette', id))).toEqual([]);
  });

  it('cada escalón de cada logro entrega exactamente un premio (28), según el reparto', () => {
    const table = ACHIEVEMENTS.map((a) =>
      [1, 2, 3, 4, 5, 6, 7]
        .map((level) => {
          const found = CATALOG.filter((i) => i.req.kind === 'achievement' && i.req.id === a.id && i.req.level === level);
          expect(found).toHaveLength(1);
          return `${found[0].type === 'effect' ? 'E' : found[0].type === 'background' ? 'F' : '?'}:${found[0].id}`;
        })
        .join(' '),
    );
    expect(Object.fromEntries(ACHIEVEMENTS.map((a, i) => [a.id, table[i]]))).toEqual({
      racha: 'F:grilla E:confeti F:circuito E:rayos F:oceano F:nebulosa E:pixeles',
      partidas: 'E:chispas F:estrellas F:aurora E:monedas F:ciudad F:nieve F:galaxia',
      diasReto: 'E:emojis F:puntos E:ondas F:atardecer F:cristales F:luciernagas E:fugaces',
      mejorReto: 'F:rayas E:burbujas F:hexagonos F:topografia F:lluvia F:vitral E:fuegos',
    });
    expect(CATALOG.filter((i) => i.req.kind === 'achievement')).toHaveLength(28);
  });

  it('paletas por nivel, sonidos por insignia y tres premios por invitar', () => {
    expect(itemsOfType('palette').flatMap((i) => (i.req.kind === 'level' ? [i.req.n] : []))).toEqual([
      3, 7, 9, 12, 15, 16, 18, 22, 25, 27, 30,
    ]);
    expect(itemsOfType('sound').flatMap((i) => (i.req.kind === 'tier' ? [i.req.index] : []))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(CATALOG.flatMap((i) => (i.req.kind === 'invited' ? [[i.id, i.req.n]] : []))).toEqual([
      ['constancia', 2],
      ['corazones', 1],
      ['bosque', 3],
    ]);
  });

  it('invitar necesita cuentas y los logros del reto, el reto diario', () => {
    for (const i of CATALOG) {
      const daily = i.req.kind === 'achievement' && (i.req.id === 'diasReto' || i.req.id === 'mejorReto');
      expect(i.requires).toBe(i.req.kind === 'invited' ? 'accounts' : daily ? 'daily' : undefined);
    }
    expect(CATALOG.filter((i) => i.requires === 'daily')).toHaveLength(14);
  });

  it('los valores por defecto coinciden con tb_set1 y vienen desbloqueados', () => {
    expect(DEFAULT_SELECTION).toEqual({
      palette: DEFAULT_SETTINGS.palette,
      soundPack: DEFAULT_SETTINGS.soundPack,
      effect: DEFAULT_SETTINGS.effect,
      background: DEFAULT_SETTINGS.background,
    });
  });

  it('un jugador nuevo tiene solo lo gratis (con Alto contraste, D9)', () => {
    expect(unlockedIds(EMPTY_CATALOG_STATS)).toEqual(['palette:clasica', 'palette:contraste', 'sound:8bits', 'effect:normal', 'background:liso']);
  });

  it('nombres y requisitos escritos', () => {
    for (const i of CATALOG) expect(i.goal.length).toBeGreaterThan(3);
    expect(get('palette', 'constancia').name).toBe('Amistad');
    expect(get('palette', 'degrade').name).toBe('Degradé');
    expect(get('palette', 'neon').goal).toBe('Llega al nivel 7');
    expect(get('sound', 'marimba').goal).toBe('Insignia Papel · Llega al 4');
    expect(get('sound', 'viento').goal).toBe('Insignia Bronce · Llega a las sumas y restas');
    expect(get('sound', 'suave').goal).toBe('Termina 1 partida');
    expect(get('effect', 'corazones').goal).toBe('Invita a 1 amigo');
    expect(get('background', 'bosque').goal).toBe('Invita a 3 amigos');
    expect(get('background', 'grilla').goal).toBe('Logro Máximo combo · Papel (racha de 10)');
    expect(get('background', 'galaxia').goal).toBe('Logro Partidas jugadas · Diamante (juega 6.000 partidas)');
    expect(get('effect', 'ondas').goal).toBe('Logro Días seguidos de reto diario · Madera (juega el reto 14 días seguidos)');
    expect(get('background', 'rayas').goal).toBe('Logro Mejor resultado en un reto diario · Papel (participa en un reto diario)');
  });
});

describe('condiciones', () => {
  it('insignias por duración de la mejor partida', () => {
    TIERS.forEach((t, i) => {
      const item = CATALOG.find((x) => x.req.kind === 'tier' && x.req.index === i)!;
      expect(isUnlocked(item, stats({ runs: 1, bestTicks: secs(t.at) - 1 }))).toBe(false);
      expect(isUnlocked(item, stats({ runs: 1, bestTicks: secs(t.at) }))).toBe(true);
    });
  });

  it('partidas, invitados y nivel (con los bloques de las misiones)', () => {
    expect(isUnlocked(get('sound', 'suave'), stats({ runs: 1 }))).toBe(true);
    expect(isUnlocked(get('effect', 'corazones'), stats({ invitedCount: 1 }))).toBe(true);
    expect(isUnlocked(get('palette', 'constancia'), stats({ invitedCount: 1, dailyStreakBest: 99 }))).toBe(false);
    expect(isUnlocked(get('palette', 'constancia'), stats({ invitedCount: 2 }))).toBe(true);
    // nivel 3 = 300 bloques
    expect(isUnlocked(get('palette', 'pastel'), stats({ totalKilled: 299 }))).toBe(false);
    expect(isUnlocked(get('palette', 'pastel'), stats({ totalKilled: 250, bonusXp: 50 }))).toBe(true);
    expect(isUnlocked(get('palette', 'diamante'), stats({ totalKilled: 23249 }))).toBe(false);
    expect(isUnlocked(get('palette', 'diamante'), stats({ totalKilled: 23250 }))).toBe(true);
  });

  it('logros: combo, partidas, días y porcentaje del reto', () => {
    expect(isUnlocked(get('effect', 'confeti'), stats({ bestStreak: 24 }))).toBe(false);
    expect(isUnlocked(get('effect', 'confeti'), stats({ bestStreak: 25 }))).toBe(true);
    expect(isUnlocked(get('effect', 'chispas'), stats({ runs: 9 }))).toBe(false);
    expect(isUnlocked(get('effect', 'chispas'), stats({ runs: 10 }))).toBe(true);
    expect(isUnlocked(get('effect', 'emojis'), stats({ dailyStreakBest: 3 }))).toBe(true);
    // nunca participó no es lo mismo que participar con 0 %
    expect(isUnlocked(get('background', 'rayas'), stats({ bestDailyPct: null }))).toBe(false);
    expect(isUnlocked(get('background', 'rayas'), stats({ bestDailyPct: 0 }))).toBe(true);
    expect(isUnlocked(get('effect', 'fuegos'), stats({ bestDailyPct: 98 }))).toBe(false);
    expect(isUnlocked(get('effect', 'fuegos'), stats({ bestDailyPct: 99 }))).toBe(true);
  });

  it('sin insignia bajo los 20 s', () => {
    expect(tierIndexOfStats(stats())).toBe(-1);
    expect(tierIndexOfStats(stats({ runs: 5, bestTicks: secs(20) - 1 }))).toBe(-1);
    expect(tierIndexOfStats(stats({ runs: 1, bestTicks: secs(20) }))).toBe(0);
    expect(tierIndexOfStats(stats({ runs: 1, bestTicks: secs(ADD_START) }))).toBe(3);
  });
});

describe('newlyUnlocked y tierUp', () => {
  it('detecta lo que desbloqueó una partida, en el orden del catálogo', () => {
    const before = stats({ runs: 11, bestTicks: secs(120), totalKilled: 280, bestStreak: 20 });
    const after = stats({ runs: 12, bestTicks: secs(150), totalKilled: 320, bestStreak: 26 });
    expect(newlyUnlocked(before, after).map((i) => i.id)).toEqual(['pastel', 'viento', 'confeti']);
    expect(tierUp(before, after)?.name).toBe('Bronce');
  });

  it('la primera partida da Suave; Papel y Marimba solo si llega a los 20 s', () => {
    const short = stats({ runs: 1, bestTicks: secs(15), totalKilled: 4 });
    expect(newlyUnlocked(EMPTY_CATALOG_STATS, short).map((i) => i.id)).toEqual(['suave']);
    expect(tierUp(EMPTY_CATALOG_STATS, short)).toBeNull();
    const long = stats({ runs: 1, bestTicks: secs(25), totalKilled: 8 });
    expect(newlyUnlocked(EMPTY_CATALOG_STATS, long).map((i) => i.id)).toEqual(['suave', 'marimba']);
    expect(tierUp(EMPTY_CATALOG_STATS, long)?.name).toBe('Papel');
  });

  it('nada nuevo si no cambió nada', () => {
    const s = stats({ runs: 9, bestTicks: secs(200) });
    expect(newlyUnlocked(s, s)).toEqual([]);
    expect(tierUp(s, s)).toBeNull();
  });
});

describe('missingText', () => {
  it('insignias: cuánto le faltó a la mejor partida', () => {
    const viento = get('sound', 'viento');
    expect(missingText(viento, stats({ runs: 2, bestTicks: secs(112) }))).toBe('te faltaron 28 s');
    expect(missingText(viento, stats({ runs: 2, bestTicks: secs(112) + 30 }))).toBe('te faltaron 28 s'); // 27,5 s → 28
    expect(missingText(viento, stats())).toBe('te faltan 2 min 20 s');
    expect(missingText(viento, stats({ runs: 2, bestTicks: secs(ADD_START) }))).toBeNull();
  });

  it('nivel, partidas y amigos', () => {
    expect(missingText(get('palette', 'neon'), stats({ totalKilled: 1280 }))).toBe('te faltan 120 bloques');
    expect(missingText(get('palette', 'neon'), stats({ totalKilled: 1399 }))).toBe('te falta 1 bloque');
    expect(missingText(get('palette', 'retro'), stats({ totalKilled: 600 }))).toBe('te faltan 5.400 bloques');
    const threeRuns = { ...get('sound', 'suave'), req: { kind: 'runs' as const, n: 3 } };
    expect(missingText(threeRuns, stats({ runs: 1 }))).toBe('te faltan 2 partidas');
    expect(missingText(get('palette', 'constancia'), stats({ invitedCount: 1 }))).toBe('te falta 1 amigo');
    expect(missingText(get('palette', 'clasica'), stats())).toBeNull();
  });

  it('logros', () => {
    expect(missingText(get('effect', 'confeti'), stats({ bestStreak: 12 }))).toBe('te faltaron 13 bloques seguidos');
    expect(missingText(get('effect', 'confeti'), stats({ bestStreak: 24 }))).toBe('te faltó 1 bloque seguido');
    expect(missingText(get('background', 'estrellas'), stats({ runs: 48 }))).toBe('te faltan 2 partidas');
    expect(missingText(get('background', 'estrellas'), stats({ runs: 49 }))).toBe('te falta 1 partida');
    expect(missingText(get('effect', 'ondas'), stats({ dailyStreakBest: 10 }))).toBe('te faltaron 4 días');
    expect(missingText(get('background', 'hexagonos'), stats({ bestDailyPct: 20 }))).toBeNull();
    expect(missingText(get('effect', 'confeti'), stats({ bestStreak: 25 }))).toBeNull();
  });

  it('sin avance no repite el requisito', () => {
    for (const [type, id] of [
      ['sound', 'suave'],
      ['effect', 'confeti'],
      ['effect', 'chispas'],
      ['effect', 'ondas'],
      ['background', 'rayas'],
      ['effect', 'corazones'],
    ] as const) {
      expect(missingText(get(type, id), stats())).toBeNull();
    }
    expect(lockedLine(get('sound', 'suave'), stats())).toBe('Suave: termina 1 partida');
  });

  it('arma la línea del premio bloqueado', () => {
    expect(lockedLine(get('sound', 'viento'), stats({ runs: 1, bestTicks: secs(112) }))).toBe(
      'Viento: insignia Bronce · Llega a las sumas y restas · te faltaron 28 s',
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
  const pro = stats({ runs: 50, bestTicks: secs(MUL_START), totalKilled: 3000, bestStreak: 40 });

  it('usa lo elegido si está desbloqueado', () => {
    expect(resolveSelection({ palette: 'neon', soundPack: 'piano', effect: 'confeti', background: 'estrellas' }, pro)).toEqual({
      palette: 'neon',
      soundPack: 'piano',
      effect: 'confeti',
      background: 'estrellas',
    });
    expect(resolveSelection({ palette: 'contraste' }, EMPTY_CATALOG_STATS).palette).toBe('contraste');
  });

  it('vuelve al valor por defecto si está bloqueado o no existe (un fondo bloqueado cae en liso)', () => {
    expect(resolveSelection({ palette: 'dorado', soundPack: 'nada', effect: 'corazones', background: 'aurora' }, pro)).toEqual(
      DEFAULT_SELECTION,
    );
    expect(resolveSelection({ background: 'galaxia' }, pro).background).toBe('liso');
    expect(resolveSelection({}, pro)).toEqual(DEFAULT_SELECTION);
    // un id de otro tipo no sirve
    expect(resolveSelection({ palette: 'suave' }, pro).palette).toBe('clasica');
  });
});

describe('unlockAll (solo el APK de prueba)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('con EXPO_PUBLIC_UNLOCK_ALL=1 se puede usar todo, sin "ganar" insignias', async () => {
    vi.stubEnv('EXPO_PUBLIC_UNLOCK_ALL', '1');
    vi.resetModules();
    const c = await import('./catalog');
    expect(c.unlockedIds(c.EMPTY_CATALOG_STATS)).toHaveLength(55);
    expect(c.missingText(c.findItem('palette', 'neon')!, c.EMPTY_CATALOG_STATS)).toBeNull();
    expect(c.resolveSelection({ background: 'galaxia' }, c.EMPTY_CATALOG_STATS).background).toBe('galaxia');
    expect(c.newlyUnlocked(c.EMPTY_CATALOG_STATS, { ...c.EMPTY_CATALOG_STATS, runs: 1 })).toEqual([]);
    expect(c.tierIndexOfStats(c.EMPTY_CATALOG_STATS)).toBe(-1);
  });

  it('cualquier otro valor no desbloquea nada', async () => {
    vi.stubEnv('EXPO_PUBLIC_UNLOCK_ALL', 'true');
    vi.resetModules();
    const c = await import('./catalog');
    expect(c.unlockedIds(c.EMPTY_CATALOG_STATS)).toHaveLength(5);
  });
});
