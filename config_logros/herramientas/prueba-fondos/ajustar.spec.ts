// Ajuste: para cada color deseado de un fondo (deseados.json: { "<nombre>": ["#rrggbb", ...] }) busca cuánto hay que oscurecer o aclarar
// (multiplicando los tres canales por s, el tono se conserva) para que Cristal, Contorno y Esmerilado pasen todas las reglas encima.
// Escribe ajustes.json con, por color, el intervalo de s que pasa y el s del centro (el más holgado).
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
const pasa = (bg: string) =>
  evaluar(por('cristal').colores.map((c) => sobre(c, 0.5, bg))).every((m) => m.ok) &&
  evaluar(por('contorno').colores.map((c) => sobre(c, 0.55, bg))).every((m) => m.ok) &&
  evaluar(por('esmerilado').colores.map((c) => esm(c, bg))).every((m) => m.ok);

it('ajustar', () => {
  const deseados = JSON.parse(fs.readFileSync(path.join(aqui, 'deseados.json'), 'utf8')) as Record<string, string[]>;
  const out: Record<string, unknown> = {};
  for (const [k, lista] of Object.entries(deseados)) {
    out[k] = lista.map((h) => {
      const base = aRgb(h);
      const oks: number[] = [];
      for (let s = 0.3; s <= 3; s += 0.01) if (pasa(aHex(base.map((v) => v * s)))) oks.push(+s.toFixed(2));
      const centro = oks.length ? oks[Math.floor(oks.length / 2)] : null;
      return { deseado: h, pasaTal_cual: pasa(h), s: oks.length ? [oks[0], oks[oks.length - 1]] : null, centro, ajustado: centro ? aHex(base.map((v) => v * centro)) : null };
    });
  }
  fs.writeFileSync(path.join(aqui, 'ajustes.json'), JSON.stringify(out, null, 2));
});
