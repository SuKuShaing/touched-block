// Busca el ajuste mínimo para cada falla, comprobado con las mismas reglas (reglas.ts) y escribe ajustes.json.
// NO modifica coleccion.js ni cambios.md: solo calcula candidatos para que el usuario decida.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { evaluar, SAFE_POS } from './reglas';

const json = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./candidatas.json', import.meta.url)), 'utf8'));
const BG = '#12121a';
const rgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (c: number[]) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mezclar = (a: string, b: number[], t: number) => hex(rgb(a).map((v, i) => v * (1 - t) + b[i] * t));
const sobre = (c: string, a: number) => mezclar(BG, rgb(c), a);
const pasa = (cols: string[]) => evaluar(cols).every((m) => m.ok);
const fallan = (cols: string[]) => evaluar(cols).filter((m) => !m.ok).map((m) => m.regla);

const ESM_BASE = '#dde8ff';
const esmEf = (h: string) => mezclar(mezclar(sobre(mezclar(ESM_BASE, rgb(h), 0.35), 0.7), [255, 255, 255], 0.117), [0, 0, 0], 0);

// --- CIELAB para elegir "el más cercano" ---
const lab = (h: string) => {
  const [R, G, B] = rgb(h);
  const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = lin(R), g = lin(G), b = lin(B);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a: string, b: string) => { const x = lab(a), y = lab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

/** Color más cercano (CIELAB) a `orig` en la posición `p` de `cols` tal que `ok(nuevaLista)`; busca en un cubo RGB de ±r. */
function masCercano(cols: string[], p: number, orig: string, ok: (c: string[]) => boolean, r = 40) {
  const [R, G, B] = rgb(orig);
  let mejor: { hex: string; d: number } | null = null;
  for (let dr = -r; dr <= r; dr++) for (let dg = -r; dg <= r; dg++) for (let db = -r; db <= r; db++) {
    const c = [R + dr, G + dg, B + db];
    if (c.some((v) => v < 0 || v > 255)) continue;
    const h = hex(c);
    const d = dE(orig, h);
    if (mejor && d >= mejor.d) continue;
    const t = cols.slice(); t[p] = h;
    if (ok(t)) mejor = { hex: h, d };
  }
  return mejor;
}

it('ajustes', () => {
  const out: Record<string, unknown> = {};

  // 1. Contorno (corrida b): rango de opacidad del relleno con la que cumple las 6 reglas (con los 9 hex tal cual).
  {
    const filas: { a: number; ok: boolean; fallan: string[] }[] = [];
    for (let a = 0; a <= 100; a++) {
      const cols = json.base.contorno.map((c: string) => sobre(c, a / 100));
      filas.push({ a: a / 100, ok: pasa(cols), fallan: fallan(cols) });
    }
    const okAs = filas.filter((f) => f.ok).map((f) => f.a);
    // tramos continuos
    const tramos: [number, number][] = [];
    for (const a of okAs) {
      const t = tramos[tramos.length - 1];
      if (t && Math.abs(a - t[1] - 0.01) < 1e-9) t[1] = a; else tramos.push([a, a]);
    }
    out.contornoRelleno = { tramosQueCumplen: tramos, en0: filas[0], en55: filas[55], en50: filas[50], en60: filas[60], en52: filas[52], en56: filas[56], en85: filas[85] };
  }

  // 2. Esmerilado (corrida a, hex crudos): único color que rompe es pos 7; color más cercano que cumple con los hex crudos.
  {
    const base: string[] = json.base.esmerilado;
    const ya = fallan(base);
    const cand = masCercano(base, 7, base[7], (c) => pasa(c));
    const nuevo = base.slice();
    if (cand) nuevo[7] = cand.hex;
    const ef = nuevo.map(esmEf);
    out.esmeriladoCrudo = {
      fallanHoy: ya,
      pos7Original: base[7],
      candidato: cand,
      pasaCrudoConCandidato: cand ? pasa(nuevo) : null,
      efectivoConCandidato: ef,
      pasaEfectivoConCandidato: pasa(ef),
      fallanEfectivoConCandidato: fallan(ef),
    };
  }

  // 3. Cristal y Contorno (corrida a): cuántos colores violan cada regla con el hex crudo (es sistémico).
  for (const id of ['cristal', 'contorno']) {
    const cols: string[] = json.base[id];
    out[id + 'Crudo'] = evaluar(cols).filter((m) => !m.ok).map((m) => ({ regla: m.regla, valor: m.valor, umbral: m.umbral, margen: m.margen, donde: m.donde }));
  }
  out.SAFE_POS = SAFE_POS;
  fs.writeFileSync(fileURLToPath(new URL('./ajustes.json', import.meta.url)), JSON.stringify(out, null, 2));
});
