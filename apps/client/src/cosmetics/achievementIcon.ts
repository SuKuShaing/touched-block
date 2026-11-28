import type { AchievementId } from '@tb/engine';

/**
 * Iconos de los logros (CAMBIO-011): una medalla hexagonal (punta arriba y abajo) con el símbolo
 * del logro dentro, en los siete materiales más el estado vacío. Son dibujos propios, para que no
 * se confundan con las insignias (`medal.ts`). racha → rayo, partidas → play, diasReto →
 * calendario con llama, mejorReto → diana con flecha.
 *
 * Es el puerto de `config_logros/herramientas/gen-logros.js` (guía: `config_logros/ESTILO_LOGROS.md`)
 * y su salida es la de `config_logros/logros_iconos/*.svg`, salvo `width`/`height` (el test lo
 * comprueba). Devuelve texto SVG: la web lo usa como `<img>` y la app con `SvgXml`
 * (`components/AchievementImage.*`). Sin `transform` ni `filter` (solo `clipPath`); los ids de
 * degradados y recortes llevan el prefijo "<logro>-<material>-".
 */

const MATERIALS = ['papel', 'carton', 'madera', 'bronce', 'plata', 'oro', 'diamante'] as const;
type Material = (typeof MATERIALS)[number];

type Point = [number, number];
type Attrs = Record<string, string | number>;
type StopDef = [offset: number, color: string, opacity?: number];

/** Tonos del símbolo: `sym` (arriba, abajo), `light` (anillas, flecha) y `edge` (contorno). */
interface Palette {
  sym: [string, string];
  light: [string, string];
  edge: string;
}

interface Ctx {
  u: (name: string) => string;
  ref: (name: string) => string;
  pal: Palette;
  empty: boolean;
  defs: string;
  /** Corrimiento de la sombra dura del símbolo. */
  sh: number;
}

// ---------------------------------------------------------------- utilidades

const r2 = (x: number) => Math.round(x * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)},${r2(y)}`;
const rad = (d: number) => (d * Math.PI) / 180;
const polar = (r: number, deg: number, cx = 50, cy = 50): Point => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
const attrs = (a: Attrs) =>
  Object.entries(a)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
const tag = (t: string, a: Attrs, c?: string) => (c ? `<${t}${attrs(a)}>${c}</${t}>` : `<${t}${attrs(a)}/>`);
const stops = (s: StopDef[]) =>
  s.map(([o, c, op]) => tag('stop', op === undefined ? { offset: o, 'stop-color': c } : { offset: o, 'stop-color': c, 'stop-opacity': op })).join('');
const lin = (id: string, s: StopDef[], x1 = 0, y1 = 0, x2 = 1, y2 = 1) => tag('linearGradient', { id, x1, y1, x2, y2 }, stops(s));
const radial = (id: string, s: StopDef[], cx = 0.5, cy = 0.5, r = 0.5) => tag('radialGradient', { id, cx, cy, r }, stops(s));
const circle = (r: number, a: Attrs, cx = 50, cy = 50) => tag('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), ...a });
/** Degradado del aro de brillo (arriba a la izquierda). */
const highlight = (id: string) =>
  lin(id, [
    [0, '#fff', 0.95],
    [0.45, '#fff', 0],
    [1, '#fff', 0],
  ]);

/** Destello de cuatro puntas. */
function sparkle(cx: number, cy: number, s: number, a: Attrs): string {
  const k = s * 0.14;
  const d = `M${pt(cx, cy - s)}Q${pt(cx + k, cy - k)} ${pt(cx + s, cy)}Q${pt(cx + k, cy + k)} ${pt(cx, cy + s)}Q${pt(cx - k, cy + k)} ${pt(cx - s, cy)}Q${pt(cx - k, cy - k)} ${pt(cx, cy - s)}Z`;
  return tag('path', { d, ...a });
}

/** Brillo en forma de medialuna arriba a la izquierda. */
function crescent(r: number, a: Attrs): string {
  const [x1, y1] = polar(r, 192);
  const [x2, y2] = polar(r, 292);
  return tag('path', { d: `M${pt(x1, y1)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(x2, y2)}A${r2(r * 1.3)} ${r2(r * 1.3)} 0 0 0 ${pt(x1, y1)}Z`, ...a });
}

/** Rombo (gema de Oro) con distancia d del centro a cada punta. */
const rhombus = (cx: number, cy: number, d: number) => `${pt(cx, cy - d)} ${pt(cx + d, cy)} ${pt(cx, cy + d)} ${pt(cx - d, cy)}`;

/** Hoja de laurel desde (bx, by) hacia el ángulo `dir`, de largo L y medio ancho w. */
function leaf(bx: number, by: number, dir: number, L: number, w: number, a: Attrs): string {
  const ux = Math.cos(rad(dir));
  const uy = Math.sin(rad(dir));
  const tx = bx + ux * L;
  const ty = by + uy * L;
  const mx = bx + ux * L * 0.45;
  const my = by + uy * L * 0.45;
  const k = w * 1.9;
  return tag('path', { d: `M${pt(bx, by)}Q${pt(mx - uy * k, my + ux * k)} ${pt(tx, ty)}Q${pt(mx + uy * k, my - ux * k)} ${pt(bx, by)}Z`, ...a });
}

/** Rama de laurel sobre un arco de radio r (lado izquierdo, de abajo hacia arriba; el derecho es su reflejo). */
function branch(side: -1 | 1, r: number, from: number, to: number, count: number, L: number, w: number, leafA: Attrs, stem: string): string {
  const ang = (u: number) => {
    const t = from + (to - from) * u;
    return side < 0 ? t : 180 - t;
  };
  const [sx, sy] = polar(r, ang(0));
  const [ex, ey] = polar(r, ang(1));
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  let o = tag('path', {
    d: `M${pt(sx, sy)}A${r2(r)} ${r2(r)} 0 ${large} ${side < 0 ? 1 : 0} ${pt(ex, ey)}`,
    fill: 'none',
    stroke: stem,
    'stroke-width': 1.1,
    'stroke-linecap': 'round',
  });
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const th = ang(u);
    const dir = side < 0 ? th + 90 : th - 90;
    const s = 1 - 0.32 * u;
    const [x, y] = polar(r, th);
    if (i === count - 1) {
      o += leaf(x, y, dir, L * s, w * s, leafA);
      break;
    }
    o += leaf(x, y, dir + (side < 0 ? -32 : 32), L * s, w * s, leafA);
    o += leaf(x, y, dir + (side < 0 ? 34 : -34), L * s * 0.9, w * s * 0.9, leafA);
  }
  return o;
}

// ---------------------------------------------------------------- geometría
// Los trazados de los símbolos usan solo pares "x,y" (M, L, Q, C, Z) para escalarlos y correrlos sin `transform`.

const PAIR = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
const mapPath = (d: string, f: (x: number, y: number) => Point) => d.replace(PAIR, (_, x: string, y: string) => pt(...f(Number(x), Number(y))));
const shift = (d: string, dx: number, dy: number) => mapPath(d, (x, y) => [x + dx, y + dy]);

/** Polígono con las esquinas redondeadas (radio r). */
function roundPoly(P: Point[], r: number): string {
  let d = '';
  const n = P.length;
  P.forEach((p, i) => {
    const toward = (Q: Point): Point => {
      const L = Math.hypot(Q[0] - p[0], Q[1] - p[1]);
      const k = Math.min(r / L, 0.5);
      return [p[0] + (Q[0] - p[0]) * k, p[1] + (Q[1] - p[1]) * k];
    };
    const a = toward(P[(i + n - 1) % n]);
    const b = toward(P[(i + 1) % n]);
    d += `${i ? 'L' : 'M'}${pt(...a)}Q${pt(...p)} ${pt(...b)}`;
  });
  return d + 'Z';
}
const roundRect = (x: number, y: number, w: number, h: number, r: number) =>
  roundPoly(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    r,
  );

// Hexágono con una punta arriba y otra abajo; R = radio hasta el vértice.
const hexV = (R: number, cy = 50): Point[] => Array.from({ length: 6 }, (_, i) => polar(R, -90 + 60 * i, 50, cy));
const hexD = (R: number, rr = 0, cy = 50) => {
  const V = hexV(R, cy);
  return rr ? roundPoly(V, rr) : `M${V.map((p) => pt(...p)).join('L')}Z`;
};
/** Punto del lado `e` (0–5) a la fracción `f` (0–1) de su largo. */
function hexEdge(R: number, e: number, f: number): Point {
  const V = hexV(R);
  const a = V[e];
  const b = V[(e + 1) % 6];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
/** Ángulo (grados) de la normal que sale del lado `e`. */
const hexNormal = (e: number) => -60 + 60 * e;

// ---------------------------------------------------------------- símbolos
// Cada símbolo se diseña en un lienzo de 100×100 y se coloca con `k` (escala) y `ox, oy` (corrimiento)
// desde el centro. La escala final depende además del tamaño de la cara de cada medalla (`Rf / 38`).

const BOLT: Point[] = [
  [56, 3],
  [80, 3],
  [62, 36],
  [84, 36],
  [30, 97],
  [43, 58],
  [19, 58],
];
const FLAME_OUT = 'M50,42C55,49 63,54 63,66C63,75 57,81 50,81C43,81 37,75 37,67C37,60 41,56 44,51C45,56 47,58 49,59C48,53 47,47 50,42Z';
const FLAME_IN = 'M50,58C54,63 57,66 57,71C57,76 54,79 50,79C46,79 43,76 43,72C43,68 46,65 47,62C48,65 49,66 50,66C49,63 49,61 50,58Z';
/** Diana: anillas y flecha desde el centro hasta la cola. */
const TARGET: { cx: number; cy: number; rings: number[]; tail: Point } = { cx: 44, cy: 58, rings: [37, 27, 17, 9], tail: [84, 18] };

const SYMBOLS: Record<AchievementId, { k: number; ox: number; oy: number }> = {
  racha: { k: 0.55, ox: 0, oy: 0 },
  partidas: { k: 0.58, ox: 0, oy: 0 },
  diasReto: { k: 0.62, ox: 0, oy: 0 },
  mejorReto: { k: 0.58, ox: -2.5, oy: 1 },
};

/** Coloca un símbolo: escala `k · rel` alrededor de (50, 50) y corre `ox, oy` (también escalados). */
function placement(id: AchievementId, rel: number) {
  const S = SYMBOLS[id];
  const k = S.k * rel;
  const ox = S.ox * rel;
  const oy = S.oy * rel;
  const p = (x: number, y: number): Point => [50 + (x - 50) * k + ox, 50 + (y - 50) * k + oy];
  return { k, p, d: (d: string) => mapPath(d, p), s: (v: number) => v * k };
}

interface Raised {
  sw?: number;
  hl?: number;
  emptyFill?: string;
}

/** Piezas del símbolo, en el orden en que se dibujan: lo de atrás, la sombra dura y el cuerpo. */
function symbol(id: AchievementId, c: Ctx, T: ReturnType<typeof placement>) {
  const sh = c.sh;
  const out = { back: '', shadow: '', body: '' };
  const shadow = (d: string) => {
    if (!c.empty) out.shadow += tag('path', { d: shift(d, 0, sh), fill: '#000', opacity: 0.42, 'stroke-linejoin': 'round' });
  };
  let nClip = 0;
  /** Pieza en relieve: fondo en degradado, contorno oscuro y brillo del borde por dentro. */
  const raised = (d: string, fill: string, o: Raised = {}) => {
    if (c.empty) return tag('path', { d, fill: o.emptyFill || '#30304a', stroke: '#5a5a7c', 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    const cid = c.u(`s${nClip++}`);
    c.defs += tag('clipPath', { id: cid }, tag('path', { d }));
    return (
      tag('path', { d, fill, stroke: c.pal.edge, 'stroke-width': o.sw || 0.7, 'stroke-opacity': 0.9, 'stroke-linejoin': 'round' }) +
      tag('g', { 'clip-path': `url(#${cid})` }, tag('path', { d, fill: 'none', stroke: c.ref('symHl'), 'stroke-width': o.hl || 2.2 }))
    );
  };

  if (id === 'racha') {
    // rayo: resplandor y anillo de energía detrás, bisel en dos facetas, brillo especular y chispas
    const d = T.d(roundPoly(BOLT, 3.2));
    const [bx, by] = T.p(50, 50);
    const ringR = T.s(41);
    const sparks: [number, number, number][] = [
      [21, 27, 10],
      [81, 80, 7.6],
      [15, 74, 5.2],
    ];
    const spark = (x: number, y: number, s: number) => {
      const [sx, sy] = T.p(x, y);
      return c.empty
        ? sparkle(sx, sy, T.s(s), { fill: 'none', stroke: '#5a5a7c', 'stroke-width': 0.8, 'stroke-linejoin': 'round' })
        : sparkle(sx, sy, T.s(s), { fill: '#ffd23a', stroke: '#7a2008', 'stroke-width': 0.5, 'stroke-linejoin': 'round' });
    };
    if (c.empty) {
      out.back += circle(ringR, { fill: 'none', stroke: '#3c3c58', 'stroke-width': 1, 'stroke-dasharray': '4 2.4' }, bx, by);
      out.body += raised(d, '#30304a');
      out.body += tag('path', { d: T.d('M68,3L52,46L30,97'), fill: 'none', stroke: '#5a5a7c', 'stroke-width': 0.8, 'stroke-linejoin': 'round' });
      sparks.forEach(([x, y, s]) => (out.body += spark(x, y, s)));
    } else {
      c.defs += radial(c.u('boltGlow'), [
        [0, '#ffe27c', 0.55],
        [0.6, '#ffd23a', 0.18],
        [1, '#ffd23a', 0],
      ]);
      out.back += circle(T.s(46), { fill: c.ref('boltGlow') }, bx, by);
      out.back += circle(ringR, { fill: 'none', stroke: c.pal.sym[0], 'stroke-width': 1.5, 'stroke-dasharray': '7 3.6', opacity: 0.6 }, bx, by);
      shadow(d);
      const cid = c.u('bolt');
      c.defs += tag('clipPath', { id: cid }, tag('path', { d }));
      out.body += tag('path', { d, fill: c.ref('sym'), stroke: c.pal.edge, 'stroke-width': 0.8, 'stroke-opacity': 0.9, 'stroke-linejoin': 'round' });
      const facetL = T.d('M-10,-10L68,-10L68,3L52,46L30,97L26,115L-10,115Z');
      const facetR = T.d('M68,-10L110,-10L110,115L26,115L30,97L52,46L68,3Z');
      const ridge = T.d('M68,3L52,46L30,97');
      const spec = T.d('M64,9L56,25');
      const [dx, dy] = T.p(57, 33);
      out.body += tag(
        'g',
        { 'clip-path': `url(#${cid})` },
        tag('path', { d: facetL, fill: '#fff', opacity: 0.17 }) +
          tag('path', { d: facetR, fill: '#000', opacity: 0.24 }) +
          tag('path', { d: ridge, fill: 'none', stroke: '#fff', 'stroke-width': 0.7, opacity: 0.5, 'stroke-linejoin': 'round' }) +
          tag('path', { d, fill: 'none', stroke: c.ref('symHl'), 'stroke-width': 2.2 }),
      );
      // brillo especular arriba a la izquierda
      out.body += tag('path', { d: spec, fill: 'none', stroke: '#fff', 'stroke-width': r2(T.s(3)), 'stroke-linecap': 'round', opacity: 0.85 });
      out.body += circle(T.s(1.7), { fill: '#fff', opacity: 0.8 }, dx, dy);
      sparks.forEach(([x, y, s]) => (out.body += spark(x, y, s)));
    }
  } else if (id === 'partidas') {
    // botón de reproducir: disco con bisel y el triángulo en relieve, de tres facetas, con un destello
    const [bx, by] = T.p(50, 50);
    const R1 = T.s(46);
    const R2 = T.s(41.6);
    const R3 = T.s(39);
    const tri = T.d(
      roundPoly(
        [
          [33, 22],
          [80, 50],
          [33, 78],
        ],
        7,
      ),
    );
    const A = T.p(33, 22);
    const B = T.p(80, 50);
    const C = T.p(33, 78);
    const O = T.p(45, 50);
    const poly = (...P: Point[]) => P.map((p) => pt(...p)).join(' ');
    // brillo de vidrio: medialuna arriba a la izquierda del fondo
    const glass = (r: number) => {
      const [x1, y1] = polar(r, 196, bx, by);
      const [x2, y2] = polar(r, 288, bx, by);
      return `M${pt(x1, y1)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(x2, y2)}A${r2(r * 1.32)} ${r2(r * 1.32)} 0 0 0 ${pt(x1, y1)}Z`;
    };
    if (c.empty) {
      out.body += circle(R1, { fill: '#30304a', stroke: '#5a5a7c', 'stroke-width': 1.1 }, bx, by);
      out.body += circle(R3, { fill: '#222234', stroke: '#3c3c58', 'stroke-width': 0.8 }, bx, by);
      out.body += tag('path', { d: tri, fill: '#42425e', stroke: '#5a5a7c', 'stroke-width': 1, 'stroke-linejoin': 'round' });
      out.body += sparkle(...polar(R1 * 0.86, 225, bx, by), T.s(5), { fill: 'none', stroke: '#5a5a7c', 'stroke-width': 0.7, 'stroke-linejoin': 'round' });
    } else {
      c.defs += lin(
        c.u('sunk'),
        [
          [0, c.pal.edge],
          [1, c.pal.sym[1]],
        ],
        0,
        0,
        0,
        1,
      );
      out.shadow += circle(R1, { fill: '#000', opacity: 0.42 }, bx, by + sh);
      out.body += circle(R1, { fill: c.ref('sym'), stroke: c.pal.edge, 'stroke-width': 0.8, 'stroke-opacity': 0.9 }, bx, by);
      out.body += circle(R1 - 1.1, { fill: 'none', stroke: c.ref('symHl'), 'stroke-width': 1.6 }, bx, by);
      out.body += circle(R2, { fill: 'none', stroke: c.pal.light[0], 'stroke-width': 0.6, opacity: 0.55 }, bx, by);
      out.body += circle(R3, { fill: c.ref('sunk'), stroke: c.pal.edge, 'stroke-width': 0.7, 'stroke-opacity': 0.9 }, bx, by);
      out.body += tag('path', { d: glass(R3 - 1.2), fill: '#fff', opacity: 0.2 });
      // triángulo: sombra, tres facetas y contorno
      out.body += tag('path', { d: shift(tri, 0, sh * 0.8), fill: '#000', opacity: 0.5, 'stroke-linejoin': 'round' });
      const cid = c.u('tri');
      c.defs += tag('clipPath', { id: cid }, tag('path', { d: tri }));
      out.body += tag('path', { d: tri, fill: c.ref('light'), stroke: c.pal.edge, 'stroke-width': 0.6, 'stroke-linejoin': 'round' });
      out.body += tag(
        'g',
        { 'clip-path': `url(#${cid})` },
        tag('polygon', { points: poly(A, B, O), fill: '#fff', opacity: 0.35 }) +
          tag('polygon', { points: poly(B, C, O), fill: '#000', opacity: 0.3 }) +
          tag('polygon', { points: poly(C, A, O), fill: '#000', opacity: 0.12 }) +
          tag('path', { d: tri, fill: 'none', stroke: c.ref('symHl'), 'stroke-width': 1.6 }),
      );
      out.body += sparkle(...polar(R1 * 0.84, 225, bx, by), T.s(6.5), { fill: '#fff', opacity: 0.92 });
    }
  } else if (id === 'diasReto') {
    // calendario: cuerpo, cabecera, dos anillas claras y la llama encima
    const body = T.d(roundRect(14, 24, 72, 62, 9));
    const head = T.d('M23,24L77,24Q86,24 86,33L86,42L14,42L14,33Q14,24 23,24Z');
    const pins = [T.d(roundRect(29, 11, 9, 19, 4)), T.d(roundRect(62, 11, 9, 19, 4))];
    shadow(body);
    pins.forEach(shadow);
    out.body += raised(body, c.ref('sym'));
    out.body += raised(head, c.ref('symD'), { hl: 1.6, emptyFill: '#282840' });
    if (!c.empty)
      out.body += tag('path', { d: T.d('M14,42L86,42'), fill: 'none', stroke: c.ref('light'), 'stroke-width': r2(T.s(2.4)), opacity: 0.6, 'stroke-linecap': 'round' });
    pins.forEach((p) => (out.body += raised(p, c.ref('light'), { hl: 1.4, emptyFill: '#3c3c58' })));
    // la llama se baja para que quepa bajo la cabecera
    const flame = (d: string) => T.d(mapPath(d, (x, y) => [x, 64.5 + (y - 61.5)]));
    const f1 = flame(FLAME_OUT);
    const f2 = flame(FLAME_IN);
    if (c.empty) {
      out.body += tag('path', { d: f1, fill: '#42425e', stroke: '#5a5a7c', 'stroke-width': 0.8, 'stroke-linejoin': 'round' });
    } else {
      out.body += tag('path', { d: f1, fill: c.ref('flame'), stroke: '#7a2008', 'stroke-width': 0.6, 'stroke-linejoin': 'round' });
      out.body += tag('path', { d: f2, fill: c.ref('flameIn') });
    }
  } else {
    // diana (4 anillas) con una flecha clavada en el centro y dos plumas en la cola
    const [cx, cy] = T.p(TARGET.cx, TARGET.cy);
    const rr = TARGET.rings.map((r) => T.s(r));
    const [tx, ty] = T.p(...TARGET.tail);
    // ejes de la flecha: u hacia la cola, v perpendicular
    const L = Math.hypot(tx - cx, ty - cy);
    const ux = (tx - cx) / L;
    const uy = (ty - cy) / L;
    const vx = -uy;
    const vy = ux;
    const at = (s: number, t: number) => pt(tx + s * T.k * ux + t * T.k * vx, ty + s * T.k * uy + t * T.k * vy);
    const feather = (sg: number) => `M${at(-20, sg * 3.8)}L${at(-3, sg * 3.8)}L${at(8, sg * 14.5)}L${at(-9, sg * 14.5)}Z`;
    if (!c.empty) out.shadow += circle(rr[0], { fill: '#000', opacity: 0.42 }, cx, cy + sh);
    const ringFill = c.empty ? ['#30304a', '#1f1f2e', '#30304a', '#42425e'] : [c.ref('sym'), c.ref('light'), c.ref('sym'), c.ref('acc')];
    const ringLine: Attrs = c.empty ? { stroke: '#5a5a7c', 'stroke-width': 0.9 } : { stroke: c.pal.edge, 'stroke-width': 0.6, 'stroke-opacity': 0.9 };
    rr.forEach((r, i) => (out.body += circle(r, { fill: ringFill[i], ...ringLine }, cx, cy)));
    if (!c.empty) out.body += circle(rr[0] - 1.3, { fill: 'none', stroke: c.ref('symHl'), 'stroke-width': 1.4 }, cx, cy);
    const shaftW = T.s(8.6);
    const shaft = (w: number, color: string) =>
      tag('line', { x1: r2(cx), y1: r2(cy), x2: r2(tx), y2: r2(ty), stroke: color, 'stroke-width': r2(w), 'stroke-linecap': 'round' });
    if (c.empty) {
      out.body += shaft(shaftW + 1.6, '#5a5a7c') + shaft(shaftW, '#42425e');
      out.body += tag('path', { d: feather(1) + feather(-1), fill: '#42425e', stroke: '#5a5a7c', 'stroke-width': 1, 'stroke-linejoin': 'round' });
    } else {
      out.body += shaft(shaftW + 1.5, c.pal.edge) + shaft(shaftW, c.pal.light[0]);
      out.body += tag('path', { d: feather(1) + feather(-1), fill: c.ref('acc'), stroke: '#7a2008', 'stroke-width': 0.7, 'stroke-linejoin': 'round' });
    }
  }
  return out;
}

// ---------------------------------------------------------------- materiales
// Papel, Cartón y Madera con los colores de las insignias nuevas; Bronce a Diamante, los de `medal.ts`.

const PAL: Record<Material, Palette> = {
  papel: { sym: ['#5d84b8', '#34557f'], light: ['#ffffff', '#dfe8f3'], edge: '#1d3c66' },
  carton: { sym: ['#7a5230', '#4a2f14'], light: ['#f6e2bd', '#d9b47a'], edge: '#2c1a09' },
  madera: { sym: ['#8a4f2a', '#3a1a09'], light: ['#f2d6a2', '#c99558'], edge: '#1e0c02' },
  bronce: { sym: ['#7d3f14', '#47200a'], light: ['#fff0dc', '#f7b67a'], edge: '#2a1103' },
  plata: { sym: ['#43526e', '#222c42'], light: ['#ffffff', '#c5cfdc'], edge: '#141a28' },
  oro: { sym: ['#1f93ff', '#0a4aa8'], light: ['#fff8cf', '#ffc22e'], edge: '#06306b' },
  diamante: { sym: ['#1d6fb5', '#0a3866'], light: ['#ffffff', '#bfeaff'], edge: '#06203d' },
};

/** Degradados del símbolo (todos de arriba hacia abajo). */
function symbolDefs(c: Ctx) {
  const { u, pal } = c;
  const down = (name: string, s: StopDef[]) => lin(u(name), s, 0, 0, 0, 1);
  const two = (name: string, a: string, b: string) =>
    down(name, [
      [0, a],
      [1, b],
    ]);
  c.defs +=
    two('sym', pal.sym[0], pal.sym[1]) +
    two('symD', pal.sym[1], pal.edge) +
    two('light', pal.light[0], pal.light[1]) +
    down('symHl', [
      [0, '#fff', 0.6],
      [0.5, '#fff', 0],
      [1, '#fff', 0],
    ]) +
    two('acc', '#ff8a4a', '#d93a12') +
    down('flame', [
      [0, '#ffc23a'],
      [0.55, '#ff7a1a'],
      [1, '#d93a12'],
    ]) +
    two('flameIn', '#fffbe0', '#ffd23a');
}

interface Medal {
  /** Radio de la cara: el símbolo escala con él. */
  Rf: number;
  back?: string;
  body: string;
  front?: string;
}

interface MetalOptions {
  R: number;
  Rf: number;
  edge: string;
  rim: [string, string, string];
  /** `radial`: centro y borde (papel, cartón, madera); si no, bandas de luz en diagonal. */
  face: { radial?: boolean; colors: string[] };
  outer?: (dy: number) => string;
  rimDetail?: string;
  reeding?: number;
  tex: string;
}

/** Medalla hexagonal (Papel a Oro): sombra, canto, borde hundido, cara y textura. */
function medalBody(c: Ctx, o: MetalOptions): string {
  const { u, ref } = c;
  const { R, Rf, edge } = o;
  const outer = o.outer ?? ((dy: number) => hexD(R, 4.2, 50 + dy));
  c.defs +=
    lin(u('rim'), [
      [0, o.rim[0]],
      [0.5, o.rim[1]],
      [1, o.rim[2]],
    ]) +
    lin(u('rimIn'), [
      [0, o.rim[2]],
      [1, o.rim[0]],
    ]) +
    highlight(u('hl')) +
    (o.face.radial
      ? radial(
          u('face'),
          [
            [0, o.face.colors[0]],
            [1, o.face.colors[1]],
          ],
          0.38,
          0.32,
          0.75,
        )
      : lin(
          u('face'),
          o.face.colors.map((col, i): StopDef => [[0, 0.3, 0.55, 0.8, 1][i], col]),
        )) +
    tag('clipPath', { id: u('fc') }, tag('path', { d: hexD(Rf, 3.2) }));
  let b = tag('path', { d: outer(Math.max(2, R * 0.07)), fill: '#000', opacity: 0.42, 'stroke-linejoin': 'round' });
  b += tag('path', { d: outer(0), fill: ref('rim'), stroke: edge, 'stroke-width': 0.7, 'stroke-opacity': 0.85, 'stroke-linejoin': 'round' });
  b += o.rimDetail ?? '';
  if (o.reeding) {
    // canto estriado, como una moneda
    for (let e = 0; e < 6; e++) {
      for (let k = 0; k < o.reeding; k++) {
        const f = (k + 0.5) / o.reeding;
        const [x1, y1] = hexEdge(Rf + 2.9, e, f);
        const [x2, y2] = hexEdge(R - 2, e, f);
        b += tag('line', { x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke: edge, 'stroke-width': 0.55, opacity: 0.28 });
      }
    }
  }
  b += tag('path', { d: hexD(R - 1.9, 3.6), fill: 'none', stroke: ref('hl'), 'stroke-width': 1.3 });
  b += tag('path', { d: hexD(Rf + 2.1, 3.4), fill: ref('rimIn') });
  b += tag('path', { d: hexD(Rf, 3.2), fill: ref('face') });
  b += tag('g', { 'clip-path': ref('fc') }, o.tex + crescent(Rf - 1.2, { fill: '#fff', opacity: 0.28 }));
  return b;
}

/** Reflejos en diagonal de la cara de metal liso. */
const shineTex = () =>
  tag('polygon', { points: `${pt(18, 64)} ${pt(64, 18)} ${pt(74, 26)} ${pt(26, 74)}`, fill: '#fff', opacity: 0.13 }) +
  tag('polygon', { points: `${pt(33, 86)} ${pt(86, 33)} ${pt(89, 37)} ${pt(37, 89)}`, fill: '#fff', opacity: 0.1 });

/** Radio (hasta el vértice) y de la cara en las medallas sin adornos: Papel, Cartón, Madera, Bronce. */
const R_BASE = 46.5;
const RF_BASE = 38;

const MEDALS: Record<Material, (c: Ctx) => Medal> = {
  papel: (c) => {
    const R = R_BASE;
    const Rf = RF_BASE;
    const n = 5;
    const depth = 2.8;
    // borde plisado: 5 dientes de sierra por lado (los vértices son puntas), como un pirotín
    const zig = (dy: number) => {
      const p: string[] = [];
      for (let e = 0; e < 6; e++) {
        for (let k = 0; k < 2 * n; k++) {
          const [x, y] = hexEdge(R, e, k / (2 * n));
          const a = rad(hexNormal(e));
          p.push(k % 2 ? pt(x - depth * Math.cos(a), y - depth * Math.sin(a) + dy) : pt(x, y + dy));
        }
      }
      return `M${p.join('L')}Z`;
    };
    let pleats = '';
    for (let e = 0; e < 6; e++) {
      for (let k = 1; k < 2 * n; k += 2) {
        const f = k / (2 * n);
        const [x1, y1] = hexEdge(Rf + 3, e, f);
        const [x2, y2] = hexEdge(R - depth - 0.6, e, f);
        pleats += tag('line', { x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke: '#6b5a3c', 'stroke-width': 0.45, opacity: 0.24 });
      }
    }
    // hoja de cuaderno: renglones azules y margen rojo
    let tex = '';
    for (let y = 50 - Rf + 5; y < 50 + Rf; y += 5.6) tex += tag('line', { x1: 8, y1: r2(y), x2: 92, y2: r2(y), stroke: '#7ea6dd', 'stroke-width': 0.5, opacity: 0.65 });
    tex += tag('line', { x1: 24, y1: 8, x2: 24, y2: 92, stroke: '#e26464', 'stroke-width': 0.6, opacity: 0.55 });
    return {
      Rf,
      body: medalBody(c, {
        R,
        Rf,
        edge: '#6b5a3c',
        rim: ['#ffffff', '#ece2cb', '#a8946f'],
        face: { radial: true, colors: ['#fffdf7', '#e9dec4'] },
        outer: zig,
        rimDetail: pleats,
        tex,
      }),
    };
  },
  carton: (c) => {
    const R = R_BASE;
    const Rf = RF_BASE;
    const edge = '#3f2a12';
    // canto corrugado: una onda entre las dos capas, a lo largo del hexágono
    const rc = (R + Rf) / 2 + 0.5;
    const waves = 6;
    const amp = 2.1;
    const per = waves * 8;
    let w = '';
    for (let e = 0; e < 6; e++) {
      for (let i = 0; i < per; i++) {
        const f = i / per;
        const [x, y] = hexEdge(rc, e, f);
        const a = rad(hexNormal(e));
        const off = amp * Math.sin(2 * Math.PI * waves * f);
        w += (e || i ? 'L' : 'M') + pt(x + off * Math.cos(a), y + off * Math.sin(a));
      }
    }
    let rimDetail = tag('path', { d: w + 'Z', fill: 'none', stroke: edge, 'stroke-width': 0.8, opacity: 0.55, 'stroke-linejoin': 'round' });
    rimDetail += tag('path', { d: hexD(rc + amp + 0.9, 3.8), fill: 'none', stroke: edge, 'stroke-width': 0.5, opacity: 0.4 });
    rimDetail += tag('path', { d: hexD(rc - amp - 0.9, 3.6), fill: 'none', stroke: edge, 'stroke-width': 0.5, opacity: 0.4 });
    // fibras del kraft (con semilla fija, siempre iguales) y canaletas suaves
    let tex = '';
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 48; i++) {
      const x = 14 + rnd() * 72;
      const y = 14 + rnd() * 72;
      if (rnd() < 0.5) tex += circle(0.35 + rnd() * 0.4, { fill: '#5a3a16', opacity: 0.35 }, x, y);
      else {
        const a = rnd() * 180;
        const l = 1.2 + rnd() * 1.8;
        tex += tag('line', { x1: r2(x), y1: r2(y), x2: r2(x + l * Math.cos(rad(a))), y2: r2(y + l * Math.sin(rad(a))), stroke: '#5a3a16', 'stroke-width': 0.35, opacity: 0.3 });
      }
    }
    for (let x = 50 - Rf + 3; x < 50 + Rf; x += 5) tex += tag('line', { x1: r2(x), y1: 8, x2: r2(x), y2: 92, stroke: '#7a5528', 'stroke-width': 1.6, opacity: 0.1 });
    return {
      Rf,
      body: medalBody(c, { R, Rf, edge, rim: ['#ecd3a4', '#b78d58', '#6a4a25'], face: { radial: true, colors: ['#d9bb88', '#ad8754'] }, rimDetail, tex }),
    };
  },
  madera: (c) => {
    const R = R_BASE;
    const Rf = RF_BASE;
    const edge = '#2e1706';
    let rimDetail = tag('path', { d: hexD((R + Rf) / 2 + 1.3, 3.8), fill: 'none', stroke: edge, 'stroke-width': 0.5, opacity: 0.3 });
    rimDetail += tag('path', { d: hexD((R + Rf) / 2 - 1.3, 3.6), fill: 'none', stroke: edge, 'stroke-width': 0.4, opacity: 0.22 });
    // veta en curvas suaves y un nudo
    let tex = '';
    for (let i = -4; i <= 4; i++) {
      const y = 50 + i * Rf * 0.23;
      const w = (i % 2 ? 2.2 : -1.8) + i * 0.3;
      tex += tag('path', {
        d: `M${pt(50 - Rf - 2, y)}C${pt(50 - Rf / 3, y - w * 1.6)} ${pt(50 + Rf / 4, y + w * 1.4)} ${pt(50 + Rf + 2, y - w * 0.4)}`,
        fill: 'none',
        stroke: '#5d3412',
        'stroke-width': i % 2 ? 0.7 : 0.5,
        opacity: 0.38,
      });
    }
    tex += tag('ellipse', { cx: 31, cy: 64, rx: 3.6, ry: 1.8, fill: 'none', stroke: '#5d3412', 'stroke-width': 0.6, opacity: 0.45 });
    tex += tag('ellipse', { cx: 31, cy: 64, rx: 1.5, ry: 0.75, fill: '#5d3412', opacity: 0.4 });
    c.defs += radial(
      c.u('nail'),
      [
        [0, '#fff6cf'],
        [0.45, '#e2b54a'],
        [1, '#7a5310'],
      ],
      0.35,
      0.3,
      0.7,
    );
    // remaches de latón: uno en cada esquina del canto
    let front = '';
    const rn = (R - Rf) * 0.34;
    for (let i = 0; i < 6; i++) {
      const [x, y] = polar((R + Rf) / 2 + 0.5, -90 + 60 * i);
      front += circle(rn, { fill: '#000', opacity: 0.4 }, x, y + 0.7);
      front += circle(rn, { fill: c.ref('nail'), stroke: edge, 'stroke-width': 0.4 }, x, y);
      front += circle(rn * 0.32, { fill: '#fff', opacity: 0.8 }, x - rn * 0.3, y - rn * 0.34);
    }
    return {
      Rf,
      front,
      body: medalBody(c, { R, Rf, edge, rim: ['#d0a46c', '#8f6439', '#4a2f15'], face: { radial: true, colors: ['#d8ad74', '#9f7344'] }, rimDetail, tex }),
    };
  },
  bronce: (c) => ({
    Rf: RF_BASE,
    body: medalBody(c, {
      R: R_BASE,
      Rf: RF_BASE,
      edge: '#3d1a04',
      reeding: 8,
      rim: ['#ffc8a0', '#bf622b', '#56220a'],
      face: { colors: ['#ffc193', '#cd6f36', '#f3a66f', '#9a4718', '#c96b32'] },
      tex: shineTex(),
    }),
  }),
  plata: (c) => {
    const R = 38.5;
    const Rf = 32;
    const edge = '#2c3340';
    c.defs += lin(c.u('leaf'), [
      [0, '#ffffff'],
      [0.55, '#bcc6d3'],
      [1, '#5f6b7c'],
    ]);
    const la = { fill: c.ref('leaf'), stroke: edge, 'stroke-width': 0.45, 'stroke-opacity': 0.6 };
    const back = branch(-1, 42.5, 112, 202, 6, 10, 2.9, la, '#5f6b7c') + branch(1, 42.5, 112, 202, 6, 10, 2.9, la, '#5f6b7c');
    const front = sparkle(50 - Rf * 0.55, 50 - Rf * 0.66, 3.4, { fill: '#fff', opacity: 0.95 });
    return {
      Rf,
      back,
      front,
      body: medalBody(c, {
        R,
        Rf,
        edge,
        reeding: 8,
        rim: ['#ffffff', '#a9b3c2', '#4f5a6a'],
        face: { colors: ['#ffffff', '#bcc5d1', '#f1f4f8', '#8d99a9', '#c2cad5'] },
        tex: shineTex(),
      }),
    };
  },
  oro: (c) => {
    const R = 37;
    const Rf = 30;
    const edge = '#553400';
    c.defs +=
      radial(c.u('glow'), [
        [0.45, '#ffcf47', 0.6],
        [1, '#ffcf47', 0],
      ]) +
      lin(c.u('leaf'), [
        [0, '#fff3b0'],
        [0.55, '#f2bd38'],
        [1, '#a26c00'],
      ]) +
      lin(
        c.u('ribbon'),
        [
          [0, '#5cb6ff'],
          [1, '#0b4fae'],
        ],
        0,
        0,
        0,
        1,
      ) +
      radial(
        c.u('gem'),
        [
          [0, '#ffd0d6'],
          [0.35, '#ff3b4f'],
          [1, '#7a0010'],
        ],
        0.35,
        0.3,
        0.7,
      );
    let back = circle(50, { fill: c.ref('glow') });
    // rayos detrás de la corona
    for (let i = 0; i < 16; i++) {
      const a = i * 22.5 + 11.25;
      const [x1, y1] = polar(49, a - 3);
      const [x2, y2] = polar(49, a + 3);
      back += tag('polygon', { points: `50,50 ${pt(x1, y1)} ${pt(x2, y2)}`, fill: '#ffe08a', opacity: 0.32 });
    }
    // cinta: dos colas que salen de la punta de abajo, y su nudo
    const rb = { fill: c.ref('ribbon'), stroke: '#06306b', 'stroke-width': 0.6, 'stroke-linejoin': 'round' };
    back += tag('polygon', { points: `${pt(46.5, 82)} ${pt(34, 98)} ${pt(38.6, 96.4)} ${pt(40.6, 99.8)} ${pt(52, 85)}`, ...rb });
    back += tag('polygon', { points: `${pt(53.5, 82)} ${pt(66, 98)} ${pt(61.4, 96.4)} ${pt(59.4, 99.8)} ${pt(48, 85)}`, ...rb });
    const la = { fill: c.ref('leaf'), stroke: edge, 'stroke-width': 0.45, 'stroke-opacity': 0.7 };
    back += branch(-1, 40.5, 104, 238, 8, 10, 2.7, la, '#9a6400') + branch(1, 40.5, 104, 238, 8, 10, 2.7, la, '#9a6400');
    back += circle(3.8, { fill: c.ref('ribbon'), stroke: '#06306b', 'stroke-width': 0.6 }, 50, 86.5);
    // rubí en la punta de arriba del canto
    const gy = 50 - (R + Rf) / 2 - 0.3;
    const gr = 4.6;
    const front =
      tag('polygon', { points: rhombus(50, gy + 0.9, gr * 1.1), fill: '#000', opacity: 0.4 }) +
      tag('polygon', { points: rhombus(50, gy, gr * 1.1), fill: c.ref('gem'), stroke: '#5a2a00', 'stroke-width': 0.5, 'stroke-linejoin': 'round' }) +
      sparkle(50 - gr * 0.35, gy - gr * 0.4, gr * 0.55, { fill: '#fff', opacity: 0.9 }) +
      sparkle(50 - Rf * 0.55, 50 - Rf * 0.68, 4.2, { fill: '#fff', opacity: 0.95 });
    return {
      Rf,
      back,
      front,
      body: medalBody(c, {
        R,
        Rf,
        edge,
        reeding: 7,
        rim: ['#fff4b8', '#e2a727', '#7d4f00'],
        face: { colors: ['#fff4b0', '#efb12a', '#ffe27c', '#c98400', '#efb12a'] },
        tex: shineTex(),
      }),
    };
  },
  diamante: (c) => {
    // gema hexagonal tallada en un engaste de platino, con rayos y destellos
    const R = 44;
    const G = 36.5;
    const T = 24;
    c.defs +=
      radial(c.u('glow'), [
        [0.3, '#9be7ff', 0.75],
        [1, '#9be7ff', 0],
      ]) +
      lin(c.u('bezel'), [
        [0, '#ffffff'],
        [0.45, '#b9d3e2'],
        [1, '#4b6f86'],
      ]) +
      lin(c.u('bezelHl'), [
        [0, '#fff', 1],
        [0.5, '#fff', 0],
        [1, '#fff', 0],
      ]) +
      lin(c.u('tbl'), [
        [0, '#e6faff'],
        [1, '#79d3f8'],
      ]);
    let back = circle(50, { fill: c.ref('glow') });
    // rayos que salen del centro de cada lado y, más tenues, hacia cada punta
    for (let i = 0; i < 6; i++) {
      const a = hexNormal(i);
      const [lx, ly] = polar(17, a - 13);
      const [rx, ry] = polar(17, a + 13);
      const [tx, ty] = polar(49.5, a);
      back += tag('polygon', { points: `${pt(lx, ly)} ${pt(tx, ty)} ${pt(rx, ry)} 50,50`, fill: '#dff8ff', opacity: 0.6 });
      const v = a + 30;
      const [l2x, l2y] = polar(22, v - 5);
      const [r2x, r2y] = polar(22, v + 5);
      const [t2x, t2y] = polar(48, v);
      back += tag('polygon', { points: `${pt(l2x, l2y)} ${pt(t2x, t2y)} ${pt(r2x, r2y)} 50,50`, fill: '#dff8ff', opacity: 0.32 });
    }
    let b =
      tag('path', { d: hexD(R, 4, 53), fill: '#000', opacity: 0.42, 'stroke-linejoin': 'round', stroke: '#000', 'stroke-width': 1.6 }) +
      tag('path', { d: hexD(R, 4), fill: c.ref('bezel'), stroke: '#1d4a66', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }) +
      tag('path', { d: hexD(R - 1.9, 3.6), fill: 'none', stroke: c.ref('bezelHl'), 'stroke-width': 1.2, 'stroke-linejoin': 'round' }) +
      tag('path', { d: hexD(G + 1.2, 3), fill: '#1d4a66', opacity: 0.8 });
    // gema: mesa (hexágono central) y 18 facetas, más claras hacia la luz (arriba a la izquierda)
    const ramp = ['#2b8fd0', '#3da4e2', '#5cb9ee', '#7ccbf6', '#a2defc', '#c8eefe', '#f2fdff'];
    const mix = (t: number) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];
    const VG = hexV(G);
    const VT = hexV(T);
    const mid = (p: Point, q: Point): Point => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const facet = { stroke: '#ffffff', 'stroke-opacity': 0.5, 'stroke-width': 0.5, 'stroke-linejoin': 'round' };
    for (let e = 0; e < 6; e++) {
      const A = VG[e];
      const B = VG[(e + 1) % 6];
      const a = VT[e];
      const bb = VT[(e + 1) % 6];
      const M = mid(A, B);
      const lit = Math.cos(rad(hexNormal(e) + 135)); // 1 = mira a la luz
      const t = (lit + 1) / 2;
      b += tag('polygon', { points: `${pt(...A)} ${pt(...a)} ${pt(...M)}`, fill: mix(t + 0.12), ...facet });
      b += tag('polygon', { points: `${pt(...a)} ${pt(...bb)} ${pt(...M)}`, fill: mix(t), ...facet });
      b += tag('polygon', { points: `${pt(...bb)} ${pt(...B)} ${pt(...M)}`, fill: mix(t - 0.12), ...facet });
    }
    b += tag('path', { d: hexD(T), fill: c.ref('tbl'), ...facet });
    // reflejo sobre la mesa
    b += tag('polygon', { points: `${pt(50, 50 - T + 3)} ${pt(50 - (T - 3) * 0.866, 50 - (T - 3) * 0.5)} ${pt(50 - 4, 50 - 3)} ${pt(50 - 1, 50 - 7)}`, fill: '#fff', opacity: 0.55 });
    const front =
      sparkle(33, 31, 7.2, { fill: '#fff' }) + sparkle(70, 69, 4, { fill: '#fff', opacity: 0.9 }) + sparkle(82, 21, 3.2, { fill: '#fff', opacity: 0.85 });
    return { Rf: 36, back, front, body: b };
  },
};

// ---------------------------------------------------------------- salida

function draw(id: AchievementId, material: Material | undefined): string {
  const prefix = `${id}-${material ?? 'vacio'}-`;
  const u = (name: string) => prefix + name;
  const ref = (name: string) => `url(#${u(name)})`;

  if (!material) {
    // estado vacío: la silueta de la medalla en gris apagado, con borde punteado, y el símbolo apagado
    // (la paleta no se usa)
    const c: Ctx = { u, ref, pal: PAL.papel, empty: true, defs: '', sh: 0 };
    const sy = symbol(id, c, placement(id, 1));
    const hex = tag('path', { d: hexD(R_BASE, 4.2), fill: '#1b1b27', stroke: '#5a5a7c', 'stroke-width': 1.6, 'stroke-dasharray': '3 2.2', 'stroke-linejoin': 'round' });
    const face = tag('path', { d: hexD(RF_BASE, 3.2), fill: '#222234', stroke: '#34344c', 'stroke-width': 0.8, 'stroke-linejoin': 'round' });
    return (c.defs ? tag('defs', {}, c.defs) : '') + hex + face + sy.back + sy.body;
  }

  const c: Ctx = { u, ref, pal: PAL[material], empty: false, defs: '', sh: 1.8 };
  symbolDefs(c);
  const m = MEDALS[material](c);
  const sy = symbol(id, c, placement(id, m.Rf / RF_BASE));
  // `c.defs` se lee al final: la medalla y el símbolo le van sumando degradados y recortes
  return tag('defs', {}, c.defs) + (m.back ?? '') + m.body + sy.back + sy.shadow + sy.body + (m.front ?? '');
}

const bodyCache = new Map<string, string>();

/** Contenido del `<svg>`; `level` 1–7 = Papel a Diamante y cualquier otro valor = vacío. */
function iconBody(id: AchievementId, level: number): string {
  const material: Material | undefined = MATERIALS[Math.floor(level) - 1];
  const key = `${id}.${material ?? 'vacio'}`;
  let body = bodyCache.get(key);
  if (body === undefined) {
    body = draw(id, material);
    bodyCache.set(key, body);
  }
  return body;
}

const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';

/** SVG en texto, con tamaño en píxeles (para `SvgXml` y `<canvas>`). `level` 0 = vacío. */
export function achievementIconSvg(id: AchievementId, level: number, px: number): string {
  return `<svg ${XMLNS} width="${px}" height="${px}" viewBox="0 0 100 100">${iconBody(id, level)}</svg>`;
}

const uriCache = new Map<string, string>();

/** `data:image/svg+xml` del icono (sin tamaño fijo: escala con el `<img>`). `level` 0 = vacío. */
export function achievementIconDataUri(id: AchievementId, level: number): string {
  const body = iconBody(id, level);
  let uri = uriCache.get(body);
  if (!uri) {
    uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg ${XMLNS} viewBox="0 0 100 100">${body}</svg>`);
    uriCache.set(body, uri);
  }
  return uri;
}
