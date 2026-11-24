// No es una prueba del juego: vuelca a medidas-<variante>.json los valores y márgenes de cada regla
// (reglas.ts, con las funciones reales del juego) y, informativo, la distancia ΔE (CIELAB) mínima.
// Se ejecuta con vitest (necesita los alias del juego): ver RESULTADOS.md.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { PALETTES, PALETTE_IDS, VARIANTE, IDS_NUEVAS } from './candidatas';
import { evaluar } from './reglas';

const lab = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a: string, b: string) => {
  const x = lab(a), y = lab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

it(`volcar medidas (${VARIANTE})`, () => {
  const out: Record<string, unknown> = {};
  for (const id of PALETTE_IDS) {
    const cols = PALETTES[id].colors;
    let mn = Infinity, par = '';
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) {
      const d = dE(cols[i], cols[j]);
      if (d < mn) { mn = d; par = `${i}-${j}`; }
    }
    out[id] = { nueva: IDS_NUEVAS.includes(id), colores: cols, reglas: evaluar(cols), deltaEMin: mn, deltaEPar: par };
  }
  fs.writeFileSync(fileURLToPath(new URL(`./medidas-${VARIANTE}.json`, import.meta.url)), JSON.stringify(out, null, 2));
});
