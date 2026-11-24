// Experimento CONTORNO PURO: ¿algún rojo de trampa (y color de número) hace pasar las reglas con relleno 0?
// No es una prueba del juego; vuelca contorno-puro.json. Usa las funciones y reglas reales (reglas.ts).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { COLORS } from '@tb/engine';
import { PALETTES, contrastRatio, hue, hueDistance, luminance } from '@/cosmetics/palettes';
import { SAFE_POS, evaluar, redVsSafe, hueVsSafe, REF } from './reglas';

const aqui = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const cand = JSON.parse(fs.readFileSync(aqui('./candidatos-contorno.json'), 'utf8'));
const cat = JSON.parse(fs.readFileSync(aqui('./candidatas.json'), 'utf8'));
const BG: string = cand.fondo;
const BORDES: string[] = cat.base.contorno; // los 9 hex de Contorno (los bordes)
const PURO = Array(9).fill(BG) as string[]; // color efectivo bajo el número con relleno 0

// CIELAB / CIE76 (informativo; el juego no lo usa)
const lab = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a: string, b: string) => { const x = lab(a), y = lab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const hsl = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  return { h: hue(h), s: d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l };
};

it('contorno puro', () => {
  const out: Record<string, unknown> = {};

  // 1. Candidatos con nombre
  const filas = (cand.candidatos as { id: string; rojo: string; numero: string; nota: string }[]).map((c) => {
    const reglas = evaluar(PURO, c.rojo, c.numero);
    const bordes = BORDES.map((b, i) => ({ pos: i, hex: b, dE: dE(c.rojo, b) }));
    const minB = bordes.reduce((a, b) => (b.dE < a.dE ? b : a));
    return {
      ...c,
      luminanciaRojo: luminance(c.rojo),
      contrasteRojoFondo: contrastRatio(c.rojo, BG),
      contrasteNumeroFondo: contrastRatio(c.numero, BG),
      contrasteRojoNumero: contrastRatio(c.rojo, c.numero),
      hslRojo: hsl(c.rojo),
      dE_rojo_fondo: dE(c.rojo, BG),
      dE_rojo_numero: dE(c.rojo, c.numero),
      dE_rojo_rojoContorno: dE(c.rojo, BORDES[0]),
      dE_rojo_naranjaContorno: dE(c.rojo, BORDES[1]),
      dE_rojo_bordeMasCercano: minB,
      reglas,
      pasaTodas: reglas.every((r) => r.ok),
      pasaTodasMenos9Distintos: reglas.filter((r) => r.regla !== '9 colores #rrggbb distintos').every((r) => r.ok),
    };
  });
  out.candidatos = filas;

  // 2. Barrido de TODO el cubo RGB (paso 3): el rojo/número blanco que pasaría las reglas de contraste y de tono
  {
    const total = { n: 0, contrasteOk: 0, tonoOk: 0, ambas: 0, todasMenos9: 0 };
    const contrasteOk: { hex: string; c: number; h: number; s: number }[] = [];
    for (let r = 0; r <= 255; r += 3) for (let g = 0; g <= 255; g += 3) for (let b = 0; b <= 255; b += 3) {
      const h = hex(r, g, b);
      total.n++;
      const rs = redVsSafe(PURO, h);
      const cOk = Math.min(...rs) >= Math.min(...REF.red) && Math.max(...rs) <= Math.max(...REF.red) && Math.min(...rs) <= Math.min(...REF.red) + 0.1;
      const hs = hueVsSafe(PURO, h);
      const m = hs.reduce((a, x) => a + x, 0) / 6;
      const mRef = REF.hue.reduce((a, x) => a + x, 0) / 6;
      const tOk = Math.min(...hs) >= Math.min(...REF.hue) - 5 && Math.max(...hs) <= Math.max(...REF.hue) + 5 && Math.min(...hs) <= Math.min(...REF.hue) + 8 && Math.abs(m - mRef) <= 20;
      if (cOk) { total.contrasteOk++; if (contrasteOk.length < 100000) contrasteOk.push({ hex: h, c: rs[0], h: hsl(h).h, s: hsl(h).s }); }
      if (tOk) total.tonoOk++;
      if (cOk && tOk) total.ambas++;
      if (evaluar(PURO, h).filter((x) => x.regla !== '9 colores #rrggbb distintos').every((x) => x.ok)) total.todasMenos9++;
    }
    // reglas de tono por separado: ¿qué tonos (HSL) de texto las pasan?
    const tonosQuePasan: number[] = [];
    for (let h = 0; h < 360; h += 1) {
      const d = Math.min(Math.abs(h - hue(BG)) % 360, 360 - (Math.abs(h - hue(BG)) % 360));
      const hs = Array(6).fill(d);
      const mRef = REF.hue.reduce((a, x) => a + x, 0) / 6;
      const ok = d >= Math.min(...REF.hue) - 5 && d <= Math.max(...REF.hue) + 5 && d <= Math.min(...REF.hue) + 8 && Math.abs(d - mRef) <= 20 && hs.length === 6;
      if (ok) tonosQuePasan.push(h);
    }
    const rojosEnBanda = contrasteOk.filter((x) => (x.h >= 335 || x.h <= 25) && x.s > 0.35);
    out.barrido = {
      total,
      tonoBg: hue(BG),
      tonosQuePasanLasTresReglasDeTono: tonosQuePasan,
      coloresEnBandaDeContraste: contrasteOk.length,
      rojosReconocibles_enBandaDeContraste: rojosEnBanda.length,
      ejemplosRojosEnBanda: rojosEnBanda.slice(0, 5),
      luminanciaBandaContraste: [Math.min(...REF.red) * (luminance(BG) + 0.05) - 0.05, (Math.min(...REF.red) + 0.1) * (luminance(BG) + 0.05) - 0.05],
      contrasteBanda: [Math.min(...REF.red), Math.min(...REF.red) + 0.1],
      distanciaDeTonoMinimaDeUnRojo: (() => {
        let mn = 999;
        for (let h = 335; h <= 385; h++) { const hh = h % 360; const d = Math.min(Math.abs(hh - 240), 360 - Math.abs(hh - 240)); if (d < mn) mn = d; }
        return mn;
      })(),
    };
  }

  // 3. Referencia de "qué tan visible es la trampa" en otras paletas: ΔE y contraste del #ff2a2a contra el color bajo el número
  {
    const RED = '#ff2a2a';
    const medir = (cols: string[], red = RED, num = '#ffffff') => SAFE_POS.map((i) => ({ pos: i, fill: cols[i], dE: dE(red, cols[i]), contraste: contrastRatio(red, cols[i]), dE_rojo_numero: dE(red, num) }));
    const clasica = [...COLORS] as string[];
    out.visibilidad = {
      clasica: medir(clasica),
      cristal: medir(cat.efectivo.cristal),
      contorno55: medir(cat.efectivo.contorno55),
      contornoPuroActual: medir(PURO),
      contornoPuro_4d101a: medir(PURO, '#4d101a'),
      contornoPuro_8a2030: medir(PURO, '#8a2030'),
    };
    out.rojoVsBlanco = { dE: dE(RED, '#ffffff'), contraste: contrastRatio(RED, '#ffffff') };
    out.paletas = Object.keys(PALETTES);
  }
  fs.writeFileSync(aqui('./contorno-puro.json'), JSON.stringify(out, null, 2));
}, 300000);
