// Barrido: ¿qué colores de fondo dejan pasar a las tres paletas translúcidas (Cristal, Contorno, Esmerilado)?
// Recorre una rejilla de fondos alrededor de #12121a y escribe barrido.json con los que pasan las tres a la vez (y por paleta).
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
const P = ctx.P as { id: string; colores: string[]; relleno?: number }[];
const por = (id: string) => P.find((p) => p.id === id)!;

const aRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const aHex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mezclar = (hex: string, d: number[], t: number) => aHex(aRgb(hex).map((v, i) => v * (1 - t) + d[i] * t));
const sobre = (hex: string, a: number, fondo: string) => mezclar(fondo, aRgb(hex), a);
const esm = (hex: string, fondo: string) => mezclar(sobre(mezclar('#dde8ff', aRgb(hex), 0.35), 0.7, fondo), [255, 255, 255], 0.117);
const efectivas = (fondo: string) => ({
  cristal: por('cristal').colores.map((c) => sobre(c, 0.5, fondo)),
  contorno: por('contorno').colores.map((c) => sobre(c, 0.55, fondo)),
  esmerilado: por('esmerilado').colores.map((c) => esm(c, fondo)),
});

it('barrido de fondos', () => {
  const base = [0x12, 0x12, 0x1a];
  const res: { bg: string; cristal: boolean; contorno: boolean; esmerilado: boolean }[] = [];
  for (let dr = -12; dr <= 16; dr += 2)
    for (let dg = -12; dg <= 16; dg += 2)
      for (let db = -16; db <= 20; db += 2) {
        const bg = aHex([base[0] + dr, base[1] + dg, base[2] + db].map((v) => Math.max(0, Math.min(255, v))));
        const e = efectivas(bg);
        const ok = (cols: string[]) => evaluar(cols).every((m) => m.ok);
        res.push({ bg, cristal: ok(e.cristal), contorno: ok(e.contorno), esmerilado: ok(e.esmerilado) });
      }
  fs.writeFileSync(path.join(aqui, 'barrido.json'), JSON.stringify(res));
});
