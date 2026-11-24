// Genera Papel (madera-1) y Cartón (madera-2) con el mismo lenguaje que medal.ts. Ver ../ESTILO_INSIGNIAS.md.
const fs = require('fs');
const OUT = require('path').join(__dirname, '..', 'insignias_nuevas'); // se corre desde cualquier carpeta
fs.mkdirSync(OUT, { recursive: true });

const r2 = (x) => Math.round(x * 100) / 100;
const pt = (x, y) => `${r2(x)},${r2(y)}`;
const rad = (d) => (d * Math.PI) / 180;
const polar = (r, d, cx = 50, cy = 50) => [cx + r * Math.cos(rad(d)), cy + r * Math.sin(rad(d))];
const attrs = (a) => Object.entries(a).map(([k, v]) => ` ${k}="${v}"`).join('');
const tag = (t, a, c) => (c ? `<${t}${attrs(a)}>${c}</${t}>` : `<${t}${attrs(a)}/>`);
const stops = (s) => s.map(([o, c, op]) => tag('stop', op === undefined ? { offset: o, 'stop-color': c } : { offset: o, 'stop-color': c, 'stop-opacity': op })).join('');
const lin = (id, s, x1 = 0, y1 = 0, x2 = 1, y2 = 1) => tag('linearGradient', { id, x1, y1, x2, y2 }, stops(s));
const radial = (id, s, cx = 0.5, cy = 0.5, r = 0.5) => tag('radialGradient', { id, cx, cy, r }, stops(s));
const circle = (r, a, cx = 50, cy = 50) => tag('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), ...a });

function starPts(cx, cy, R, ri, rot = -90) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = rad(rot + i * 36);
    const r = i % 2 ? ri : R;
    p.push(pt(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return p.join(' ');
}
function crescent(r, a) {
  const [x1, y1] = polar(r, 192);
  const [x2, y2] = polar(r, 292);
  return tag('path', { d: `M${pt(x1, y1)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(x2, y2)}A${r2(r * 1.3)} ${r2(r * 1.3)} 0 0 0 ${pt(x1, y1)}Z`, ...a });
}
const HL = lin('hl', [[0, '#fff', 0.95], [0.45, '#fff', 0], [1, '#fff', 0]]);
const PANEL_HL = lin('panelHl', [[0, '#fff', 0.45], [0.5, '#fff', 0], [1, '#fff', 0]], 0, 0, 0, 1);
const NAIL = radial('nail', [[0, '#fff6cf'], [0.45, '#e2b54a'], [1, '#7a5310']], 0.35, 0.3, 0.7);

/** Bloque del juego (panel) con la esquina de arriba a la derecha opcionalmente doblada. */
function panel(S, small, opts) {
  const x0 = 50 - S / 2, y0 = 50 - S / 2, x1 = x0 + S, y1 = y0 + S, rx = S * 0.22;
  const c = opts.dogEar ? S * 0.3 : 0;
  const shape = (dy, inset = 0) => {
    const a = x0 + inset, b = y0 + inset + dy, e = x1 - inset, f = y1 - inset + dy, r = rx - inset;
    if (!c) return `M${pt(a + r, b)}H${r2(e - r)}Q${pt(e, b)} ${pt(e, b + r)}V${r2(f - r)}Q${pt(e, f)} ${pt(e - r, f)}H${r2(a + r)}Q${pt(a, f)} ${pt(a, f - r)}V${r2(b + r)}Q${pt(a, b)} ${pt(a + r, b)}Z`;
    const cc = c - inset * 0.4;
    return `M${pt(a + r, b)}H${r2(e - cc)}L${pt(e, b + cc)}V${r2(f - r)}Q${pt(e, f)} ${pt(e - r, f)}H${r2(a + r)}Q${pt(a, f)} ${pt(a, f - r)}V${r2(b + r)}Q${pt(a, b)} ${pt(a + r, b)}Z`;
  };
  let o = tag('path', { d: shape(S * 0.07), fill: '#000', opacity: 0.4 });
  o += tag('path', { d: shape(0), fill: 'url(#panel)' });
  if (!small) o += tag('path', { d: shape(0, 0.6), fill: 'none', stroke: 'url(#panelHl)', 'stroke-width': 0.9 });
  if (c) {
    // la esquina doblada: el revés del papel, con su sombra sobre el bloque
    o += tag('polygon', { points: `${pt(x1 - c + 0.4, y0 + c * 0.25)} ${pt(x1 - c + 0.4, y0 + c + 1.2)} ${pt(x1 - c * 0.15, y0 + c + 1.2)}`, fill: '#000', opacity: 0.3 });
    o += tag('path', { d: `M${pt(x1 - c, y0)}L${pt(x1 - c, y0 + c - 1.2)}Q${pt(x1 - c, y0 + c)} ${pt(x1 - c + 1.2, y0 + c)}L${pt(x1, y0 + c)}Z`, fill: 'url(#fold)', stroke: opts.edge, 'stroke-width': 0.5, 'stroke-linejoin': 'round' });
  }
  if (!small) o += tag('rect', { x: r2(x0 + S * 0.14), y: r2(y0 + S * 0.8), width: r2(S * 0.4), height: r2(S * 0.08), rx: r2(S * 0.04), fill: '#fff', opacity: 0.55 });
  const cy = small ? 50 : 50 - S * 0.05;
  const drop = Math.max(0.7, S * 0.04);
  const R = S * (small ? 0.42 : 0.36);
  o += tag('polygon', { points: starPts(50, cy + drop, R, R * 0.47), fill: '#000', opacity: 0.45, 'stroke-linejoin': 'round' });
  o += tag('polygon', { points: starPts(50, cy, R, R * 0.47), fill: 'url(#glyph)', stroke: 'url(#glyph)', 'stroke-width': r2(S * 0.025), 'stroke-linejoin': 'round' });
  return o;
}

const svg = (body, small) => `<svg xmlns="http://www.w3.org/2000/svg" width="${small ? 28 : 120}" height="${small ? 28 : 120}" viewBox="0 0 100 100">${body}</svg>`;

// ------------------------------------------------------------------ Papel
function papel(small) {
  const R = 43, Rf = 33.5;
  const teeth = small ? 20 : 30;
  const depth = small ? 3.4 : 2.6;
  const zig = (dy) => {
    const p = [];
    for (let i = 0; i < teeth * 2; i++) {
      const a = -90 + (i * 180) / teeth;
      const [x, y] = polar(i % 2 ? R - depth : R, a);
      p.push(pt(x, y + dy));
    }
    return p.join(' ');
  };
  const edge = '#6b5a3c';
  const d = '<defs>' +
    lin('rim', [[0, '#ffffff'], [0.5, '#ece2cb'], [1, '#a8946f']]) +
    lin('rimIn', [[0, '#a8946f'], [1, '#ffffff']]) + HL +
    radial('face', [[0, '#fffdf7'], [1, '#e9dec4']], 0.38, 0.32, 0.75) +
    lin('panel', [[0, '#5d84b8'], [1, '#34557f']], 0, 0, 0, 1) + PANEL_HL +
    lin('fold', [[0, '#ffffff'], [1, '#c9d6e6']]) +
    lin('glyph', [[0, '#ffffff'], [1, '#dfe8f3']], 0, 0, 0, 1) +
    tag('clipPath', { id: 'fc' }, circle(Rf, {})) + '</defs>';
  let b = '';
  b += tag('polygon', { points: zig(Math.max(2, R * 0.07)), fill: '#000', opacity: 0.42 });
  b += tag('polygon', { points: zig(0), fill: 'url(#rim)', stroke: edge, 'stroke-width': 0.7, 'stroke-opacity': 0.85, 'stroke-linejoin': 'round' });
  if (!small) {
    // pliegues radiales del borde plisado (como un pirotín de papel)
    for (let i = 0; i < teeth; i++) {
      const a = -90 + (i * 360) / teeth;
      const [x1, y1] = polar(Rf + 2.4, a);
      const [x2, y2] = polar(R - depth - 0.4, a);
      b += tag('line', { x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke: edge, 'stroke-width': 0.45, opacity: 0.22 });
    }
  }
  b += circle(R - depth - 1.2, { fill: 'none', stroke: 'url(#hl)', 'stroke-width': small ? 1.8 : 1.3 });
  b += circle(Rf + 1.8, { fill: 'url(#rimIn)' });
  b += circle(Rf, { fill: 'url(#face)' });
  let tex = '';
  if (!small) {
    // hoja de cuaderno: renglones azules y margen rojo
    for (let y = 50 - Rf + 5; y < 50 + Rf; y += 5.6) tex += tag('line', { x1: 10, y1: r2(y), x2: 90, y2: r2(y), stroke: '#7ea6dd', 'stroke-width': 0.5, opacity: 0.7 });
    tex += tag('line', { x1: 27, y1: 10, x2: 27, y2: 90, stroke: '#e26464', 'stroke-width': 0.6, opacity: 0.6 });
  }
  tex += crescent(Rf - 1.2, { fill: '#fff', opacity: small ? 0.35 : 0.45 });
  b += tag('g', { 'clip-path': 'url(#fc)' }, tex);
  b += panel(Rf * (small ? 1.12 : 1.04), small, { dogEar: true, edge: '#1d3c66' });
  return svg(d + b, small);
}

// ------------------------------------------------------------------ Cartón
function carton(small) {
  const R = 43, Rf = 33.6;
  const edge = '#3f2a12';
  const d = '<defs>' +
    lin('rim', [[0, '#ecd3a4'], [0.5, '#b78d58'], [1, '#6a4a25']]) +
    lin('rimIn', [[0, '#6a4a25'], [1, '#ecd3a4']]) + HL +
    radial('face', [[0, '#d9bb88'], [1, '#ad8754']], 0.38, 0.32, 0.75) +
    lin('panel', [[0, '#8c6439'], [1, '#5b3c1c']], 0, 0, 0, 1) + PANEL_HL +
    lin('glyph', [[0, '#f6e2bd'], [1, '#d9b47a']], 0, 0, 0, 1) +
    lin('tape', [[0, '#fff6dc', 0.85], [1, '#e7d3a2', 0.8]], 0, 0, 0, 1) +
    tag('clipPath', { id: 'fc' }, circle(Rf, {})) + '</defs>';
  let b = '';
  b += circle(R, { fill: '#000', opacity: 0.42 }, 50, 50 + Math.max(2, R * 0.07));
  b += circle(R, { fill: 'url(#rim)' });
  // canto corrugado: dos capas (liners) y la onda entre ellas
  const rc = (R + Rf) / 2 + 0.5;
  const waves = small ? 16 : 34;
  const amp = small ? 2.4 : 2.1;
  const seg = waves * 8;
  let w = '';
  for (let i = 0; i < seg; i++) {
    const th = (i * 360) / seg;
    const r = rc + amp * Math.sin(rad(th * waves));
    const [x, y] = polar(r, th);
    w += (i ? 'L' : 'M') + pt(x, y);
  }
  b += tag('path', { d: w + 'Z', fill: 'none', stroke: edge, 'stroke-width': small ? 1.5 : 0.8, opacity: small ? 0.5 : 0.55, 'stroke-linejoin': 'round' });
  if (!small) {
    b += circle(rc + amp + 0.9, { fill: 'none', stroke: edge, 'stroke-width': 0.5, opacity: 0.4 });
    b += circle(rc - amp - 0.9, { fill: 'none', stroke: edge, 'stroke-width': 0.5, opacity: 0.4 });
  }
  b += circle(R - 0.35, { fill: 'none', stroke: edge, 'stroke-width': 0.7, opacity: 0.85 });
  b += circle(R - 1.5, { fill: 'none', stroke: 'url(#hl)', 'stroke-width': small ? 1.8 : 1.3 });
  b += circle(Rf + 1.8, { fill: 'url(#rimIn)' });
  b += circle(Rf, { fill: 'url(#face)' });
  let tex = '';
  if (!small) {
    // fibras del kraft (puntos y rayitas, deterministas)
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 46; i++) {
      const x = 16 + rnd() * 68, y = 16 + rnd() * 68;
      if (rnd() < 0.5) tex += circle(0.35 + rnd() * 0.4, { fill: '#5a3a16', opacity: 0.35 }, x, y);
      else {
        const a = rnd() * 180, l = 1.2 + rnd() * 1.8;
        tex += tag('line', { x1: r2(x), y1: r2(y), x2: r2(x + l * Math.cos(rad(a))), y2: r2(y + l * Math.sin(rad(a))), stroke: '#5a3a16', 'stroke-width': 0.35, opacity: 0.3 });
      }
    }
    // canaletas del corrugado que se marcan bajo la cara (muy suaves)
    for (let x = 50 - Rf + 4; x < 50 + Rf; x += 5) tex += tag('line', { x1: r2(x), y1: 10, x2: r2(x), y2: 90, stroke: '#7a5528', 'stroke-width': 1.6, opacity: 0.1 });
  }
  tex += crescent(Rf - 1.2, { fill: '#fff', opacity: small ? 0.22 : 0.28 });
  b += tag('g', { 'clip-path': 'url(#fc)' }, tex);
  const S = Rf * (small ? 1.12 : 1.04);
  b += panel(S, small, { dogEar: false });
  // cinta de embalar que pega el bloque al disco
  const tw = S * (small ? 0.62 : 0.5), th = small ? 8 : 6.4, ty = 50 - S / 2 - th * 0.55;
  const tx0 = 50 - tw / 2, tx1 = 50 + tw / 2;
  const n = small ? 3 : 5;
  let tp = `M${pt(tx0, ty)}H${r2(tx1)}`;
  for (let i = 1; i <= n; i++) tp += `L${pt(tx1 + (i % 2 ? 1.1 : 0), ty + (th * i) / n)}`;
  tp += `H${r2(tx0)}`;
  for (let i = n - 1; i >= 0; i--) tp += `L${pt(tx0 - ((n - i) % 2 ? 1.1 : 0), ty + (th * i) / n)}`;
  b += tag('path', { d: tp + 'Z', fill: 'url(#tape)', stroke: '#9c7a45', 'stroke-width': 0.4, 'stroke-opacity': 0.6, 'stroke-linejoin': 'round' });
  if (!small) b += tag('rect', { x: r2(tx0 + 1.5), y: r2(ty + 1), width: r2(tw - 3), height: 1.1, rx: 0.5, fill: '#fff', opacity: 0.7 });
  return svg(d + b, small);
}

// ------------------------------------------------------------------ Madera
function madera(small) {
  const R = 43, Rf = R * 0.79;
  const edge = '#2e1706';
  const SR = small ? 31 : 29.5;
  const si = SR * (small ? 0.5 : 0.48);
  const cy = 51.5;
  const d = '<defs>' +
    lin('rim', [[0, '#d0a46c'], [0.5, '#8f6439'], [1, '#4a2f15']]) +
    lin('rimIn', [[0, '#4a2f15'], [1, '#d0a46c']]) + HL +
    radial('face', [[0, '#d8ad74'], [1, '#9f7344']], 0.38, 0.32, 0.75) +
    // estrella de nogal (otra madera, más oscura y rojiza)
    lin('star', [[0, '#8a4f2a'], [0.55, '#5e3017'], [1, '#3a1a09']]) +
    lin('starHl', [[0, '#ffd9b0', 0.75], [0.5, '#ffd9b0', 0], [1, '#ffd9b0', 0]]) +
    NAIL +
    tag('clipPath', { id: 'fc' }, circle(Rf, {})) +
    (small ? '' : tag('clipPath', { id: 'sc' }, tag('polygon', { points: starPts(50, cy, SR, si) }))) +
    '</defs>';
  let b = '';
  b += circle(R, { fill: '#000', opacity: 0.42 }, 50, 50 + Math.max(2, R * 0.07));
  b += circle(R, { fill: 'url(#rim)' });
  if (!small) {
    b += circle((R + Rf) / 2 + 1.2, { fill: 'none', stroke: edge, 'stroke-width': 0.5, opacity: 0.3 });
    b += circle((R + Rf) / 2 - 1.4, { fill: 'none', stroke: edge, 'stroke-width': 0.4, opacity: 0.22 });
  }
  b += circle(R - 0.35, { fill: 'none', stroke: edge, 'stroke-width': 0.7, opacity: 0.85 });
  b += circle(R - 1.5, { fill: 'none', stroke: 'url(#hl)', 'stroke-width': small ? 1.8 : 1.3 });
  b += circle(Rf + 1.8, { fill: 'url(#rimIn)' });
  b += circle(Rf, { fill: 'url(#face)' });
  let tex = '';
  if (!small) {
    for (let i = -4; i <= 4; i++) {
      const y = 50 + i * Rf * 0.23;
      const w = (i % 2 ? 2.2 : -1.8) + i * 0.3;
      tex += tag('path', { d: `M${pt(50 - Rf - 2, y)}C${pt(50 - Rf / 3, y - w * 1.6)} ${pt(50 + Rf / 4, y + w * 1.4)} ${pt(50 + Rf + 2, y - w * 0.4)}`, fill: 'none', stroke: '#5d3412', 'stroke-width': i % 2 ? 0.7 : 0.5, opacity: 0.38 });
    }
  }
  tex += crescent(Rf - 1.2, { fill: '#fff', opacity: small ? 0.22 : 0.28 });
  b += tag('g', { 'clip-path': 'url(#fc)' }, tex);

  // estrella de otra madera, con un remache en cada punta
  const drop = small ? 2.6 : 2.2;
  b += tag('polygon', { points: starPts(50, cy + drop, SR, si), fill: '#000', opacity: 0.42, stroke: '#000', 'stroke-width': 2.2, 'stroke-linejoin': 'round' });
  b += tag('polygon', { points: starPts(50, cy, SR, si), fill: 'url(#star)', stroke: '#1e0c02', 'stroke-width': small ? 2.4 : 1.6, 'stroke-linejoin': 'round' });
  if (!small) {
    let g = '';
    for (let i = -6; i <= 6; i++) {
      const x = 50 + i * 4.2;
      const k = (i % 2 ? 1.6 : -1.3) + i * 0.15;
      g += tag('path', { d: `M${pt(x, cy - SR - 2)}C${pt(x + k * 1.5, cy - SR / 3)} ${pt(x - k * 1.3, cy + SR / 4)} ${pt(x + k * 0.4, cy + SR + 2)}`, fill: 'none', stroke: i % 3 === 0 ? '#2a1205' : '#b0703f', 'stroke-width': i % 2 ? 0.6 : 0.45, opacity: i % 3 === 0 ? 0.45 : 0.35 });
    }
    g += tag('ellipse', { cx: 56, cy: r2(cy + 8), rx: 1.1, ry: 2.4, fill: 'none', stroke: '#2a1205', 'stroke-width': 0.5, opacity: 0.5 });
    b += tag('g', { 'clip-path': 'url(#sc)' }, g);
    b += tag('polygon', { points: starPts(50, cy, SR - 1.6, si - 0.9), fill: 'none', stroke: 'url(#starHl)', 'stroke-width': 1.1, 'stroke-linejoin': 'round' });
  } else {
    b += tag('polygon', { points: starPts(50, cy, SR - 2.4, si - 1.3), fill: 'none', stroke: 'url(#starHl)', 'stroke-width': 1.5, 'stroke-linejoin': 'round' });
  }
  // remaches de latón en las cinco puntas
  const rn = small ? 4.1 : 2.75;
  const rr = SR - (small ? 7.2 : 5.6);
  for (let i = 0; i < 5; i++) {
    const [x, y] = polar(rr, -90 + i * 72, 50, cy);
    b += circle(rn, { fill: '#000', opacity: 0.4 }, x, y + 0.7);
    b += circle(rn, { fill: 'url(#nail)', stroke: edge, 'stroke-width': 0.4 }, x, y);
    if (!small) b += circle(rn * 0.32, { fill: '#fff', opacity: 0.8 }, x - rn * 0.32, y - rn * 0.35);
  }
  return svg(d + b, small);
}

// madera-3 (Madera) se genera con gen-madera.js: la versión de este archivo es la antigua, sin bloque central, y no debe pisarla.
const files = { 'madera-1': papel, 'madera-2': carton };
for (const [name, fn] of Object.entries(files)) {
  fs.writeFileSync(`${OUT}/${name}.svg`, fn(false));
  fs.writeFileSync(`${OUT}/${name}-small.svg`, fn(true));
}
console.log('ok', fs.readdirSync(OUT));
