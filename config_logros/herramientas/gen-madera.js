// Madera (madera-3): disco de madera de hoy + bloque central de arce claro con estrella de nogal remachada.
const fs = require('fs');
const OUT = require('path').join(__dirname, '..', 'insignias_nuevas'); // se corre desde cualquier carpeta
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
function starPts(cx, cy, R, ri) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = rad(-90 + i * 36);
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

function madera(small) {
  const R = 43, Rf = R * 0.79;
  const edge = '#2e1706';
  const S = Rf * (small ? 1.12 : 1.04);
  const x0 = 50 - S / 2, y0 = 50 - S / 2, rx = S * 0.22;
  const cy = small ? 50.6 : 50 - S * 0.05 + 0.6;
  const SR = S * (small ? 0.45 : 0.42);
  const si = SR * 0.5;
  const defs = '<defs>' +
    lin('rim', [[0, '#d0a46c'], [0.5, '#8f6439'], [1, '#4a2f15']]) +
    lin('rimIn', [[0, '#4a2f15'], [1, '#d0a46c']]) +
    lin('hl', [[0, '#fff', 0.95], [0.45, '#fff', 0], [1, '#fff', 0]]) +
    radial('face', [[0, '#d8ad74'], [1, '#9f7344']], 0.38, 0.32, 0.75) +
    // bloque de arce (madera clara), para que resalte el nogal de la estrella
    lin('panel', [[0, '#f2d6a2'], [1, '#c99558']], 0, 0, 0, 1) +
    lin('panelHl', [[0, '#fff', 0.45], [0.5, '#fff', 0], [1, '#fff', 0]], 0, 0, 0, 1) +
    // estrella de nogal
    lin('star', [[0, '#8a4f2a'], [0.55, '#5e3017'], [1, '#3a1a09']]) +
    lin('starHl', [[0, '#ffd9b0', 0.75], [0.5, '#ffd9b0', 0], [1, '#ffd9b0', 0]]) +
    radial('nail', [[0, '#fff6cf'], [0.45, '#e2b54a'], [1, '#7a5310']], 0.35, 0.3, 0.7) +
    tag('clipPath', { id: 'fc' }, circle(Rf, {})) +
    (small ? '' : tag('clipPath', { id: 'pc' }, tag('rect', { x: r2(x0), y: r2(y0), width: r2(S), height: r2(S), rx: r2(rx) })) +
      tag('clipPath', { id: 'sc' }, tag('polygon', { points: starPts(50, cy, SR, si) }))) +
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
    tex += tag('ellipse', { cx: 39, cy: 77, rx: 3.8, ry: 1.9, fill: 'none', stroke: '#5d3412', 'stroke-width': 0.6, opacity: 0.45 });
    tex += tag('ellipse', { cx: 39, cy: 77, rx: 1.6, ry: 0.8, fill: '#5d3412', opacity: 0.4 });
  }
  tex += crescent(Rf - 1.2, { fill: '#fff', opacity: small ? 0.22 : 0.28 });
  b += tag('g', { 'clip-path': 'url(#fc)' }, tex);

  // bloque del juego (de arce), con el mismo tratamiento que en medal.ts
  b += tag('rect', { x: r2(x0), y: r2(y0 + S * 0.07), width: r2(S), height: r2(S), rx: r2(rx), fill: '#000', opacity: 0.4 });
  b += tag('rect', { x: r2(x0), y: r2(y0), width: r2(S), height: r2(S), rx: r2(rx), fill: 'url(#panel)', stroke: '#6b4220', 'stroke-width': small ? 0.9 : 0.6 });
  if (!small) {
    // veta fina del arce, horizontal (cruzada con la del nogal)
    let g = '';
    for (let i = 0; i < 7; i++) {
      const y = y0 + 3 + i * (S - 6) / 6;
      const k = i % 2 ? 1.1 : -0.9;
      g += tag('path', { d: `M${pt(x0 - 1, y)}C${pt(x0 + S / 3, y - k)} ${pt(x0 + (2 * S) / 3, y + k)} ${pt(x0 + S + 1, y - k * 0.3)}`, fill: 'none', stroke: '#9a6a36', 'stroke-width': 0.4, opacity: 0.35 });
    }
    b += tag('g', { 'clip-path': 'url(#pc)' }, g);
    b += tag('rect', { x: r2(x0 + 0.6), y: r2(y0 + 0.6), width: r2(S - 1.2), height: r2(S - 1.2), rx: r2(rx - 0.6), fill: 'none', stroke: 'url(#panelHl)', 'stroke-width': 0.9 });
    b += tag('rect', { x: r2(x0 + S * 0.14), y: r2(y0 + S * 0.8), width: r2(S * 0.4), height: r2(S * 0.08), rx: r2(S * 0.04), fill: '#fff', opacity: 0.55 });
  }

  // estrella de nogal con un remache en cada punta
  const drop = Math.max(0.7, S * 0.04);
  b += tag('polygon', { points: starPts(50, cy + drop, SR, si), fill: '#000', opacity: 0.45, stroke: '#000', 'stroke-width': r2(S * 0.025), 'stroke-linejoin': 'round' });
  b += tag('polygon', { points: starPts(50, cy, SR, si), fill: 'url(#star)', stroke: '#1e0c02', 'stroke-width': small ? 1.3 : 0.9, 'stroke-linejoin': 'round' });
  if (!small) {
    let g = '';
    for (let i = -4; i <= 4; i++) {
      const x = 50 + i * 2.6;
      const k = (i % 2 ? 0.9 : -0.8) + i * 0.1;
      g += tag('path', { d: `M${pt(x, cy - SR - 1)}C${pt(x + k * 1.5, cy - SR / 3)} ${pt(x - k * 1.3, cy + SR / 4)} ${pt(x + k * 0.4, cy + SR + 1)}`, fill: 'none', stroke: i % 3 === 0 ? '#2a1205' : '#b0703f', 'stroke-width': 0.4, opacity: i % 3 === 0 ? 0.45 : 0.4 });
    }
    b += tag('g', { 'clip-path': 'url(#sc)' }, g);
    b += tag('polygon', { points: starPts(50, cy, SR - 1, si - 0.55), fill: 'none', stroke: 'url(#starHl)', 'stroke-width': 0.8, 'stroke-linejoin': 'round' });
  }
  const rn = small ? 2.3 : 1.55;
  const rr = SR - (small ? 4.1 : 2.9);
  for (let i = 0; i < 5; i++) {
    const [x, y] = polar(rr, -90 + i * 72, 50, cy);
    b += circle(rn, { fill: '#000', opacity: 0.4 }, x, y + 0.5);
    b += circle(rn, { fill: 'url(#nail)', stroke: edge, 'stroke-width': 0.3 }, x, y);
    if (!small) b += circle(rn * 0.32, { fill: '#fff', opacity: 0.8 }, x - rn * 0.3, y - rn * 0.32);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${small ? 28 : 120}" height="${small ? 28 : 120}" viewBox="0 0 100 100">${defs}${b}</svg>`;
}

fs.writeFileSync(`${OUT}/madera-3.svg`, madera(false));
fs.writeFileSync(`${OUT}/madera-3-small.svg`, madera(true));
console.log('ok');
