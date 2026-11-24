// Mide, para un juego de 9 colores, cada regla de palettes.test.ts con su valor, umbral y margen.
// Usa las funciones REALES del juego (palettes.ts, motor, theme). Solo duplica los 4 umbrales de tolerancia
// (HUE_RANGE_TOL etc., que en palettes.test.ts son constantes locales no exportadas); RESULTADOS.md lo menciona.
// La coherencia con las aserciones oficiales se comprueba en medir.spec.ts (compara con el reporte JSON de vitest).
import { COLORS, SAFE } from '@tb/engine';
import { C } from '@/theme';
import { PALETTES, contrastRatio, hue, hueDistance, luminance } from '@/cosmetics/palettes';

export const TRAP_RED = C.trapNumber;
export const WHITE = C.text;
export const SAFE_POS = SAFE.map((c) => COLORS.indexOf(c));
export const HUE_RANGE_TOL = 5;
export const HARDEST_HUE_TOL = 8;
export const HUE_MEAN_TOL = 20;
export const HARDEST_RED_TOL = 0.1;

const min = (xs: number[]) => Math.min(...xs);
const max = (xs: number[]) => Math.max(...xs);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export const redVsSafe = (cols: readonly string[], red: string = TRAP_RED) => SAFE_POS.map((i) => contrastRatio(red, cols[i]));
export const hueVsSafe = (cols: readonly string[], red: string = TRAP_RED) => SAFE_POS.map((i) => hueDistance(red, cols[i]));

const classic = PALETTES.clasica.colors;
export const REF = {
  hue: hueVsSafe(classic),
  red: redVsSafe(classic),
  whiteMin: min(classic.map((c) => contrastRatio(WHITE, c))),
};

export interface Medida {
  regla: string;
  ok: boolean;
  /** valor medido (el peor caso respecto del umbral) */
  valor: number;
  /** umbral que se compara */
  umbral: string;
  /** margen: positivo = sobra, negativo = falta (en las unidades de la regla) */
  margen: number;
  /** dónde ocurre el peor caso */
  donde: string;
}

const pos = (k: number) => `pos ${SAFE_POS[k]}`;

export function evaluar(cols: readonly string[], red: string = TRAP_RED, num: string = WHITE): Medida[] {
  const out: Medida[] = [];
  const hs = hueVsSafe(cols, red);
  const rs = redVsSafe(cols, red);
  const hLo = min(REF.hue) - HUE_RANGE_TOL;
  const hHi = max(REF.hue) + HUE_RANGE_TOL;
  // 1. tono dentro de rango: peor = el que más se acerca/pasa de un borde
  {
    const m = hs.map((h) => Math.min(h - hLo, hHi - h));
    const k = m.indexOf(min(m));
    out.push({ regla: 'tono SAFE en rango Clásica ±5°', ok: min(m) >= 0, valor: hs[k], umbral: `[${hLo.toFixed(2)}, ${hHi.toFixed(2)}]°`, margen: min(m), donde: `${pos(k)} ${cols[SAFE_POS[k]]}` });
  }
  // 2. caso más difícil de tono
  {
    const lim = min(REF.hue) + HARDEST_HUE_TOL;
    const v = min(hs);
    const k = hs.indexOf(v);
    out.push({ regla: 'caso más difícil de tono', ok: v <= lim, valor: v, umbral: `mínimo ≤ ${lim.toFixed(2)}°`, margen: lim - v, donde: `${pos(k)} ${cols[SAFE_POS[k]]}` });
  }
  // 3. media de tono
  {
    const d = Math.abs(mean(hs) - mean(REF.hue));
    out.push({ regla: 'media de tono', ok: d <= HUE_MEAN_TOL, valor: mean(hs), umbral: `${mean(REF.hue).toFixed(2)} ± ${HUE_MEAN_TOL}°`, margen: HUE_MEAN_TOL - d, donde: 'promedio de las 6 SAFE' });
  }
  // 4. contraste del rojo dentro del rango
  {
    const rLo = min(REF.red);
    const rHi = max(REF.red);
    const m = rs.map((r) => Math.min(r - rLo, rHi - r));
    const k = m.indexOf(min(m));
    out.push({ regla: 'contraste rojo en rango Clásica', ok: min(m) >= 0, valor: rs[k], umbral: `[${rLo.toFixed(3)}, ${rHi.toFixed(3)}]`, margen: min(m), donde: `${pos(k)} ${cols[SAFE_POS[k]]}` });
  }
  // 5. caso más difícil de contraste
  {
    const lim = min(REF.red) + HARDEST_RED_TOL;
    const v = min(rs);
    const k = rs.indexOf(v);
    out.push({ regla: 'caso más difícil de contraste', ok: v <= lim, valor: v, umbral: `mínimo ≤ ${lim.toFixed(3)}`, margen: lim - v, donde: `${pos(k)} ${cols[SAFE_POS[k]]}` });
  }
  // 6. texto blanco
  {
    const ws = cols.map((c) => contrastRatio(num, c));
    const v = min(ws);
    const k = ws.indexOf(v);
    out.push({ regla: 'texto blanco ≥ Clásica', ok: v >= REF.whiteMin, valor: v, umbral: `≥ ${REF.whiteMin.toFixed(3)}`, margen: v - REF.whiteMin, donde: `pos ${k} ${cols[k]}` });
  }
  // estructurales
  out.push({ regla: '9 colores #rrggbb distintos', ok: cols.length === 9 && cols.every((c) => /^#[0-9a-f]{6}$/.test(c)) && new Set(cols).size === 9, valor: new Set(cols).size, umbral: '9 distintos', margen: new Set(cols).size - 9, donde: '' });
  return out;
}

export { hue, luminance, contrastRatio };
