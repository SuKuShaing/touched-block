import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ADD_START, LIFE_STAGE_START, MUL_START, NUM_STEP, TICKS_PER_SECOND, TIERS } from '@tb/engine';
import { CATALOG, EMPTY_CATALOG_STATS } from '@/cosmetics/catalog';
import { celebrationFromKey } from '@/game/celebrations';
import { PRIZE_CARD, isPrizeCard } from './shareCardStore';
import { prizeCardTexts, prizeDetail, prizeShareText, resultText, shareItemOf, stageReached, stageText } from './shareText';

const secs = (s: number) => s * TICKS_PER_SECOND;

describe('stageText', () => {
  it('sin hitos no dice nada', () => {
    expect(stageText(0)).toBeNull();
    expect(stageText(undefined)).toBeNull();
    expect(stageText(secs(NUM_STEP) - 1)).toBeNull();
  });

  it('usa "al" con los números', () => {
    expect(stageText(secs(NUM_STEP))).toBe('Llegué al 4');
    expect(stageText(secs(4 * NUM_STEP) + 30)).toBe('Llegué al 7');
  });

  it('nombra cada etapa', () => {
    expect(stageText(secs(ADD_START))).toBe('Llegué a las sumas y restas');
    expect(stageText(secs(MUL_START + 10))).toBe('Llegué a las multiplicaciones y divisiones');
    expect(stageText(secs(LIFE_STAGE_START))).toBe('Llegué a los bloques de 4 s');
    expect(stageText(secs(10_000))).toBe('Llegué a los bloques de 1 s');
  });

  it('stageReached devuelve el hito', () => {
    expect(stageReached(secs(ADD_START + 5))?.kind).toBe('add');
  });
});

describe('compartir premios', () => {
  it('insignia', () => {
    const plata = { kind: 'tier', index: 4 } as const;
    expect(prizeShareText(plata)).toBe('¡Conseguí la insignia Plata en Touched Block! ¿Me superas?');
    expect(prizeCardTexts(plata)).toMatchObject({ kicker: 'Insignia', title: 'Plata', sub: 'Llegué a las multiplicaciones y divisiones' });
    expect(prizeCardTexts({ kind: 'tier', index: 0 })?.sub).toBe('Llegué al 4');
  });

  it('logro', () => {
    const oro = { kind: 'achievement', id: 'racha', level: 6 } as const;
    expect(prizeShareText(oro)).toBe('¡Logro Máximo combo · Oro en Touched Block!');
    expect(prizeCardTexts(oro)).toMatchObject({ kicker: 'Logro', title: 'Máximo combo · Oro', sub: 'Racha de 300' });
  });

  it('premios del catálogo, con su artículo', () => {
    expect(prizeShareText({ kind: 'item', type: 'palette', id: 'neon' })).toBe('¡Desbloqueé la paleta Neón en Touched Block! ¿Me superas?');
    expect(prizeShareText({ kind: 'item', type: 'sound', id: 'piano' })).toBe('¡Desbloqueé el sonido Piano en Touched Block! ¿Me superas?');
    expect(prizeShareText({ kind: 'item', type: 'effect', id: 'rayos' })).toBe('¡Desbloqueé el efecto Rayos en Touched Block! ¿Me superas?');
    expect(prizeCardTexts({ kind: 'item', type: 'background', id: 'bosque' })).toMatchObject({ kicker: 'Fondo', title: 'Bosque nocturno' });
  });

  it('todo lo que se puede ganar tiene tarjeta', () => {
    for (const t of TIERS) expect(prizeCardTexts({ kind: 'tier', index: t.index })).not.toBeNull();
    for (const a of ACHIEVEMENTS) {
      for (let level = 1; level <= 7; level++) expect(prizeCardTexts({ kind: 'achievement', id: a.id, level })).not.toBeNull();
    }
    for (const i of CATALOG) expect(prizeCardTexts({ kind: 'item', type: i.type, id: i.id })).not.toBeNull();
  });

  it('una referencia que no existe no tiene tarjeta', () => {
    expect(prizeCardTexts({ kind: 'tier', index: -1 })).toBeNull();
    expect(prizeCardTexts({ kind: 'achievement', id: 'racha', level: 0 })).toBeNull();
    expect(prizeCardTexts({ kind: 'item', type: 'palette', id: 'no-existe' })).toBeNull();
  });

  it('de cada celebración, lo que se comparte (el reto del día no)', () => {
    const of = (key: string) => shareItemOf(celebrationFromKey(key)!);
    expect(of('tier:3')).toEqual({ kind: 'tier', index: 3 });
    expect(of('ach:partidas:2')).toEqual({ kind: 'achievement', id: 'partidas', level: 2 });
    expect(of('item:palette:neon')).toEqual({ kind: 'item', type: 'palette', id: 'neon' });
    expect(of('feature:daily')).toBeNull();
  });

  it('la tarjeta de un premio se distingue de la del resultado', () => {
    expect(isPrizeCard({ username: null, kind: 'tier', index: 0 })).toBe(true);
    expect(isPrizeCard({ username: null, killed: 3 })).toBe(false);
    // la imagen cabe entre el rótulo y el nombre
    const { art, withArt } = PRIZE_CARD;
    expect(art.cy - art.box / 2).toBeGreaterThan(withArt.kicker.y);
    expect(art.cy + art.box / 2).toBeLessThan(withArt.title.y - withArt.title.size / 2);
  });
});

describe('prizeDetail (ventana en grande)', () => {
  const stats = { ...EMPTY_CATALOG_STATS, runs: 20, bestTicks: secs(ADD_START + 5), bestStreak: 40 };

  it('insignia', () => {
    expect(prizeDetail({ kind: 'tier', index: 3 }, stats)).toMatchObject({
      title: 'Bronce',
      status: null,
      goal: 'Llegaste a las sumas y restas.',
      progress: 'Tu partida más larga: 2 min 25 s',
      share: { kind: 'tier', index: 3 },
    });
  });

  it('sin insignia: no se comparte', () => {
    expect(prizeDetail({ kind: 'tier', index: -1 }, EMPTY_CATALOG_STATS)).toMatchObject({
      title: 'Sin insignia',
      status: 'Todavía no lo tienes',
      goal: 'Llega al 4 para ganar Papel.',
      progress: null,
      share: null,
    });
  });

  it('logro con material: meta, avance y siguiente', () => {
    const d = prizeDetail({ kind: 'achievement', id: 'racha', level: 2 }, stats);
    expect(d).toMatchObject({
      title: 'Máximo combo',
      material: 'Cartón',
      goal: 'Racha de 25.',
      progress: 'Tu máximo combo: 40',
      next: 'Siguiente: Madera · Racha de 50',
      share: { kind: 'achievement', id: 'racha', level: 2 },
    });
    expect(d.ratio).toBeCloseTo((40 - 25) / (50 - 25));
  });

  it('logro en el material más alto', () => {
    const d = prizeDetail({ kind: 'achievement', id: 'racha', level: 7 }, { ...stats, bestStreak: 900 });
    expect(d).toMatchObject({ material: 'Diamante', next: '¡Tienes el material más alto!', ratio: 1 });
  });

  it('logro vacío: su primera meta, sin compartir', () => {
    expect(prizeDetail({ kind: 'achievement', id: 'mejorReto', level: 0 }, EMPTY_CATALOG_STATS)).toMatchObject({
      material: null,
      status: 'Todavía no lo tienes',
      goal: 'Participa en un reto diario.',
      progress: 'Aún no participas en un reto diario',
      next: null,
      share: null,
    });
  });
});

describe('resultText', () => {
  it('no cambió', () => {
    expect(resultText(1)).toBe('¡Destruí 1 bloque en Touched Block! ¿Me superas?');
    expect(resultText(47, 3)).toBe('¡Destruí 47 bloques en Touched Block y voy #3 en el mundo! ¿Me superas?');
  });
});
