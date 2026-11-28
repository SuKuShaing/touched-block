import { describe, expect, it } from 'vitest';
import { COLORS, SAFE } from '@tb/engine';
import { C } from '@/theme';
import {
  PALETTE_IDS,
  PALETTES,
  blockPaint,
  contrastRatio,
  effectiveFills,
  getPalette,
  hue,
  hueDistance,
  luminance,
  paletteColor,
  swatchPaint,
} from './palettes';

const TRAP_RED = C.trapNumber; // '#ff2a2a', el texto de la trampa roja
const WHITE = C.text;
/** Posiciones de COLORS donde el motor puede poner una trampa roja. */
const SAFE_POS = SAFE.map((c) => COLORS.indexOf(c));

const min = (xs: number[]) => Math.min(...xs);
const max = (xs: number[]) => Math.max(...xs);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const classic = PALETTES.clasica.colors;

/** Colores bajo el número de una paleta: la tanda `k` de `effectiveFills` en las 9 posiciones. */
const fills = (id: (typeof PALETTE_IDS)[number], k = 0) => COLORS.map((_, i) => effectiveFills(PALETTES[id], i)[k]);
/** Un caso por paleta y por color bajo el número (el degradé tiene dos: arriba y abajo). */
const CASES = PALETTE_IDS.flatMap((id) => {
  const n = effectiveFills(PALETTES[id], 0).length;
  return Array.from({ length: n }, (_, k) => [n === 1 ? id : `${id} (extremo ${k + 1})`, fills(id, k)] as const);
});
/** Contraste WCAG entre el rojo de la trampa y cada color SAFE. */
const redVsSafe = (colors: readonly string[]) => SAFE_POS.map((i) => contrastRatio(TRAP_RED, colors[i]));
/** Distancia de tono (HSL, grados) entre el rojo de la trampa y cada color SAFE. */
const hueVsSafe = (colors: readonly string[]) => SAFE_POS.map((i) => hueDistance(TRAP_RED, colors[i]));

const CLASSIC_RED = redVsSafe(classic);
const CLASSIC_HUE = hueVsSafe(classic);
const CLASSIC_WHITE_MIN = min(classic.map((c) => contrastRatio(WHITE, c)));

/** Holgura del rango de tonos de la Clásica, en grados. */
const HUE_RANGE_TOL = 5;
/** Cuánto más fácil (en grados) puede ser el caso más difícil de tono que el de la Clásica. */
const HARDEST_HUE_TOL = 8;
/** Holgura de la distancia de tono media respecto de la Clásica, en grados. */
const HUE_MEAN_TOL = 20;
/** Cuánto más contraste puede tener el caso más difícil que el de la Clásica. */
const HARDEST_RED_TOL = 0.1;

describe('contraste WCAG y tono', () => {
  it('da los valores conocidos', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('#000000')).toBe(0);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(hue('#ff0000')).toBe(0);
    expect(hue('#00ff00')).toBe(120);
    expect(hue('#0000ff')).toBe(240);
    expect(hue('#ff00ff')).toBe(300);
    expect(hue('#777777')).toBe(0);
    expect(hueDistance('#ff0000', '#ff00ff')).toBe(60);
    expect(hueDistance('#00ffff', '#ff0000')).toBe(180);
  });

  it('las posiciones SAFE son 2, 3, 4, 5, 7 y 8', () => {
    expect(SAFE_POS).toEqual([2, 3, 4, 5, 7, 8]);
    expect(TRAP_RED).toBe('#ff2a2a');
  });

  it('la Clásica tiene las distancias de tono conocidas (el amarillo es el caso difícil)', () => {
    expect(CLASSIC_HUE.map(Math.round)).toEqual([42, 151, 154, 108, 173, 88]);
  });
});

describe('paletas', () => {
  it('la Clásica es la del motor', () => {
    expect(classic).toEqual(COLORS);
  });

  it.each(PALETTE_IDS)('%s tiene 9 colores #rrggbb distintos', (id) => {
    const cols = PALETTES[id].colors;
    expect(cols).toHaveLength(9);
    for (const c of cols) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(cols).size).toBe(9);
  });

  it.each(CASES)('%s: los 9 colores bajo el número son #rrggbb distintos', (_, cols) => {
    for (const c of cols) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(cols).size).toBe(9);
  });

  it('cada paleta se ve distinta de las demás', () => {
    const keys = PALETTE_IDS.map((id) => PALETTES[id].colors.join());
    expect(new Set(keys).size).toBe(PALETTE_IDS.length);
  });

  it('son 14, en el orden de la Colección y con su estilo', () => {
    expect(PALETTE_IDS.map((id) => `${id}:${PALETTES[id].style}`)).toEqual([
      'clasica:solid',
      'contraste:solid',
      'pastel:solid',
      'neon:solid',
      'tenue:soft',
      'cristal:glass',
      'retro:solid',
      'boton:inset',
      'contorno:outline',
      'degrade:gradient',
      'dorado:solid',
      'esmerilado:frosted',
      'diamante:solid',
      'constancia:solid',
    ]);
    for (const id of PALETTE_IDS) expect(PALETTES[id].id).toBe(id);
  });
});

describe('color bajo el número', () => {
  const hex = (s: string) => s.split(' ');

  it.each([
    ['cristal', '#895968 #896552 #897440 #53816e #4c6f8d #5d5d8d #89577d #417b75 #6d578d'],
    ['contorno', '#943248 #94541d #94740c #168759 #286998 #655d98 #942b6f #088379 #7d5198'],
    ['esmerilado', '#b08995 #a7908e #a9a18d #85a9a3 #8ba0c0 #9796ba #b183ab #81aab4 #988bba'],
  ] as const)('%s: los colores mezclados son los medidos', (id, expected) => {
    expect(fills(id)).toEqual(hex(expected));
  });

  it('degradé: los dos extremos, 3,5 % hacia blanco y hacia negro', () => {
    expect(fills('degrade', 0)).toEqual(hex('#d54c6b #ef8317 #d0a31f #40ad67 #2b78db #865fcc #cd69c7 #35ba9f #9f45bb'));
    expect(fills('degrade', 1)).toEqual(hex('#cc4362 #e67a0e #c79a16 #37a45f #226fd2 #7d56c3 #c461be #2cb197 #973cb3'));
  });

  it('en los estilos sin mezcla es el color de la paleta', () => {
    for (const id of PALETTE_IDS) {
      if (['solid', 'soft', 'inset'].includes(PALETTES[id].style)) expect(fills(id)).toEqual(PALETTES[id].colors);
    }
  });
});

/*
 * Regla de no ventaja: ninguna paleta puede hacer más visibles las trampas rojas (ni, siendo un
 * premio, menos visibles). Solo cuentan los seis colores SAFE, los únicos que llevan trampa roja, y
 * se miden tal como quedan bajo el número (`effectiveFills`).
 * El texto rojo se distingue sobre todo por el TONO y después por la luminancia, así que se
 * comparan los dos con la Clásica:
 * - Tono (distancia circular HSL al rojo `#ff2a2a`; Clásica: 42, 151, 154, 108, 173 y 88):
 *   1. cada color SAFE dentro del rango de la Clásica ±5°;
 *   2. el caso más difícil (la menor distancia) a lo más 8° sobre el de la Clásica (42,5°): una
 *      paleta sin un color tan cercano al rojo como el amarillo de la Clásica da ventaja;
 *   3. la media dentro de la de la Clásica ±20°: ni casi todas fáciles ni todas difíciles (una
 *      paleta toda dorada haría difícil cada trampa, y un premio no puede ser una desventaja).
 * - Contraste WCAG con el rojo:
 *   4. cada color SAFE dentro del rango de la Clásica;
 *   5. el mínimo (el caso más difícil) a lo más 0,1 sobre el de la Clásica.
 * - 6. El texto blanco se lee igual o mejor que en la Clásica, en los nueve colores.
 */
describe('no ventaja', () => {
  it.each(CASES)('%s: el tono de cada color SAFE está en el rango de la Clásica', (_, cols) => {
    for (const h of hueVsSafe(cols)) {
      expect(h).toBeGreaterThanOrEqual(min(CLASSIC_HUE) - HUE_RANGE_TOL);
      expect(h).toBeLessThanOrEqual(max(CLASSIC_HUE) + HUE_RANGE_TOL);
    }
  });

  it.each(CASES)('%s: el caso más difícil de tono es tan difícil como en la Clásica', (_, cols) => {
    expect(min(hueVsSafe(cols))).toBeLessThanOrEqual(min(CLASSIC_HUE) + HARDEST_HUE_TOL);
  });

  it.each(CASES)('%s: en promedio, el tono no es más fácil ni más difícil que en la Clásica', (_, cols) => {
    expect(Math.abs(mean(hueVsSafe(cols)) - mean(CLASSIC_HUE))).toBeLessThanOrEqual(HUE_MEAN_TOL);
  });

  it.each(CASES)('%s: el rojo de la trampa contrasta como en la Clásica', (_, cols) => {
    for (const r of redVsSafe(cols)) {
      expect(r).toBeGreaterThanOrEqual(min(CLASSIC_RED));
      expect(r).toBeLessThanOrEqual(max(CLASSIC_RED));
    }
  });

  it.each(CASES)('%s: el caso más difícil de contraste es tan difícil como en la Clásica', (_, cols) => {
    expect(min(redVsSafe(cols))).toBeLessThanOrEqual(min(CLASSIC_RED) + HARDEST_RED_TOL);
  });

  it.each(CASES)('%s: el texto blanco se lee igual o mejor', (_, cols) => {
    for (const c of cols) expect(contrastRatio(WHITE, c)).toBeGreaterThanOrEqual(CLASSIC_WHITE_MIN);
  });
});

describe('paletteColor', () => {
  it('traduce por posición en COLORS', () => {
    COLORS.forEach((c, i) => {
      expect(paletteColor(c, 'neon')).toBe(PALETTES.neon.colors[i]);
      expect(paletteColor(c, 'clasica')).toBe(c);
    });
    expect(paletteColor(COLORS[4].toUpperCase(), 'retro')).toBe(PALETTES.retro.colors[4]);
  });

  it('no cambia el corazón ni colores desconocidos', () => {
    expect(paletteColor('#ff4d8d', 'dorado')).toBe('#ff4d8d');
    expect(paletteColor('#ff6369', 'pastel')).toBe('#ff6369');
  });

  it('una paleta desconocida es la Clásica', () => {
    expect(paletteColor(COLORS[0], 'no-existe')).toBe(COLORS[0]);
    expect(paletteColor(COLORS[0], undefined)).toBe(COLORS[0]);
    expect(getPalette('no-existe').id).toBe('clasica');
    expect(getPalette('diamante').shine).toBe(true);
  });
});

describe('blockPaint', () => {
  const SHADOW = '0 5px 0 rgba(0,0,0,0.35)';

  it('la Clásica no cambia', () => {
    for (const c of COLORS) {
      expect(blockPaint('clasica', c)).toStrictEqual({ backgroundColor: c, boxShadow: SHADOW });
      expect(blockPaint(undefined, c)).toStrictEqual({ backgroundColor: c, boxShadow: SHADOW });
    }
  });

  it.each(PALETTE_IDS)('%s: fondo opaco', (id) => {
    for (const c of COLORS) expect(blockPaint(id, c).backgroundColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it.each(PALETTE_IDS)('%s: el corazón y el bloque que se apaga salen lisos', (id) => {
    for (const c of ['#ff4d8d', C.gone]) {
      expect(blockPaint(id, c)).toStrictEqual({ backgroundColor: c, boxShadow: SHADOW });
      expect(blockPaint(id, c, false)).toStrictEqual({ backgroundColor: c, boxShadow: SHADOW });
    }
  });

  it('pinta bajo el número el color que se mide', () => {
    for (const id of PALETTE_IDS) {
      const { style } = PALETTES[id];
      // en el degradé y el esmerilado el color final lo completa el degradado
      if (style === 'gradient' || style === 'frosted') continue;
      expect(COLORS.map((c) => blockPaint(id, c).backgroundColor)).toEqual(fills(id));
    }
    COLORS.forEach((c, i) => {
      const [top, bottom] = effectiveFills(PALETTES.degrade, i);
      expect(blockPaint('degrade', c).backgroundImage).toBe(`linear-gradient(180deg, ${top}, ${bottom})`);
    });
  });

  it('Tenue lleva el borde del color del motor', () => {
    expect(blockPaint('tenue', COLORS[3])).toMatchObject({
      backgroundColor: PALETTES.tenue.colors[3],
      borderWidth: 5,
      borderColor: COLORS[3],
    });
  });

  it('Contorno lleva el borde del color pleno de la paleta', () => {
    expect(blockPaint('contorno', COLORS[3])).toMatchObject({ borderWidth: 3, borderColor: PALETTES.contorno.colors[3] });
  });

  it('Botón cambia las sombras interiores por un degradado si no se pueden dibujar', () => {
    expect(blockPaint('boton', COLORS[0]).boxShadow).toContain('inset');
    expect(blockPaint('boton', COLORS[0]).backgroundImage).toBeUndefined();
    expect(blockPaint('boton', COLORS[0], false).boxShadow).toBe(SHADOW);
    expect(blockPaint('boton', COLORS[0], false).backgroundImage).toContain('linear-gradient');
  });
});

describe('swatchPaint', () => {
  it('no lleva sombra exterior', () => {
    for (const id of PALETTE_IDS) {
      for (const size of [12, 60]) {
        const shadow = swatchPaint(id, COLORS[0], size).boxShadow;
        if (shadow !== undefined) expect(shadow.startsWith('inset')).toBe(true);
      }
    }
    expect(swatchPaint('clasica', COLORS[0], 12)).toStrictEqual({ backgroundColor: COLORS[0] });
  });

  it('achica los bordes en las muestras chicas', () => {
    expect(swatchPaint('tenue', COLORS[0], 10).borderWidth).toBeCloseTo(3.1);
    expect(swatchPaint('tenue', COLORS[0], 60).borderWidth).toBe(5);
    expect(swatchPaint('contorno', COLORS[0], 12).borderWidth).toBe(3);
    expect(swatchPaint('esmerilado', COLORS[0], 12).borderWidth).toBe(1);
  });

  it('dibuja el brillo de Diamante', () => {
    expect(swatchPaint('diamante', COLORS[0], 12).backgroundImage).toContain('linear-gradient');
    expect(swatchPaint('neon', COLORS[0], 12).backgroundImage).toBeUndefined();
  });
});
