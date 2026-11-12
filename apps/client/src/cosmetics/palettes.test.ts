import { describe, expect, it } from 'vitest';
import { COLORS, SAFE } from '@tb/engine';
import { C } from '@/theme';
import {
  PALETTE_IDS,
  PALETTES,
  contrastRatio,
  getPalette,
  hue,
  hueDistance,
  luminance,
  paletteColor,
} from './palettes';

const TRAP_RED = C.trapNumber; // '#ff2a2a', el texto de la trampa roja
const WHITE = C.text;
/** Posiciones de COLORS donde el motor puede poner una trampa roja. */
const SAFE_POS = SAFE.map((c) => COLORS.indexOf(c));

const min = (xs: number[]) => Math.min(...xs);
const max = (xs: number[]) => Math.max(...xs);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const classic = PALETTES.clasica.colors;
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

  it('cada paleta se ve distinta de las demás', () => {
    const keys = PALETTE_IDS.map((id) => PALETTES[id].colors.join());
    expect(new Set(keys).size).toBe(PALETTE_IDS.length);
  });
});

/*
 * Regla de no ventaja: ninguna paleta puede hacer más visibles las trampas rojas (ni, siendo un
 * premio, menos visibles). Solo cuentan los seis colores SAFE, los únicos que llevan trampa roja.
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
  it.each(PALETTE_IDS)('%s: el tono de cada color SAFE está en el rango de la Clásica', (id) => {
    for (const h of hueVsSafe(PALETTES[id].colors)) {
      expect(h).toBeGreaterThanOrEqual(min(CLASSIC_HUE) - HUE_RANGE_TOL);
      expect(h).toBeLessThanOrEqual(max(CLASSIC_HUE) + HUE_RANGE_TOL);
    }
  });

  it.each(PALETTE_IDS)('%s: el caso más difícil de tono es tan difícil como en la Clásica', (id) => {
    expect(min(hueVsSafe(PALETTES[id].colors))).toBeLessThanOrEqual(min(CLASSIC_HUE) + HARDEST_HUE_TOL);
  });

  it.each(PALETTE_IDS)('%s: en promedio, el tono no es más fácil ni más difícil que en la Clásica', (id) => {
    expect(Math.abs(mean(hueVsSafe(PALETTES[id].colors)) - mean(CLASSIC_HUE))).toBeLessThanOrEqual(HUE_MEAN_TOL);
  });

  it.each(PALETTE_IDS)('%s: el rojo de la trampa contrasta como en la Clásica', (id) => {
    for (const r of redVsSafe(PALETTES[id].colors)) {
      expect(r).toBeGreaterThanOrEqual(min(CLASSIC_RED));
      expect(r).toBeLessThanOrEqual(max(CLASSIC_RED));
    }
  });

  it.each(PALETTE_IDS)('%s: el caso más difícil de contraste es tan difícil como en la Clásica', (id) => {
    expect(min(redVsSafe(PALETTES[id].colors))).toBeLessThanOrEqual(min(CLASSIC_RED) + HARDEST_RED_TOL);
  });

  it.each(PALETTE_IDS)('%s: el texto blanco se lee igual o mejor', (id) => {
    for (const c of PALETTES[id].colors) expect(contrastRatio(WHITE, c)).toBeGreaterThanOrEqual(CLASSIC_WHITE_MIN);
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
