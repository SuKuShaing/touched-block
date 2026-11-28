import { describe, expect, it } from 'vitest';
import { ADD_START, NUM_STEP, TICKS_PER_SECOND, TIERS } from '@tb/engine';
import { type CatalogStats, EMPTY_CATALOG_STATS } from '@/cosmetics/catalog';
import {
  type Celebration,
  FEATURE_DAILY_KEY,
  type Snapshot,
  accountCelebrations,
  celebrationFromKey,
  celebrationTexts,
  coveredKeys,
  outsideCelebrations,
  ownedKeys,
  pendingCelebrations,
  pendingKey,
  runCelebrations,
  stepText,
  unseededAccountKeys,
} from './celebrations';
import { endPrize } from './endPrize';

const stats = (p: Partial<CatalogStats>): CatalogStats => ({ ...EMPTY_CATALOG_STATS, ...p });
const secs = (s: number) => s * TICKS_PER_SECOND;
const ALL = { accounts: true, daily: true };
const NONE = { accounts: false, daily: false };

/** Celebraciones al terminar una partida, como las arma GameScreen. */
function afterRun(before: CatalogStats, after: CatalogStats, ctx = ALL, unlockedFeature = false): Celebration[] {
  return runCelebrations({ prize: endPrize(before, after, ctx), before, after, unlockedFeature, ctx });
}
const keys = (l: readonly Celebration[]) => l.map((c) => c.key);

describe('qué se celebra al terminar una partida', () => {
  it('nada nuevo: nada', () => {
    const a = stats({ runs: 3, bestTicks: secs(10), totalKilled: 30, bestStreak: 5 });
    expect(afterRun(a, { ...a, runs: 4, totalKilled: 40 })).toEqual([]);
  });

  it('primera partida: insignia primero, después el premio y el logro', () => {
    const l = afterRun(EMPTY_CATALOG_STATS, stats({ runs: 1, bestTicks: secs(25), totalKilled: 8, bestStreak: 12 }));
    expect(keys(l)).toEqual(['tier:0', 'item:sound:suave', 'item:sound:marimba', 'item:background:grilla', 'ach:racha:1']);
    expect(l[0]).toMatchObject({ kind: 'tier', first: true });
  });

  it('una primera partida de menos de 20 s no da insignia', () => {
    expect(keys(afterRun(EMPTY_CATALOG_STATS, stats({ runs: 1, bestTicks: secs(15), totalKilled: 4 })))).toEqual(['item:sound:suave']);
  });

  it('subir a Bronce: la insignia, los premios y después los logros', () => {
    const a = stats({ runs: 11, bestTicks: secs(ADD_START - 1), totalKilled: 280, bestStreak: 20 });
    const b = stats({ runs: 12, bestTicks: secs(ADD_START), totalKilled: 320, bestStreak: 26 });
    expect(keys(afterRun(a, b))).toEqual(['tier:3', 'item:palette:pastel', 'item:sound:viento', 'item:effect:confeti', 'ach:racha:2']);
  });

  it('un logro que salta dos materiales se celebra una vez, con el más alto', () => {
    const l = afterRun(stats({ runs: 1, bestTicks: secs(10) }), stats({ runs: 2, bestTicks: secs(10), bestStreak: 30 }));
    expect(keys(l)).toEqual(['item:effect:confeti', 'item:background:grilla', 'ach:racha:2']);
    expect(celebrationTexts(l[2])).toMatchObject({ kicker: 'Logro nuevo', title: '¡Máximo combo · Cartón!', name: null, sub: 'Racha de 25.' });
  });

  it('el reto del día y las misiones van al final', () => {
    const a = stats({ runs: 9, bestTicks: secs(10) });
    const b = stats({ runs: 10, bestTicks: secs(NUM_STEP * 2 + 1) });
    expect(keys(afterRun(a, b, ALL, true))).toEqual([
      'tier:0',
      'item:sound:marimba',
      'item:effect:chispas',
      'ach:partidas:1',
      FEATURE_DAILY_KEY,
    ]);
  });

  it('sin API no se celebra lo que necesita cuentas o el reto diario', () => {
    const a = stats({ runs: 5, dailyStreakBest: 2 });
    const b = stats({ runs: 6, dailyStreakBest: 7 });
    expect(keys(afterRun(a, b, ALL))).toEqual(['item:effect:emojis', 'item:background:puntos', 'ach:diasReto:2']);
    expect(afterRun(a, b, NONE)).toEqual([]);
  });
});

describe('sin repetir', () => {
  const bronce = afterRun(stats({ runs: 11, bestTicks: secs(ADD_START - 1) }), stats({ runs: 12, bestTicks: secs(ADD_START) }));

  it('saca lo ya celebrado y marca también lo que deja atrás', () => {
    const { show, mark } = pendingCelebrations(bronce, new Set(['item:sound:viento']));
    expect(keys(show)).toEqual(['tier:3']);
    // subir a Bronce cuenta todas las insignias anteriores
    expect(mark).toEqual(['tier:0', 'tier:1', 'tier:2', 'tier:3']);
  });

  it('dos veces lo mismo en la lista: una sola', () => {
    const { show } = pendingCelebrations([...bronce, ...bronce], new Set());
    expect(keys(show)).toEqual(['tier:3', 'item:sound:viento']);
  });

  it('una insignia menor ya cubierta por una mayor no se celebra', () => {
    const seen = new Set(coveredKeys(bronce[0]));
    const carton: Celebration = { kind: 'tier', key: 'tier:1', tier: TIERS[1], first: false };
    expect(pendingCelebrations([carton], seen).show).toEqual([]);
  });

  it('logro en Madera cubre Papel y Cartón', () => {
    expect(coveredKeys({ kind: 'achievement', key: 'ach:racha:3', id: 'racha', level: 3, material: 'Madera' })).toEqual([
      'ach:racha:1',
      'ach:racha:2',
      'ach:racha:3',
    ]);
  });

  it('ownedKeys: lo que ya tiene (para sembrar el registro)', () => {
    const k = ownedKeys(stats({ runs: 10, bestTicks: secs(ADD_START), bestStreak: 25, bestDailyPct: 60 }));
    expect(k).toEqual(
      expect.arrayContaining([
        'tier:0',
        'tier:3',
        'item:sound:viento',
        'item:sound:suave',
        'item:background:hexagonos',
        'ach:racha:2',
        'ach:partidas:1',
        'ach:mejorReto:3',
      ]),
    );
    expect(k).not.toContain('tier:4');
    expect(k).not.toContain('item:palette:clasica'); // lo de siempre no se celebra
    expect(ownedKeys(EMPTY_CATALOG_STATS)).toEqual([]);
  });

  it('lo sembrado no se vuelve a celebrar (cerrar sesión y volver a ganarlo)', () => {
    const seen = new Set(ownedKeys(stats({ runs: 30, bestTicks: secs(ADD_START) })));
    // solo con las del dispositivo (menos que la cuenta), una partida "vuelve a desbloquear" Viento
    const again = afterRun(stats({ runs: 1, bestTicks: secs(10) }), stats({ runs: 2, bestTicks: secs(ADD_START) }));
    expect(keys(again)).toContain('item:sound:viento');
    expect(pendingCelebrations(again, seen).show).toEqual([]);
  });
});

describe('fuera de la partida', () => {
  const snap = (p: Partial<CatalogStats>, viewer = 'u1'): Snapshot => ({ viewer, stats: stats(p) });

  it('invitar a un amigo desbloquea Corazones', () => {
    const l = outsideCelebrations(snap({ runs: 5 }), snap({ runs: 5, invitedCount: 1 }), ALL);
    expect(keys(l)).toEqual(['item:effect:corazones']);
    expect(celebrationTexts(l[0]).sub).toBe('Porque un amigo se unió con tu invitación');
    expect(outsideCelebrations(snap({ runs: 5 }), snap({ runs: 5, invitedCount: 1 }), NONE)).toEqual([]);
  });

  it('los bloques extra de una misión completan el nivel 3: Pastel', () => {
    expect(keys(outsideCelebrations(snap({ totalKilled: 280 }), snap({ totalKilled: 280, bonusXp: 30 }), ALL))).toEqual([
      'item:palette:pastel',
    ]);
  });

  it('mejor resultado en un reto diario: sus premios y el logro', () => {
    const l = outsideCelebrations(snap({ bestDailyPct: null }), snap({ bestDailyPct: 0 }), ALL);
    expect(keys(l)).toEqual(['item:background:rayas', 'ach:mejorReto:1']);
    expect(keys(outsideCelebrations(snap({ bestDailyPct: 40 }), snap({ bestDailyPct: 80 }), ALL))).toEqual([
      'item:background:hexagonos',
      'item:background:topografia',
      'ach:mejorReto:4',
    ]);
    expect(outsideCelebrations(snap({ bestDailyPct: null }), snap({ bestDailyPct: 0 }), NONE)).toEqual([]);
  });

  it('los premios de los otros logros solo salen con una partida', () => {
    expect(outsideCelebrations(snap({}), snap({ bestStreak: 30, runs: 60, dailyStreakBest: 8 }), ALL)).toEqual([]);
  });

  it('insignias y premios de partidas (otro dispositivo) no se celebran aquí', () => {
    expect(outsideCelebrations(snap({ runs: 1 }), snap({ runs: 90, bestTicks: secs(ADD_START), bestStreak: 40 }), ALL)).toEqual([]);
  });

  it('si cambió el jugador (inicio de sesión) o es la primera vez, nada', () => {
    expect(outsideCelebrations(null, snap({ invitedCount: 1 }), ALL)).toEqual([]);
    expect(outsideCelebrations(snap({}, 'guest'), snap({ invitedCount: 3, totalKilled: 9999 }, 'u1'), ALL)).toEqual([]);
  });
});

describe('desde la clave', () => {
  it('cada celebración se recupera igual desde su clave', () => {
    const all = afterRun(stats({ runs: 2, bestTicks: secs(25) }), stats({ runs: 3, bestTicks: secs(ADD_START), bestStreak: 30, totalKilled: 600 }), ALL, true);
    expect(all.length).toBeGreaterThan(5);
    for (const c of all) expect(celebrationFromKey(c.key)).toEqual(c);
    expect(celebrationFromKey('tier:0')).toMatchObject({ first: true });
  });
  it('la primera insignia se recuerda aunque sea más alta que Papel', () => {
    const [bronce] = afterRun(EMPTY_CATALOG_STATS, stats({ runs: 1, bestTicks: secs(ADD_START) }));
    expect(bronce).toMatchObject({ key: 'tier:3', first: true });
    expect(pendingKey(bronce)).toBe('tier:3:first');
    expect(celebrationFromKey(pendingKey(bronce))).toEqual(bronce);
    expect(celebrationFromKey('tier:3')).toMatchObject({ first: false });
  });
  it('claves inválidas (y las del logro que ya no existe): null', () => {
    for (const k of ['', 'tier:7', 'tier:-1', 'tier:1:x', 'tier:1:first:x', 'item:palette:clasica', 'item:foo:neon', 'ach:racha:0', 'ach:racha:8', 'ach:bloques:1', 'ach:nada:1', 'feature:otra']) {
      expect(celebrationFromKey(k)).toBeNull();
    }
  });
});

describe('con la cuenta', () => {
  it('premios por invitar y por el porcentaje del reto que ya tiene, y nada más', () => {
    const s = stats({ runs: 90, bestTicks: secs(ADD_START), bestStreak: 40, totalKilled: 9999, invitedCount: 2, bestDailyPct: 30 });
    expect(keys(accountCelebrations(s, ALL))).toEqual([
      'item:palette:constancia',
      'item:effect:burbujas',
      'item:effect:corazones',
      'item:background:rayas',
      'ach:mejorReto:2',
    ]);
    expect(accountCelebrations(stats({ runs: 5 }), ALL)).toEqual([]);
    expect(accountCelebrations(s, NONE)).toEqual([]);
  });

  it('los días seguidos de reto de la cuenta: sus premios y el logro', () => {
    const s = stats({ runs: 90, dailyStreakBest: 7 });
    expect(keys(accountCelebrations(s, ALL))).toEqual(['item:effect:emojis', 'item:background:puntos', 'ach:diasReto:2']);
    expect(accountCelebrations(s, NONE)).toEqual([]);
  });

  it('la primera siembra solo deja fuera los premios por invitar y por el porcentaje (B19)', () => {
    const s = stats({ runs: 90, invitedCount: 1, dailyStreakBest: 7, bestDailyPct: 30 });
    expect([...unseededAccountKeys(s, ALL)].sort()).toEqual(
      ['ach:mejorReto:1', 'ach:mejorReto:2', 'item:background:rayas', 'item:effect:burbujas', 'item:effect:corazones'].sort(),
    );
    expect(unseededAccountKeys(s, NONE).size).toBe(0);
  });
});

describe('textos', () => {
  it('insignia', () => {
    const [first] = afterRun(EMPTY_CATALOG_STATS, stats({ runs: 1, bestTicks: secs(25) }));
    expect(celebrationTexts(first)).toMatchObject({ kicker: 'Insignia nueva', title: '¡Tu primera insignia!', name: 'Papel', sub: 'Llegaste al 4.' });
    const [bronce] = afterRun(stats({ runs: 3, bestTicks: secs(25) }), stats({ runs: 4, bestTicks: secs(ADD_START) }));
    expect(celebrationTexts(bronce)).toMatchObject({ title: '¡Subiste de insignia!', name: 'Bronce', sub: 'Llegaste a las sumas y restas.' });
  });

  it('premio: tipo, nombre y por qué', () => {
    const l = afterRun(stats({ runs: 3, bestTicks: secs(ADD_START - 1) }), stats({ runs: 4, bestTicks: secs(ADD_START) }));
    expect(celebrationTexts(l[1])).toMatchObject({ kicker: 'Sonido nuevo', title: '¡Desbloqueaste!', name: 'Viento', sub: 'Por subir a Bronce' });
  });

  it('premio de un logro: dice cuál', () => {
    const l = afterRun(stats({ runs: 9 }), stats({ runs: 10 }));
    expect(celebrationTexts(l[0])).toMatchObject({ name: 'Chispas', sub: 'Por el logro Partidas jugadas · Papel' });
  });

  it('reto del día', () => {
    expect(celebrationTexts({ kind: 'feature', key: FEATURE_DAILY_KEY, feature: 'daily' }).name).toBe('Reto del día y misiones');
  });

  it('"1 de 3" solo si hay varias', () => {
    expect(stepText(0, 1)).toBe('');
    expect(stepText(1, 3)).toBe('2 de 3');
  });
});
