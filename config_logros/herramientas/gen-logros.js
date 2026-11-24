// Iconos de los logros (CAMBIO-011): una forma por logro y siete "pieles" de material, más el estado vacío.
// Mismo lenguaje de luz que las insignias (ver ../ESTILO_INSIGNIAS.md y ../ESTILO_LOGROS.md).
// Uso: node config_logros/herramientas/gen-logros.js  (desde cualquier carpeta) → escribe ../logros_iconos/*.svg
const fs = require('fs');
const OUT = require('path').join(__dirname, '..', 'logros_iconos');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- utilidades (las mismas de gen-papel-carton.js / gen-madera.js)
const r2 = (x) => Math.round(x * 100) / 100;
const pt = (x, y) => `${r2(x)},${r2(y)}`;
const attrs = (a) => Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('');
const tag = (t, a, c) => (c ? `<${t}${attrs(a)}>${c}</${t}>` : `<${t}${attrs(a)}/>`);
const stops = (s) => s.map(([o, c, op]) => tag('stop', op === undefined ? { offset: o, 'stop-color': c } : { offset: o, 'stop-color': c, 'stop-opacity': op })).join('');
const lin = (id, s, x1 = 0, y1 = 0, x2 = 1, y2 = 1) => tag('linearGradient', { id, x1, y1, x2, y2 }, stops(s));
const radial = (id, s, cx = 0.5, cy = 0.5, r = 0.5) => tag('radialGradient', { id, cx, cy, r }, stops(s));
const circle = (r, a, cx = 50, cy = 50) => tag('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), ...a });
const HL = lin('hl', [[0, '#fff', 0.95], [0.45, '#fff', 0], [1, '#fff', 0]]);
const NAIL = radial('nail', [[0, '#fff6cf'], [0.45, '#e2b54a'], [1, '#7a5310']], 0.35, 0.3, 0.7);
/** Reparte los colores en degradado parejo (claro → oscuro). */
const even = (cs) => cs.map((c, i) => [r2(i / (cs.length - 1)), c]);

/** Destello de cuatro puntas (como `sparkle()` de medal.ts). */
function sparkle(cx, cy, s, a) {
  const k = s * 0.14;
  const d = `M${pt(cx, cy - s)}Q${pt(cx + k, cy - k)} ${pt(cx + s, cy)}Q${pt(cx + k, cy + k)} ${pt(cx, cy + s)}Q${pt(cx - k, cy + k)} ${pt(cx - s, cy)}Q${pt(cx - k, cy - k)} ${pt(cx, cy - s)}Z`;
  return tag('path', { d, ...a });
}

// ---------------------------------------------------------------- geometría
// Todos los trazados se escriben con pares "x,y" para poder correrlos (sombras, grosor) o reflejarlos sin `transform`.
const PAIR = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
const shift = (d, dx, dy) => d.replace(PAIR, (_, x, y) => pt(+x + dx, +y + dy));
const mirror = (d) => d.replace(PAIR, (_, x, y) => pt(100 - +x, +y));
function bbox(d) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const m of d.matchAll(PAIR)) {
    const x = +m[1], y = +m[2];
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
/** Polígono con las esquinas redondeadas (radio r). */
function roundPoly(P, r) {
  let d = '';
  const n = P.length;
  P.forEach((p, i) => {
    const A = P[(i + n - 1) % n], B = P[(i + 1) % n];
    const toward = (Q) => {
      const L = Math.hypot(Q[0] - p[0], Q[1] - p[1]);
      const k = Math.min(r / L, 0.5);
      return [p[0] + (Q[0] - p[0]) * k, p[1] + (Q[1] - p[1]) * k];
    };
    const a = toward(A), b = toward(B);
    d += `${i ? 'L' : 'M'}${pt(...a)}Q${pt(...p)} ${pt(...b)}`;
  });
  return d + 'Z';
}
const roundRect = (x, y, w, h, r) => roundPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);

// ---------------------------------------------------------------- formas (una por logro)
// Cada pieza: { d, tone: 'm' (material) | 'md' (más oscuro) | 'ml' (más claro), tex: con textura }.
// `depth`: grosor (copia corrida hacia abajo en el tono oscuro), como el bloque del juego en relieve.
const FLAME_OUT = 'M50,42C55,49 63,54 63,66C63,75 57,81 50,81C43,81 37,75 37,67C37,60 41,56 44,51C45,56 47,58 49,59C48,53 47,47 50,42Z';
const FLAME_IN = 'M50,58C54,63 57,66 57,71C57,76 54,79 50,79C46,79 43,76 43,72C43,68 46,65 47,62C48,65 49,66 50,66C49,63 49,61 50,58Z';
const HANDLE = 'M26,19C12,17 8,24 10,31C12,39 20,44 32,45L33,39C24,38 18,35 16,30C15,25 18,24 26,25Z';

const SHAPES = {
  // Rayo (Máximo combo)
  racha: {
    depth: 4.5,
    parts: [{ d: roundPoly([[60, 6], [24, 51], [46, 51], [37, 86], [77, 40], [55, 40], [70, 6]], 2.6), tone: 'm', tex: true }],
    rivets: [[51.5, 28], [49.5, 63]],
    spark: [[55, 15, 4.4], [64, 45, 2.8], [46, 70, 2.4]],
  },
  // Botón de play: triángulo redondeado con grosor (no un círculo, que se confunde con una medalla)
  partidas: {
    depth: 5,
    parts: [{ d: roundPoly([[28, 13], [85, 47.5], [28, 82]], 10), tone: 'm', tex: true }],
    rivets: [[39, 30], [39, 65], [66, 47.5]],
    spark: [[38, 27, 4.4], [62, 52, 2.8], [36, 68, 2.4]],
  },
  // Calendario con llama (Días seguidos de reto diario)
  diasReto: {
    depth: 0,
    parts: [
      { d: roundRect(14, 22, 72, 64, 9), tone: 'ml', tex: true },
      { d: 'M23,22L77,22Q86,22 86,31L86,40L14,40L14,31Q14,22 23,22Z', tone: 'md', tex: true },
      { d: roundRect(29, 12, 7, 18, 3.5), tone: 'm', tex: false },
      { d: roundRect(64, 12, 7, 18, 3.5), tone: 'm', tex: false },
    ],
    flame: true,
    rivets: [[21, 31], [79, 31]],
    spark: [[24, 50, 4], [76, 74, 2.6], [78, 30, 2.4]],
  },
  // Copa de trofeo (Mejor resultado en un reto diario): asas, pie y base
  mejorReto: {
    depth: 0,
    parts: [
      { d: HANDLE, tone: 'm', tex: false },
      { d: mirror(HANDLE), tone: 'm', tex: false },
      { d: 'M45,55L55,55L53,70L47,70Z', tone: 'md', tex: false },
      { d: roundRect(41, 67, 18, 6, 2.5), tone: 'm', tex: false },
      { d: roundRect(32, 72, 36, 9, 2), tone: 'm', tex: true },
      { d: roundRect(24, 80, 52, 10, 2.5), tone: 'md', tex: true },
      { d: 'M24,14L76,14C76,40 66,55 50,57C34,55 24,40 24,14Z', tone: 'm', tex: true },
      { d: 'M24,14C24,9.5 76,9.5 76,14C76,18.5 24,18.5 24,14Z', tone: 'md', tex: false },
    ],
    rivets: [[30, 85], [70, 85]],
    spark: [[34, 26, 4.6], [64, 34, 2.8], [62, 85, 2.4]],
  },
};

// ---------------------------------------------------------------- materiales (las siete pieles)
// Colores base: Papel, Cartón y Madera de insignias_nuevas/ (CAMBIO-005); Bronce, Plata, Oro y Diamante de insignias/ (medal.ts).
const lines = (bb, step, a) => {
  let o = '';
  for (let y = bb.y0 + step * 0.8; y < bb.y1; y += step) o += tag('line', { x1: r2(bb.x0 - 2), y1: r2(y), x2: r2(bb.x1 + 2), y2: r2(y), ...a });
  return o;
};
const shine = (bb, op) =>
  // reflejos en diagonal del metal pulido (como en las medallas)
  tag('polygon', { points: `${pt(bb.x0, bb.y0 + bb.h * 0.62)} ${pt(bb.x0 + bb.w * 0.62, bb.y0)} ${pt(bb.x0 + bb.w * 0.8, bb.y0 + bb.h * 0.12)} ${pt(bb.x0 + bb.w * 0.12, bb.y0 + bb.h * 0.8)}`, fill: '#fff', opacity: op }) +
  tag('polygon', { points: `${pt(bb.x0 + bb.w * 0.3, bb.y1)} ${pt(bb.x1, bb.y0 + bb.h * 0.3)} ${pt(bb.x1, bb.y0 + bb.h * 0.42)} ${pt(bb.x0 + bb.w * 0.42, bb.y1)}`, fill: '#fff', opacity: op * 0.75 });

const MATS = {
  papel: {
    m: ['#fdf6e6', '#ecdcbb', '#b9a37b'], md: ['#e6d7b5', '#cbb68c', '#988159'], ml: ['#fffcf3', '#f6ecd6', '#d9c8a4'],
    edge: '#6b5a3c',
    // hoja de cuaderno (renglones azules) y un pliegue en diagonal: una mitad un poco más oscura y el doblez claro
    tex: (bb, d, i) => {
      const fx0 = bb.x0 + bb.w * 0.64, fx1 = bb.x0 + bb.w * 0.36;
      return lines(bb, 5.2, { stroke: '#7ea6dd', 'stroke-width': 0.5, opacity: 0.6 }) +
        (i === 0 ? tag('line', { x1: r2(bb.x0 + 6), y1: r2(bb.y0), x2: r2(bb.x0 + 6), y2: r2(bb.y1), stroke: '#e26464', 'stroke-width': 0.6, opacity: 0.55 }) : '') +
        tag('polygon', { points: `${pt(fx0, bb.y0 - 1)} ${pt(bb.x1 + 1, bb.y0 - 1)} ${pt(bb.x1 + 1, bb.y1 + 1)} ${pt(fx1, bb.y1 + 1)}`, fill: '#5a4a2c', opacity: 0.09 }) +
        tag('line', { x1: r2(fx0), y1: r2(bb.y0 - 1), x2: r2(fx1), y2: r2(bb.y1 + 1), stroke: '#fff', 'stroke-width': 0.9, opacity: 0.85 });
    },
  },
  carton: {
    m: ['#ecd3a4', '#c39a62', '#7a5630'], md: ['#b78d58', '#8c6439', '#5b3c1c'], ml: ['#f0dbb2', '#d6b37c', '#a77f4c'],
    edge: '#3f2a12',
    // canaletas del corrugado, fibras y el canto cortado que deja ver la onda (banda rayada por dentro del borde)
    tex: (bb, d) => {
      let o = '';
      for (let x = bb.x0 + 2; x < bb.x1; x += 4.4) o += tag('line', { x1: r2(x), y1: r2(bb.y0 - 1), x2: r2(x), y2: r2(bb.y1 + 1), stroke: '#7a5528', 'stroke-width': 1.5, opacity: 0.13 });
      let s = Math.round(bb.x0 * 7 + bb.y0 * 3) + 7;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      const n = Math.round((bb.w * bb.h) / 90);
      for (let k = 0; k < n; k++) o += circle(0.35 + rnd() * 0.35, { fill: '#5a3a16', opacity: 0.35 }, bb.x0 + rnd() * bb.w, bb.y0 + rnd() * bb.h);
      o += tag('path', { d, fill: 'none', stroke: '#5a3d1c', 'stroke-width': 4.2, 'stroke-dasharray': '1.2 1.3', opacity: 0.4 });
      return o;
    },
  },
  madera: {
    m: ['#e2b77c', '#b07f4a', '#6e4824'], md: ['#8a4f2a', '#5e3017', '#3a1a09'], ml: ['#f2d6a2', '#dcb57c', '#c99558'],
    edge: '#2e1706',
    // veta (curvas suaves en horizontal) y un nudo en las piezas grandes
    tex: (bb, d, i, tone) => {
      let o = '';
      const col = tone === 'md' ? '#d79a62' : '#5d3412';
      for (let k = 0, y = bb.y0 + 3; y < bb.y1; y += 4.6, k++) {
        const w = (k % 2 ? 1.8 : -1.5) + k * 0.1;
        o += tag('path', { d: `M${pt(bb.x0 - 2, y)}C${pt(bb.x0 + bb.w / 3, y - w * 1.5)} ${pt(bb.x0 + (bb.w * 2) / 3, y + w * 1.3)} ${pt(bb.x1 + 2, y - w * 0.4)}`, fill: 'none', stroke: col, 'stroke-width': k % 2 ? 0.7 : 0.5, opacity: tone === 'md' ? 0.3 : 0.38 });
      }
      if (bb.w > 40 && bb.h > 40 && tone !== 'md') {
        const cx = bb.x0 + bb.w * 0.36, cy = bb.y0 + bb.h * 0.72;
        o += tag('path', { d: `M${pt(cx - 3.4, cy)}C${pt(cx - 3.4, cy - 2.2)} ${pt(cx + 3.4, cy - 2.2)} ${pt(cx + 3.4, cy)}C${pt(cx + 3.4, cy + 2.2)} ${pt(cx - 3.4, cy + 2.2)} ${pt(cx - 3.4, cy)}Z`, fill: 'none', stroke: '#5d3412', 'stroke-width': 0.6, opacity: 0.45 });
      }
      return o;
    },
    rivets: true,
  },
  bronce: {
    m: [[0, '#ffc193'], [0.3, '#cd6f36'], [0.55, '#f3a66f'], [0.8, '#9a4718'], [1, '#c96b32']], md: ['#b0602a', '#8c4b1d', '#552a0d'], ml: ['#ffd9b8', '#f3a66f', '#cd6f36'],
    edge: '#3d1a04',
    tex: (bb) => shine(bb, 0.13),
  },
  plata: {
    m: [[0, '#ffffff'], [0.3, '#bcc5d1'], [0.55, '#f1f4f8'], [0.8, '#8d99a9'], [1, '#c2cad5']], md: ['#c9d0da', '#8d99a9', '#5f6b7c'], ml: ['#ffffff', '#e8edf3', '#c2cad5'],
    edge: '#2c3340',
    tex: (bb) => shine(bb, 0.16),
    sparks: 1,
  },
  oro: {
    m: [[0, '#fff4b0'], [0.3, '#efb12a'], [0.55, '#ffe27c'], [0.8, '#c98400'], [1, '#efb12a']], md: ['#e2a727', '#b07a00', '#7d4f00'], ml: ['#fffbe0', '#ffe27c', '#efb12a'],
    edge: '#553400',
    tex: (bb) => shine(bb, 0.16),
    sparks: 2,
  },
  diamante: {
    m: ['#e6faff', '#79d3f8', '#2390d2'], md: ['#56c4f5', '#2390d2', '#1677b8'], ml: ['#f2fdff', '#c9f2ff', '#8ddcff'],
    edge: '#1d4a66',
    // tallado: abanico de facetas desde el centro de cada pieza, más claras arriba a la izquierda
    tex: (bb) => {
      const cx = bb.x0 + bb.w * 0.45, cy = bb.y0 + bb.h * 0.42, R = Math.max(bb.w, bb.h);
      const N = 10;
      let o = '';
      for (let k = 0; k < N; k++) {
        const a0 = (k * 2 * Math.PI) / N - Math.PI / 2, a1 = ((k + 1) * 2 * Math.PI) / N - Math.PI / 2;
        const mid = (a0 + a1) / 2;
        const lit = -Math.cos(mid - (-3 * Math.PI) / 4); // 1 = mira a la luz (arriba a la izquierda)
        o += tag('polygon', { points: `${pt(cx, cy)} ${pt(cx + R * Math.cos(a0), cy + R * Math.sin(a0))} ${pt(cx + R * Math.cos(a1), cy + R * Math.sin(a1))}`, fill: lit < 0 ? '#fff' : '#0b4f80', opacity: r2(lit < 0 ? 0.08 - lit * 0.3 : lit * 0.2), stroke: '#fff', 'stroke-width': 0.5, 'stroke-opacity': 0.55 });
      }
      // mesa (faceta central)
      o += tag('polygon', { points: `${pt(cx, cy - 5)} ${pt(cx + 5, cy)} ${pt(cx, cy + 5)} ${pt(cx - 5, cy)}`, fill: '#e6faff', opacity: 0.7, stroke: '#fff', 'stroke-width': 0.5 });
      return o;
    },
    sparks: 3,
  },
};

// ---------------------------------------------------------------- dibujo
const SHADOW_DY = 3; // sombra dura, como `max(2, R·0.07)` de las medallas
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 100 100">${body}</svg>`;

function flame(empty) {
  if (empty) return tag('path', { d: FLAME_OUT, fill: '#2c2c3d', stroke: '#4a4a66', 'stroke-width': 1.2, 'stroke-dasharray': '2.6 2' });
  return (
    tag('path', { d: shift(FLAME_OUT, 0, 1.6), fill: '#000', opacity: 0.35 }) +
    tag('path', { d: FLAME_OUT, fill: 'url(#flame)', stroke: '#7a2008', 'stroke-width': 0.7, 'stroke-linejoin': 'round' }) +
    tag('path', { d: FLAME_IN, fill: 'url(#flameIn)' }) +
    tag('path', { d: 'M46,52C44,56 41,60 41,66', fill: 'none', stroke: '#fff3c4', 'stroke-width': 1.1, 'stroke-linecap': 'round', opacity: 0.7 })
  );
}

function icon(id, matId) {
  const S = SHAPES[id];
  if (matId === 'vacio') {
    // estado vacío: la misma silueta en gris oscuro apagado, con borde punteado (como EmptyMedal / "Sin insignia")
    let b = '';
    for (const p of S.parts) b += tag('path', { d: p.d, fill: p.tone === 'md' ? '#242433' : '#1f1f2d', stroke: '#4a4a66', 'stroke-width': 1.6, 'stroke-dasharray': '3 2.2', 'stroke-linejoin': 'round' });
    if (S.flame) b += flame(true);
    return svg(b);
  }
  const M = MATS[matId];
  const grad = (k, cs) => lin(k, Array.isArray(cs[0]) ? cs : even(cs));
  let defs = grad('m', M.m) + grad('md', M.md) + grad('ml', M.ml) + HL;
  if (M.rivets) defs += NAIL;
  if (S.flame) defs += lin('flame', [[0, '#ffc23a'], [0.55, '#ff7a1a'], [1, '#d93a12']], 0, 0, 0, 1) + lin('flameIn', [[0, '#fffbe0'], [1, '#ffd23a']], 0, 0, 0, 1);
  S.parts.forEach((p, i) => (defs += tag('clipPath', { id: `c${i}` }, tag('path', { d: p.d }))));

  let b = '';
  // sombra dura de todo el objeto (con su grosor)
  for (const p of S.parts) b += tag('path', { d: shift(p.d, 0, S.depth + SHADOW_DY), fill: '#000', opacity: 0.42 });
  S.parts.forEach((p, i) => {
    const bb = bbox(p.d);
    if (S.depth) {
      // grosor: el canto del objeto, en el tono oscuro del material
      b += tag('path', { d: shift(p.d, 0, S.depth), fill: 'url(#md)', stroke: M.edge, 'stroke-width': 0.7, 'stroke-opacity': 0.85, 'stroke-linejoin': 'round' });
      for (let k = 1; k < S.depth; k += 1) b += tag('path', { d: shift(p.d, 0, k), fill: 'url(#md)' });
    }
    b += tag('path', { d: p.d, fill: `url(#${p.tone})` });
    let inner = p.tex && M.tex ? M.tex(bb, p.d, i, p.tone) : matId === 'diamante' ? M.tex(bb) : '';
    // brillo del borde por dentro (aro `hl` de las medallas): trazo doble recortado a la pieza
    inner += tag('path', { d: p.d, fill: 'none', stroke: 'url(#hl)', 'stroke-width': 2.6 });
    b += tag('g', { 'clip-path': `url(#c${i})` }, inner);
    b += tag('path', { d: p.d, fill: 'none', stroke: M.edge, 'stroke-width': 0.7, 'stroke-opacity': 0.85, 'stroke-linejoin': 'round' });
  });
  if (S.flame) b += flame(false);
  if (M.rivets) {
    // remaches de latón, como en la insignia Madera
    for (const [x, y] of S.rivets) {
      b += circle(2.1, { fill: '#000', opacity: 0.4 }, x, y + 0.6);
      b += circle(2.1, { fill: 'url(#nail)', stroke: M.edge, 'stroke-width': 0.35 }, x, y);
      b += circle(0.65, { fill: '#fff', opacity: 0.8 }, x - 0.6, y - 0.7);
    }
  }
  if (M.sparks) {
    // destellos sobre el objeto: 1 en Plata, 2 en Oro, 3 en Diamante
    S.spark.slice(0, M.sparks).forEach(([x, y, s], k) => (b += sparkle(x, y, s, { fill: '#fff', opacity: k ? 0.85 : 0.95 })));
  }
  return svg(tag('defs', {}, defs) + b);
}

const MATERIALS = ['papel', 'carton', 'madera', 'bronce', 'plata', 'oro', 'diamante', 'vacio'];
let n = 0;
for (const id of Object.keys(SHAPES)) {
  for (const m of MATERIALS) {
    fs.writeFileSync(require('path').join(OUT, `${id}-${m}.svg`), icon(id, m));
    n++;
  }
}
console.log(`${n} iconos en ${OUT}`);
