// Informativo: ΔE (CIE76) entre el texto de la trampa y el color bajo el número, visto por una persona con
// protanopía (matriz de Machado et al. 2009, severidad 1,0, sobre RGB lineal). Es una simulación, no una medición
// con personas. Uso: node simulacion-protan.mjs
const M = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
];
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const gam = (c) => { c = Math.min(1, Math.max(0, c)); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const sim = (h) => { const l = rgb(h).map(lin); return M.map((f) => gam(f[0] * l[0] + f[1] * l[1] + f[2] * l[2])); };
const lab = (c) => {
  const [r, g, b] = c.map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a, b) => { const x = lab(a), y = lab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const normal = (a, b) => dE(rgb(a), rgb(b));
const protan = (a, b) => dE(sim(a), sim(b));
const casos = [
  ['#ff2a2a sobre amarillo Clásica #e5a50a (pos 2)', '#ff2a2a', '#e5a50a'],
  ['#ff2a2a sobre verde Clásica #30a46c (pos 3)', '#ff2a2a', '#30a46c'],
  ['#ff2a2a sobre azul Clásica #0091ff (pos 4)', '#ff2a2a', '#0091ff'],
  ['#ff2a2a sobre fondo #12121a (Contorno puro actual)', '#ff2a2a', '#12121a'],
  ['#4d101a sobre fondo #12121a (rojo oscuro)', '#4d101a', '#12121a'],
  ['#8a2030 sobre fondo #12121a', '#8a2030', '#12121a'],
  ['#ff2a2a sobre efectivo Contorno 55 % pos 2 #94740c', '#ff2a2a', '#94740c'],
];
for (const [n, a, b] of casos) console.log(n.padEnd(58), 'normal', normal(a, b).toFixed(1).padStart(6), ' protanopía', protan(a, b).toFixed(1).padStart(6));
