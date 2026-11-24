// Mide las reglas de palettes.test.ts con los colores MUESTREADOS de cada fondo (muestras.json, de muestrear.mjs): Cristal, Contorno y
// Esmerilado calculados sobre cada muestra. Escribe medidas-muestras.json con, por fondo y paleta, el peor margen de cada regla y
// cuántas muestras no pasan.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { evaluar } from '../prueba-paletas/reglas';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(aqui, '..', '..', 'coleccion.js'), 'utf8');
const ctx: Record<string, unknown> = {};
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('const CLASICA'), src.indexOf('// Valores por defecto')) + '\nthis.P = PALETAS;', ctx);
const P = ctx.P as { id: string; colores: string[] }[];
const por = (id: string) => P.find((p) => p.id === id)!;
const aRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const aHex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mezclar = (hex: string, d: number[], t: number) => aHex(aRgb(hex).map((v, i) => v * (1 - t) + d[i] * t));
const sobre = (hex: string, a: number, fondo: string) => mezclar(fondo, aRgb(hex), a);
const esm = (hex: string, fondo: string) => mezclar(sobre(mezclar('#dde8ff', aRgb(hex), 0.35), 0.7, fondo), [255, 255, 255], 0.117);
const efectivas: Record<string, (bg: string) => string[]> = {
  cristal: (bg) => por('cristal').colores.map((c) => sobre(c, 0.5, bg)),
  contorno: (bg) => por('contorno').colores.map((c) => sobre(c, 0.55, bg)),
  esmerilado: (bg) => por('esmerilado').colores.map((c) => esm(c, bg)),
};

it('medir muestras', () => {
  const m = JSON.parse(fs.readFileSync(path.join(aqui, 'muestras.json'), 'utf8')) as Record<string, string[]>;
  const out: Record<string, Record<string, { fallan: number; total: number; peor: Record<string, number>; peorColor: Record<string, string> }>> = {};
  for (const [fondo, lista] of Object.entries(m)) {
    out[fondo] = {};
    for (const [paleta, fn] of Object.entries(efectivas)) {
      const r = { fallan: 0, total: lista.length, peor: {} as Record<string, number>, peorColor: {} as Record<string, string> };
      for (const bg of lista) {
        const ms = evaluar(fn(bg));
        if (ms.some((x) => !x.ok)) r.fallan++;
        for (const x of ms) if (r.peor[x.regla] === undefined || x.margen < r.peor[x.regla]) { r.peor[x.regla] = x.margen; r.peorColor[x.regla] = bg; }
      }
      out[fondo][paleta] = r;
    }
  }
  fs.writeFileSync(path.join(aqui, 'medidas-muestras.json'), JSON.stringify(out, null, 1));
});
