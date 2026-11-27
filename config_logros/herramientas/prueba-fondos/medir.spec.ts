// No es una prueba del juego. Escribe medidas-fondos.json con:
//  1. las reglas de palettes.test.ts (valores y márgenes) para las 14 paletas con su color efectivo (candidatas-fondos.json), usando
//     evaluar() de ../prueba-paletas/reglas.ts, con las funciones reales del juego;
//  2. cuánto se separa cada bloque del fondo: para cada fondo, contra los colores muestreados de la captura (muestras.json, de
//     muestrear.mjs) y contra sus colores `prueba`: contraste WCAG y diferencia de color CIEDE2000 mínimos entre las 14 × 9 casillas;
//  3. lo mismo para el rojo de las trampas #ff2a2a, y qué parte del fondo es "roja".
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { REDDISH } from '@tb/engine';
import { TRAP_RED, contrastRatio, evaluar, hue } from '../prueba-paletas/reglas';

const ruta = (n: string) => fileURLToPath(new URL(`./${n}`, import.meta.url));

function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
  const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
  const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** Diferencia de color CIEDE2000. */
function deltaE(h1: string, h2: string): number {
  const [L1, a1, b1] = lab(h1);
  const [L2, a2, b2] = lab(h2);
  const rad = Math.PI / 180;
  const c7 = (c: number) => Math.sqrt(c ** 7 / (c ** 7 + 25 ** 7));
  const G = 0.5 * (1 - c7((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2));
  const p1 = (1 + G) * a1;
  const p2 = (1 + G) * a2;
  const C1 = Math.hypot(p1, b1);
  const C2 = Math.hypot(p2, b2);
  const ang = (b: number, a: number) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const H1 = ang(b1, p1);
  const H2 = ang(b2, p2);
  let dh = C1 * C2 === 0 ? 0 : H2 - H1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const dL = L2 - L1;
  const dC = C2 - C1;
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad);
  const L = (L1 + L2) / 2;
  const C = (C1 + C2) / 2;
  let H = H1 + H2;
  if (C1 * C2 !== 0) H = Math.abs(H1 - H2) <= 180 ? (H1 + H2) / 2 : H1 + H2 < 360 ? (H1 + H2 + 360) / 2 : (H1 + H2 - 360) / 2;
  const T = 1 - 0.17 * Math.cos((H - 30) * rad) + 0.24 * Math.cos(2 * H * rad) + 0.32 * Math.cos((3 * H + 6) * rad) - 0.2 * Math.cos((4 * H - 63) * rad);
  const SL = 1 + (0.015 * (L - 50) ** 2) / Math.sqrt(20 + (L - 50) ** 2);
  const SC = 1 + 0.045 * C;
  const SH = 1 + 0.015 * C * T;
  const RT = -2 * c7(C) * Math.sin(60 * Math.exp(-(((H - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

/** "Rojo": tono HSL a no más de 15° del rojo puro, con color de verdad (saturación ≥ 0,35) y no casi negro. */
function esRojo(hex: string): boolean {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(...v);
  const mn = Math.min(...v);
  const l = (mx + mn) / 2;
  const s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  const h = hue(hex);
  return (h <= 15 || h >= 345) && s >= 0.35 && l >= 0.12;
}

it('medir paletas y fondos', () => {
  const j = JSON.parse(fs.readFileSync(ruta('candidatas-fondos.json'), 'utf8')) as {
    fondos: { id: string; n: string; prueba: string[] }[];
    paletas: { id: string; estilo: string; colores: string[] }[];
  };
  const muestras = JSON.parse(fs.readFileSync(ruta('muestras.json'), 'utf8')) as Record<string, string[]>;
  const paletas = j.paletas.map((p) => ({ ...p, reglas: evaluar(p.colores) }));
  const casillas = j.paletas.flatMap((p) => p.colores.map((c, i) => ({ paleta: p.id, estilo: p.estilo, pos: i, color: c })));

  const separar = (fondos: string[]) => {
    let c = { v: Infinity, bloque: '', fondo: '' };
    let d = { v: Infinity, bloque: '', fondo: '' };
    let rc = { v: Infinity, fondo: '' };
    let rd = { v: Infinity, fondo: '' };
    let justas = 0;
    for (const bg of fondos) {
      let peor = Infinity;
      for (const k of casillas) {
        const quien = `${k.paleta} pos ${k.pos} ${k.color}`;
        const cr = contrastRatio(k.color, bg);
        if (cr < c.v) c = { v: cr, bloque: quien, fondo: bg };
        const de = deltaE(k.color, bg);
        if (de < d.v) d = { v: de, bloque: quien, fondo: bg };
        peor = Math.min(peor, de);
      }
      if (peor < 10) justas++;
      const cr = contrastRatio(TRAP_RED, bg);
      if (cr < rc.v) rc = { v: cr, fondo: bg };
      const de = deltaE(TRAP_RED, bg);
      if (de < rd.v) rd = { v: de, fondo: bg };
    }
    return { contraste: c, deltaE: d, rojoContraste: rc, rojoDeltaE: rd, rojas: fondos.filter(esRojo).length, justas, total: fondos.length };
  };

  const ids = [...new Set([...Object.keys(muestras), ...j.fondos.map((f) => f.id)])];
  const fondos = ids.map((id) => {
    const f = j.fondos.find((x) => x.id === id);
    return { id, dibujado: muestras[id] ? separar(muestras[id]) : null, base: f ? separar(f.prueba) : null };
  });
  fs.writeFileSync(
    ruta('medidas-fondos.json'),
    JSON.stringify({ formula: deltaEControl(), reddish: REDDISH, trampa: TRAP_RED, paletas, fondos }, null, 1),
  );

  function deltaEControl() {
    // dos grises y un par saturado: sirven para detectar a la vista un error grueso en la fórmula
    return { negroBlanco: deltaE('#000000', '#ffffff'), igual: deltaE('#3060c0', '#3060c0'), rojoVerde: deltaE('#ff0000', '#00ff00') };
  }
});
