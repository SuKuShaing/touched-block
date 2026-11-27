import type { TierId } from '@tb/engine';

/**
 * Dibujo vectorial de las medallas (insignias y logros), como un árbol SVG sin transformaciones
 * ni filtros, para que se vea igual en las tres salidas:
 * - web: `<img>` con el SVG como data URI (`components/MedalImage.web.tsx`);
 * - app: los mismos nodos con react-native-svg (`components/MedalImage.native.tsx`);
 * - tarjeta de compartir de la web: el mismo SVG dibujado en el `<canvas>` (`platform/share.web.ts`).
 *
 * Lienzo de 100×100. Progresión: Papel (borde dentado, hoja de cuaderno, bloque azul con la
 * esquina doblada), Cartón (canto corrugado, kraft, bloque pegado con cinta), Madera (disco con
 * veta, bloque de arce con estrella de nogal remachada), Bronce (metal con canto estriado), Plata
 * (+ ramas de laurel), Oro (+ corona de laurel, cinta, rubí, rayos y brillo), Diamante (gema
 * tallada en un engaste de platino, rayos y destellos). En el centro (salvo Diamante), un bloque
 * del juego en relieve con una estrella. Papel, Cartón y Madera son los pasos 1, 2 y 3 del tier
 * `madera`. Con `small` (menos de ~30 px) se omiten los detalles finos que a ese tamaño solo
 * ensucian. Diseños de referencia: `config_logros/insignias_nuevas/` (los compara el test).
 */

type Attrs = Record<string, string | number>;
export interface SvgNode {
  t: string;
  a: Attrs;
  c?: SvgNode[];
}

export interface MedalSpec {
  tier: TierId;
  /** En `madera`: 1 = Papel, 2 = Cartón, 3 = Madera. En las demás, 1. */
  step: number;
  /** Ya no cambia el dibujo: todas las medallas llevan estrella. */
  emblem: 'tier' | 'star';
  small: boolean;
}

const el = (t: string, a: Attrs, c?: SvgNode[]): SvgNode => (c ? { t, a, c } : { t, a });
const r2 = (x: number) => Math.round(x * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)},${r2(y)}`;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Punto a distancia r del centro (50, 50 si no se indica), con el ángulo en grados (0 = derecha, 90 = abajo). */
const polar = (r: number, deg: number, cx = 50, cy = 50): [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

type StopDef = [offset: number, color: string, opacity?: number];
const stops = (s: StopDef[]) =>
  s.map(([o, c, op]) => el('stop', op === undefined ? { offset: o, stopColor: c } : { offset: o, stopColor: c, stopOpacity: op }));
const lin = (id: string, s: StopDef[], x1 = 0, y1 = 0, x2 = 1, y2 = 1) => el('linearGradient', { id, x1, y1, x2, y2 }, stops(s));
const radial = (id: string, s: StopDef[], cx = 0.5, cy = 0.5, r = 0.5) => el('radialGradient', { id, cx, cy, r }, stops(s));
const circle = (r: number, a: Attrs, cx = 50, cy = 50) => el('circle', { cx: r2(cx), cy: r2(cy), r: r2(r), ...a });

// ---------------------------------------------------------------- materiales

/** Material de las medallas redondas; los tres primeros son los pasos del tier `madera`. */
type Material = 'papel' | 'carton' | Exclude<TierId, 'diamante'>;

interface Look {
  /** Canto: claro, medio, oscuro (degradado en diagonal, luz arriba a la izquierda). */
  rim: [string, string, string];
  /** Cara: centro y borde en papel, cartón y madera (radial); bandas de luz del metal pulido en el resto (diagonal). */
  face: string[];
  /** Bloque central: arriba, abajo. */
  panel: [string, string];
  /** Estrella: arriba, abajo. Sin definir en Madera, cuya estrella es de nogal (`WALNUT`). */
  glyph?: [string, string];
  /** Contorno oscuro. */
  edge: string;
}

const MATERIALS: Record<Material, Look> = {
  papel: {
    rim: ['#ffffff', '#ece2cb', '#a8946f'],
    face: ['#fffdf7', '#e9dec4'],
    // azul tinta de cuaderno, más apagado que el esmalte de Oro
    panel: ['#5d84b8', '#34557f'],
    glyph: ['#ffffff', '#dfe8f3'],
    edge: '#6b5a3c',
  },
  carton: {
    rim: ['#ecd3a4', '#b78d58', '#6a4a25'],
    face: ['#d9bb88', '#ad8754'],
    panel: ['#8c6439', '#5b3c1c'],
    glyph: ['#f6e2bd', '#d9b47a'],
    edge: '#3f2a12',
  },
  madera: {
    rim: ['#d0a46c', '#8f6439', '#4a2f15'],
    face: ['#d8ad74', '#9f7344'],
    // bloque de arce (madera clara), para que resalte el nogal de la estrella
    panel: ['#f2d6a2', '#c99558'],
    edge: '#2e1706',
  },
  bronce: {
    rim: ['#ffc8a0', '#bf622b', '#56220a'],
    face: ['#ffc193', '#cd6f36', '#f3a66f', '#9a4718', '#c96b32'],
    panel: ['#8c4b1d', '#552a0d'],
    glyph: ['#fff0dc', '#f7b67a'],
    edge: '#3d1a04',
  },
  plata: {
    rim: ['#ffffff', '#a9b3c2', '#4f5a6a'],
    face: ['#ffffff', '#bcc5d1', '#f1f4f8', '#8d99a9', '#c2cad5'],
    panel: ['#43526e', '#222c42'],
    glyph: ['#ffffff', '#c5cfdc'],
    edge: '#2c3340',
  },
  oro: {
    rim: ['#fff4b8', '#e2a727', '#7d4f00'],
    face: ['#fff4b0', '#efb12a', '#ffe27c', '#c98400', '#efb12a'],
    // esmalte azul: el azul del bloque del juego
    panel: ['#1f93ff', '#0a4aa8'],
    glyph: ['#fff8cf', '#ffc22e'],
    edge: '#553400',
  },
};

// ---------------------------------------------------------------- piezas

function starPoints(cx: number, cy: number, R: number, ri: number): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rad(-90 + i * 36);
    const r = i % 2 ? ri : R;
    p.push(pt(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return p.join(' ');
}

/** Destello de cuatro puntas. */
function sparkle(cx: number, cy: number, s: number, a: Attrs): SvgNode {
  const k = s * 0.14;
  const d =
    `M${pt(cx, cy - s)}Q${pt(cx + k, cy - k)} ${pt(cx + s, cy)}Q${pt(cx + k, cy + k)} ${pt(cx, cy + s)}` +
    `Q${pt(cx - k, cy + k)} ${pt(cx - s, cy)}Q${pt(cx - k, cy - k)} ${pt(cx, cy - s)}Z`;
  return el('path', { d, ...a });
}

/** Rombo (cuadrado girado 45°) centrado, con distancia d del centro a cada punta. */
const rhombus = (d: number, dy = 0) => `${pt(50, 50 - d + dy)} ${pt(50 + d, 50 + dy)} ${pt(50, 50 + d + dy)} ${pt(50 - d, 50 + dy)}`;

/** Hoja de laurel desde (bx, by) hacia el ángulo `dir`, de largo L y medio ancho w. */
function leaf(bx: number, by: number, dir: number, L: number, w: number, a: Attrs): SvgNode {
  const ux = Math.cos(rad(dir));
  const uy = Math.sin(rad(dir));
  const tx = bx + ux * L;
  const ty = by + uy * L;
  const mx = bx + ux * L * 0.45;
  const my = by + uy * L * 0.45;
  const k = w * 1.9;
  const d = `M${pt(bx, by)}Q${pt(mx - uy * k, my + ux * k)} ${pt(tx, ty)}Q${pt(mx + uy * k, my - ux * k)} ${pt(bx, by)}Z`;
  return el('path', { d, ...a });
}

/**
 * Rama de laurel sobre un arco de radio r. Los ángulos son los del lado izquierdo (de abajo hacia
 * arriba, crecientes); el lado derecho es su reflejo.
 */
function branch(side: -1 | 1, r: number, from: number, to: number, count: number, L: number, w: number, leafA: Attrs, stem: string, small: boolean) {
  const ang = (u: number) => {
    const t = from + (to - from) * u;
    return side < 0 ? t : 180 - t;
  };
  const [sx, sy] = polar(r, ang(0));
  const [ex, ey] = polar(r, ang(1));
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const out: SvgNode[] = [
    el('path', {
      d: `M${pt(sx, sy)}A${r2(r)} ${r2(r)} 0 ${large} ${side < 0 ? 1 : 0} ${pt(ex, ey)}`,
      fill: 'none',
      stroke: stem,
      strokeWidth: small ? 1.6 : 1.1,
      strokeLinecap: 'round',
    }),
  ];
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const th = ang(u);
    // dirección en que crece la rama (tangente)
    const dir = side < 0 ? th + 90 : th - 90;
    const s = 1 - 0.32 * u;
    const [x, y] = polar(r, th);
    if (i === count - 1) {
      out.push(leaf(x, y, dir, L * s, w * s, leafA));
      break;
    }
    // hoja de afuera y de adentro, abiertas ~32°
    out.push(leaf(x, y, dir + (side < 0 ? -32 : 32), L * s, w * s, leafA));
    out.push(leaf(x, y, dir + (side < 0 ? 34 : -34), L * s * 0.9, w * s * 0.9, leafA));
  }
  return out;
}

// ---------------------------------------------------------------- bloque central

/**
 * Contorno del bloque de lado S con esquinas cuadráticas (Papel y Cartón), bajado `dy` y encogido
 * `inset`. Con `ear` > 0 se corta la esquina de arriba a la derecha (donde va el doblez).
 */
function blockPath(S: number, ear: number, dy: number, inset: number): string {
  const x0 = 50 - S / 2;
  const y0 = 50 - S / 2;
  const a = x0 + inset;
  const b = y0 + inset + dy;
  const e = x0 + S - inset;
  const f = y0 + S - inset + dy;
  const r = S * 0.22 - inset;
  const cut = ear - inset * 0.4;
  const topRight = ear ? `H${r2(e - cut)}L${pt(e, b + cut)}` : `H${r2(e - r)}Q${pt(e, b)} ${pt(e, b + r)}`;
  return (
    `M${pt(a + r, b)}${topRight}V${r2(f - r)}Q${pt(e, f)} ${pt(e - r, f)}` +
    `H${r2(a + r)}Q${pt(a, f)} ${pt(a, f - r)}V${r2(b + r)}Q${pt(a, b)} ${pt(a + r, b)}Z`
  );
}

/** La esquina doblada de Papel (lado `c`): el revés de la hoja, con su sombra sobre el bloque. */
function dogEar(S: number, c: number): SvgNode[] {
  const y0 = 50 - S / 2;
  const x1 = 50 - S / 2 + S;
  return [
    el('polygon', { points: `${pt(x1 - c + 0.4, y0 + c * 0.25)} ${pt(x1 - c + 0.4, y0 + c + 1.2)} ${pt(x1 - c * 0.15, y0 + c + 1.2)}`, fill: '#000', opacity: 0.3 }),
    el('path', {
      d: `M${pt(x1 - c, y0)}L${pt(x1 - c, y0 + c - 1.2)}Q${pt(x1 - c, y0 + c)} ${pt(x1 - c + 1.2, y0 + c)}L${pt(x1, y0 + c)}Z`,
      fill: 'url(#fold)',
      stroke: '#1d3c66',
      strokeWidth: 0.5,
      strokeLinejoin: 'round',
    }),
  ];
}

/** Centro y radios de la estrella de nogal sobre un bloque de lado S. */
function walnutPlace(S: number, small: boolean) {
  const R = S * (small ? 0.45 : 0.42);
  return { cy: small ? 50.6 : 50 - S * 0.05 + 0.6, R, ri: R * 0.5 };
}

/** Estrella de nogal de Madera, con un remache de latón en cada punta. */
function walnutStar(S: number, small: boolean): SvgNode[] {
  const { cy, R, ri } = walnutPlace(S, small);
  const drop = Math.max(0.7, S * 0.04);
  const out: SvgNode[] = [
    el('polygon', { points: starPoints(50, cy + drop, R, ri), fill: '#000', opacity: 0.45, stroke: '#000', strokeWidth: r2(S * 0.025), strokeLinejoin: 'round' }),
    el('polygon', { points: starPoints(50, cy, R, ri), fill: 'url(#star)', stroke: '#1e0c02', strokeWidth: small ? 1.3 : 0.9, strokeLinejoin: 'round' }),
  ];
  if (!small) {
    // veta vertical del nogal
    const grain: SvgNode[] = [];
    for (let i = -4; i <= 4; i++) {
      const x = 50 + i * 2.6;
      const k = (i % 2 ? 0.9 : -0.8) + i * 0.1;
      grain.push(
        el('path', {
          d: `M${pt(x, cy - R - 1)}C${pt(x + k * 1.5, cy - R / 3)} ${pt(x - k * 1.3, cy + R / 4)} ${pt(x + k * 0.4, cy + R + 1)}`,
          fill: 'none',
          stroke: i % 3 === 0 ? '#2a1205' : '#b0703f',
          strokeWidth: 0.4,
          opacity: i % 3 === 0 ? 0.45 : 0.4,
        }),
      );
    }
    out.push(el('g', { clipPath: 'url(#sc)' }, grain));
    out.push(el('polygon', { points: starPoints(50, cy, R - 1, ri - 0.55), fill: 'none', stroke: 'url(#starHl)', strokeWidth: 0.8, strokeLinejoin: 'round' }));
  }
  const rn = small ? 2.3 : 1.55;
  const rr = R - (small ? 4.1 : 2.9);
  for (let i = 0; i < 5; i++) {
    const [x, y] = polar(rr, -90 + i * 72, 50, cy);
    out.push(
      circle(rn, { fill: '#000', opacity: 0.4 }, x, y + 0.5),
      circle(rn, { fill: 'url(#nail)', stroke: MATERIALS.madera.edge, strokeWidth: 0.3 }, x, y),
    );
    if (!small) out.push(circle(rn * 0.32, { fill: '#fff', opacity: 0.8 }, x - rn * 0.3, y - rn * 0.32));
  }
  return out;
}

/** Bloque del juego en relieve (con su barrita clara abajo) y la estrella encima. */
function panel(S: number, mat: Material, small: boolean): SvgNode[] {
  const x0 = 50 - S / 2;
  const y0 = 50 - S / 2;
  const rx = S * 0.22;
  const ear = mat === 'papel' ? S * 0.3 : 0;
  /** El contorno del bloque, bajado `dy` y encogido `inset`. */
  const shape = (dy: number, inset: number, a: Attrs): SvgNode =>
    mat === 'papel' || mat === 'carton'
      ? el('path', { d: blockPath(S, ear, dy, inset), ...a })
      : el('rect', { x: r2(x0 + inset), y: r2(y0 + inset + dy), width: r2(S - 2 * inset), height: r2(S - 2 * inset), rx: r2(rx - inset), ...a });
  const border: Attrs = mat === 'madera' ? { stroke: '#6b4220', strokeWidth: small ? 0.9 : 0.6 } : {};
  const out: SvgNode[] = [shape(S * 0.07, 0, { fill: '#000', opacity: 0.4 }), shape(0, 0, { fill: 'url(#panel)', ...border })];
  if (mat === 'madera' && !small) {
    // veta fina del arce, horizontal (cruzada con la del nogal)
    const grain: SvgNode[] = [];
    for (let i = 0; i < 7; i++) {
      const y = y0 + 3 + (i * (S - 6)) / 6;
      const k = i % 2 ? 1.1 : -0.9;
      grain.push(
        el('path', {
          d: `M${pt(x0 - 1, y)}C${pt(x0 + S / 3, y - k)} ${pt(x0 + (2 * S) / 3, y + k)} ${pt(x0 + S + 1, y - k * 0.3)}`,
          fill: 'none',
          stroke: '#9a6a36',
          strokeWidth: 0.4,
          opacity: 0.35,
        }),
      );
    }
    out.push(el('g', { clipPath: 'url(#pc)' }, grain));
  }
  if (!small) out.push(shape(0, 0.6, { fill: 'none', stroke: 'url(#panelHl)', strokeWidth: 0.9 }));
  if (ear) out.push(...dogEar(S, ear));
  if (!small) out.push(el('rect', { x: r2(x0 + S * 0.14), y: r2(y0 + S * 0.8), width: r2(S * 0.4), height: r2(S * 0.08), rx: r2(S * 0.04), fill: '#fff', opacity: 0.55 }));
  if (mat === 'madera') {
    out.push(...walnutStar(S, small));
  } else {
    // sin la barrita (chica) la estrella va al centro; con ella, un poco más arriba
    const cy = small ? 50 : 50 - S * 0.05;
    const drop = Math.max(0.7, S * 0.04);
    const R = S * (small ? 0.42 : 0.36);
    out.push(el('polygon', { points: starPoints(50, cy + drop, R, R * 0.47), fill: '#000', opacity: 0.45, strokeLinejoin: 'round' }));
    out.push(el('polygon', { points: starPoints(50, cy, R, R * 0.47), fill: 'url(#glyph)', stroke: 'url(#glyph)', strokeWidth: S * 0.025, strokeLinejoin: 'round' }));
  }
  return out;
}

/** Brillo en forma de medialuna arriba a la izquierda de un círculo de radio r. */
function crescent(r: number, a: Attrs): SvgNode {
  const [x1, y1] = polar(r, 192);
  const [x2, y2] = polar(r, 292);
  return el('path', { d: `M${pt(x1, y1)}A${r2(r)} ${r2(r)} 0 0 1 ${pt(x2, y2)}A${r2(r * 1.3)} ${r2(r * 1.3)} 0 0 0 ${pt(x1, y1)}Z`, ...a });
}

// ---------------------------------------------------------------- papel y cartón

/** Puntos del borde dentado de Papel (cortado con tijera de picos), bajado `dy`. */
function zigzag(R: number, teeth: number, depth: number, dy: number): string {
  const p: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const [x, y] = polar(i % 2 ? R - depth : R, -90 + (i * 180) / teeth);
    p.push(pt(x, y + dy));
  }
  return p.join(' ');
}

/** Hoja de cuaderno: renglones azules y margen rojo. */
function notebook(Rf: number): SvgNode[] {
  const out: SvgNode[] = [];
  for (let y = 50 - Rf + 5; y < 50 + Rf; y += 5.6) out.push(el('line', { x1: 10, y1: r2(y), x2: 90, y2: r2(y), stroke: '#7ea6dd', strokeWidth: 0.5, opacity: 0.7 }));
  out.push(el('line', { x1: 27, y1: 10, x2: 27, y2: 90, stroke: '#e26464', strokeWidth: 0.6, opacity: 0.6 }));
  return out;
}

/** Canto corrugado de Cartón: la onda (radio medio `rc`) entre las dos capas, que en grande se marcan. */
function corrugated(rc: number, small: boolean): SvgNode[] {
  const edge = MATERIALS.carton.edge;
  const waves = small ? 16 : 34;
  const amp = small ? 2.4 : 2.1;
  const seg = waves * 8;
  let d = '';
  for (let i = 0; i < seg; i++) {
    const th = (i * 360) / seg;
    const [x, y] = polar(rc + amp * Math.sin(rad(th * waves)), th);
    d += (i ? 'L' : 'M') + pt(x, y);
  }
  const out: SvgNode[] = [el('path', { d: d + 'Z', fill: 'none', stroke: edge, strokeWidth: small ? 1.5 : 0.8, opacity: small ? 0.5 : 0.55, strokeLinejoin: 'round' })];
  if (!small) {
    for (const r of [rc + amp + 0.9, rc - amp - 0.9]) out.push(circle(r, { fill: 'none', stroke: edge, strokeWidth: 0.5, opacity: 0.4 }));
  }
  return out;
}

/** Fibras del kraft (pseudoaleatorias con semilla fija: siempre las mismas) y canaletas muy suaves. */
function kraft(Rf: number): SvgNode[] {
  const out: SvgNode[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 46; i++) {
    const x = 16 + rnd() * 68;
    const y = 16 + rnd() * 68;
    if (rnd() < 0.5) {
      out.push(circle(0.35 + rnd() * 0.4, { fill: '#5a3a16', opacity: 0.35 }, x, y));
    } else {
      const a = rnd() * 180;
      const l = 1.2 + rnd() * 1.8;
      out.push(el('line', { x1: r2(x), y1: r2(y), x2: r2(x + l * Math.cos(rad(a))), y2: r2(y + l * Math.sin(rad(a))), stroke: '#5a3a16', strokeWidth: 0.35, opacity: 0.3 }));
    }
  }
  // canaletas del corrugado que se marcan bajo la cara
  for (let x = 50 - Rf + 4; x < 50 + Rf; x += 5) out.push(el('line', { x1: r2(x), y1: 10, x2: r2(x), y2: 90, stroke: '#7a5528', strokeWidth: 1.6, opacity: 0.1 }));
  return out;
}

/** Trozo de cinta de embalar, de extremos rasgados, que pega el bloque de lado S al cartón. */
function tape(S: number, small: boolean): SvgNode[] {
  const w = S * (small ? 0.62 : 0.5);
  const h = small ? 8 : 6.4;
  const y = 50 - S / 2 - h * 0.55;
  const x0 = 50 - w / 2;
  const x1 = 50 + w / 2;
  const n = small ? 3 : 5;
  let d = `M${pt(x0, y)}H${r2(x1)}`;
  for (let i = 1; i <= n; i++) d += `L${pt(x1 + (i % 2 ? 1.1 : 0), y + (h * i) / n)}`;
  d += `H${r2(x0)}`;
  for (let i = n - 1; i >= 0; i--) d += `L${pt(x0 - ((n - i) % 2 ? 1.1 : 0), y + (h * i) / n)}`;
  const out: SvgNode[] = [el('path', { d: d + 'Z', fill: 'url(#tape)', stroke: '#9c7a45', strokeWidth: 0.4, strokeOpacity: 0.6, strokeLinejoin: 'round' })];
  if (!small) out.push(el('rect', { x: r2(x0 + 1.5), y: r2(y + 1), width: r2(w - 3), height: 1.1, rx: 0.5, fill: '#fff', opacity: 0.7 }));
  return out;
}

// ---------------------------------------------------------------- medalla redonda

function roundMedal(spec: MedalSpec): SvgNode[] {
  const tier = spec.tier as Exclude<TierId, 'diamante'>;
  const mat: Material = tier !== 'madera' ? tier : spec.step <= 1 ? 'papel' : spec.step === 2 ? 'carton' : 'madera';
  const m = MATERIALS[mat];
  const metal = mat === 'bronce' || mat === 'plata' || mat === 'oro';
  const small = spec.small;
  const R = tier === 'oro' ? 32 : tier === 'plata' ? 36 : 43;
  const Rf = mat === 'papel' ? 33.5 : mat === 'carton' ? 33.6 : R * (mat === 'madera' ? 0.79 : 0.78);
  /** Lado del bloque central. */
  const S = Rf * (small ? 1.12 : 1.04);
  const defs: SvgNode[] = [
    lin('rim', [
      [0, m.rim[0]],
      [0.5, m.rim[1]],
      [1, m.rim[2]],
    ]),
    lin('rimIn', [
      [0, m.rim[2]],
      [1, m.rim[0]],
    ]),
    lin('hl', [
      [0, '#fff', 0.95],
      [0.45, '#fff', 0],
      [1, '#fff', 0],
    ]),
    metal
      ? lin('face', m.face.map((c, i): StopDef => [[0, 0.3, 0.55, 0.8, 1][i], c]))
      : radial('face', [[0, m.face[0]], [1, m.face[1]]], 0.38, 0.32, 0.75),
    lin('panel', [[0, m.panel[0]], [1, m.panel[1]]], 0, 0, 0, 1),
    lin('panelHl', [[0, '#fff', 0.45], [0.5, '#fff', 0], [1, '#fff', 0]], 0, 0, 0, 1),
  ];
  if (mat === 'papel') defs.push(lin('fold', [[0, '#ffffff'], [1, '#c9d6e6']]));
  if (m.glyph) defs.push(lin('glyph', [[0, m.glyph[0]], [1, m.glyph[1]]], 0, 0, 0, 1));
  if (mat === 'carton') defs.push(lin('tape', [[0, '#fff6dc', 0.85], [1, '#e7d3a2', 0.8]], 0, 0, 0, 1));
  if (mat === 'madera') {
    defs.push(
      lin('star', [[0, '#8a4f2a'], [0.55, '#5e3017'], [1, '#3a1a09']]),
      lin('starHl', [[0, '#ffd9b0', 0.75], [0.5, '#ffd9b0', 0], [1, '#ffd9b0', 0]]),
      radial('nail', [[0, '#fff6cf'], [0.45, '#e2b54a'], [1, '#7a5310']], 0.35, 0.3, 0.7),
    );
  }
  defs.push(el('clipPath', { id: 'fc' }, [circle(Rf, {})]));
  if (mat === 'madera' && !small) {
    // recortes de las vetas: la del bloque y la de la estrella
    const star = walnutPlace(S, small);
    defs.push(
      el('clipPath', { id: 'pc' }, [el('rect', { x: r2(50 - S / 2), y: r2(50 - S / 2), width: r2(S), height: r2(S), rx: r2(S * 0.22) })]),
      el('clipPath', { id: 'sc' }, [el('polygon', { points: starPoints(50, star.cy, star.R, star.ri) })]),
    );
  }
  const back: SvgNode[] = [];
  const front: SvgNode[] = [];

  if (tier === 'oro') {
    defs.push(
      radial('glow', [[0.45, '#ffcf47', 0.6], [1, '#ffcf47', 0]]),
      lin('leaf', [[0, '#fff3b0'], [0.55, '#f2bd38'], [1, '#a26c00']]),
      lin('ribbon', [[0, '#5cb6ff'], [1, '#0b4fae']], 0, 0, 0, 1),
      radial('gem', [[0, '#ffd0d6'], [0.35, '#ff3b4f'], [1, '#7a0010']], 0.35, 0.3, 0.7),
    );
    back.push(circle(50, { fill: 'url(#glow)' }));
    if (!small) {
      // rayos detrás de la corona
      for (let i = 0; i < 16; i++) {
        const a = i * 22.5 + 11.25;
        const [x1, y1] = polar(49, a - 3);
        const [x2, y2] = polar(49, a + 3);
        back.push(el('polygon', { points: `50,50 ${pt(x1, y1)} ${pt(x2, y2)}`, fill: '#ffe08a', opacity: 0.32 }));
      }
    }
    // cinta: dos colas que salen de abajo de la corona
    back.push(
      el('polygon', { points: `${pt(46.5, 83)} ${pt(34, 98)} ${pt(38.6, 96.4)} ${pt(40.6, 99.8)} ${pt(52, 86)}`, fill: 'url(#ribbon)', stroke: '#06306b', strokeWidth: 0.6, strokeLinejoin: 'round' }),
      el('polygon', { points: `${pt(53.5, 83)} ${pt(66, 98)} ${pt(61.4, 96.4)} ${pt(59.4, 99.8)} ${pt(48, 86)}`, fill: 'url(#ribbon)', stroke: '#06306b', strokeWidth: 0.6, strokeLinejoin: 'round' }),
    );
    const la = { fill: 'url(#leaf)', stroke: m.edge, strokeWidth: small ? 0.5 : 0.45, strokeOpacity: 0.7 };
    back.push(...branch(-1, 40.5, 104, 238, small ? 6 : 8, small ? 11 : 10, small ? 3.2 : 2.7, la, '#9a6400', small));
    back.push(...branch(1, 40.5, 104, 238, small ? 6 : 8, small ? 11 : 10, small ? 3.2 : 2.7, la, '#9a6400', small));
    // nudo de la cinta
    back.push(circle(4.2, { fill: 'url(#ribbon)', stroke: '#06306b', strokeWidth: 0.6 }, 50, 85));
  } else if (tier === 'plata') {
    defs.push(lin('leaf', [[0, '#ffffff'], [0.55, '#bcc6d3'], [1, '#5f6b7c']]));
    const la = { fill: 'url(#leaf)', stroke: m.edge, strokeWidth: small ? 0.5 : 0.45, strokeOpacity: 0.6 };
    back.push(...branch(-1, 42.5, 112, 202, small ? 5 : 6, small ? 11 : 10, small ? 3.3 : 2.9, la, '#5f6b7c', small));
    back.push(...branch(1, 42.5, 112, 202, small ? 5 : 6, small ? 11 : 10, small ? 3.3 : 2.9, la, '#5f6b7c', small));
  }

  // sombra dura (como la del logo) y canto
  const drop = Math.max(2, R * 0.07);
  const body: SvgNode[] = [];
  if (mat === 'papel') {
    const teeth = small ? 20 : 30;
    const depth = small ? 3.4 : 2.6;
    body.push(
      el('polygon', { points: zigzag(R, teeth, depth, drop), fill: '#000', opacity: 0.42 }),
      el('polygon', { points: zigzag(R, teeth, depth, 0), fill: 'url(#rim)', stroke: m.edge, strokeWidth: 0.7, strokeOpacity: 0.85, strokeLinejoin: 'round' }),
    );
    if (!small) {
      // pliegues radiales del borde plisado (como un pirotín de papel)
      for (let i = 0; i < teeth; i++) {
        const a = -90 + (i * 360) / teeth;
        const [x1, y1] = polar(Rf + 2.4, a);
        const [x2, y2] = polar(R - depth - 0.4, a);
        body.push(el('line', { x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke: m.edge, strokeWidth: 0.45, opacity: 0.22 }));
      }
    }
    body.push(circle(R - depth - 1.2, { fill: 'none', stroke: 'url(#hl)', strokeWidth: small ? 1.8 : 1.3 }));
  } else {
    body.push(circle(R, { fill: '#000', opacity: 0.42 }, 50, 50 + drop), circle(R, { fill: 'url(#rim)' }));
    if (!small && metal) {
      // canto estriado (como una moneda)
      const n = tier === 'oro' ? 44 : 56;
      for (let i = 0; i < n; i++) {
        const a = (i * 360) / n;
        const [x1, y1] = polar(Rf + 2.6, a);
        const [x2, y2] = polar(R - 1.8, a);
        body.push(el('line', { x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke: m.edge, strokeWidth: 0.55, opacity: 0.28 }));
      }
    }
    if (mat === 'carton') body.push(...corrugated((R + Rf) / 2 + 0.5, small));
    if (mat === 'madera' && !small) {
      // anillos de crecimiento en el canto
      body.push(circle((R + Rf) / 2 + 1.2, { fill: 'none', stroke: m.edge, strokeWidth: 0.5, opacity: 0.3 }));
      body.push(circle((R + Rf) / 2 - 1.4, { fill: 'none', stroke: m.edge, strokeWidth: 0.4, opacity: 0.22 }));
    }
    body.push(
      circle(R - 0.35, { fill: 'none', stroke: m.edge, strokeWidth: 0.7, opacity: 0.85 }),
      circle(R - 1.5, { fill: 'none', stroke: 'url(#hl)', strokeWidth: small ? 1.8 : 1.3 }),
    );
  }
  // borde hundido de la cara y la cara
  body.push(circle(Rf + 1.8, { fill: 'url(#rimIn)' }), circle(Rf, { fill: 'url(#face)' }));

  // textura de la cara
  const tex: SvgNode[] = [];
  if (mat === 'papel') {
    if (!small) tex.push(...notebook(Rf));
  } else if (mat === 'carton') {
    if (!small) tex.push(...kraft(Rf));
  } else if (mat === 'madera') {
    if (!small) {
      for (let i = -4; i <= 4; i++) {
        const y = 50 + i * Rf * 0.23;
        const w = (i % 2 ? 2.2 : -1.8) + i * 0.3;
        tex.push(
          el('path', {
            d: `M${pt(50 - Rf - 2, y)}C${pt(50 - Rf / 3, y - w * 1.6)} ${pt(50 + Rf / 4, y + w * 1.4)} ${pt(50 + Rf + 2, y - w * 0.4)}`,
            fill: 'none',
            stroke: '#5d3412',
            strokeWidth: i % 2 ? 0.7 : 0.5,
            opacity: 0.38,
          }),
        );
      }
      // nudo
      tex.push(el('ellipse', { cx: 39, cy: 77, rx: 3.8, ry: 1.9, fill: 'none', stroke: '#5d3412', strokeWidth: 0.6, opacity: 0.45 }));
      tex.push(el('ellipse', { cx: 39, cy: 77, rx: 1.6, ry: 0.8, fill: '#5d3412', opacity: 0.4 }));
    }
  } else {
    // reflejos en diagonal del metal
    tex.push(el('polygon', { points: `${pt(18, 64)} ${pt(64, 18)} ${pt(74, 26)} ${pt(26, 74)}`, fill: '#fff', opacity: 0.13 }));
    if (!small) tex.push(el('polygon', { points: `${pt(33, 86)} ${pt(86, 33)} ${pt(89, 37)} ${pt(37, 89)}`, fill: '#fff', opacity: 0.1 }));
  }
  // la medialuna de brillo se nota más en el papel
  const shine = mat === 'papel' ? (small ? 0.35 : 0.45) : small ? 0.22 : 0.28;
  tex.push(crescent(Rf - 1.2, { fill: '#fff', opacity: shine }));
  body.push(el('g', { clipPath: 'url(#fc)' }, tex));

  body.push(...panel(S, mat, small));
  if (mat === 'carton') body.push(...tape(S, small));

  if (tier === 'oro') {
    // rubí arriba del canto
    const gy = 50 - (R + Rf) / 2;
    const gr = (R - Rf) * 0.62;
    front.push(
      el('polygon', { points: rhombus(gr * 1.35, gy - 50 + 0.9), fill: '#000', opacity: 0.4 }),
      el('polygon', { points: rhombus(gr * 1.35, gy - 50), fill: 'url(#gem)', stroke: '#5a2a00', strokeWidth: 0.5, strokeLinejoin: 'round' }),
    );
    if (!small) front.push(sparkle(50 - gr * 0.35, gy - gr * 0.4, gr * 0.55, { fill: '#fff', opacity: 0.9 }));
  }
  if (!small && (tier === 'oro' || tier === 'plata')) {
    front.push(sparkle(50 - Rf * 0.55, 50 - Rf * 0.62, tier === 'oro' ? 4.2 : 3.2, { fill: '#fff', opacity: 0.95 }));
  }

  return [el('defs', {}, defs), ...back, ...body, ...front];
}

// ---------------------------------------------------------------- diamante

function diamondMedal(spec: MedalSpec): SvgNode[] {
  const small = spec.small;
  const defs: SvgNode[] = [
    radial('glow', [[0.3, '#9be7ff', 0.75], [1, '#9be7ff', 0]]),
    lin('bezel', [[0, '#ffffff'], [0.45, '#b9d3e2'], [1, '#4b6f86']]),
    lin('bezelHl', [[0, '#fff', 1], [0.5, '#fff', 0], [1, '#fff', 0]]),
    lin('tbl', [[0, '#e6faff'], [1, '#79d3f8']]),
  ];
  const out: SvgNode[] = [el('defs', {}, defs), circle(50, { fill: 'url(#glow)' })];
  // rayos en diagonal, entre las puntas del rombo
  for (let i = 0; i < 4; i++) {
    const a = 45 + i * 90;
    const [lx, ly] = polar(17, a - 13);
    const [rx, ry] = polar(17, a + 13);
    const [tx, ty] = polar(small ? 46 : 49, a);
    out.push(el('polygon', { points: `${pt(lx, ly)} ${pt(tx, ty)} ${pt(rx, ry)} 50,50`, fill: '#dff8ff', opacity: 0.6 }));
  }
  if (!small) {
    for (let i = 0; i < 4; i++) {
      for (const off of [-22, 22]) {
        const a = 45 + i * 90 + off;
        const [lx, ly] = polar(22, a - 5);
        const [rx, ry] = polar(22, a + 5);
        const [tx, ty] = polar(43, a);
        out.push(el('polygon', { points: `${pt(lx, ly)} ${pt(tx, ty)} ${pt(rx, ry)} 50,50`, fill: '#dff8ff', opacity: 0.32 }));
      }
    }
  }
  const D = 46;
  const G = 38;
  const T = 15;
  out.push(
    el('polygon', { points: rhombus(D, 3), fill: '#000', opacity: 0.42, strokeLinejoin: 'round', stroke: '#000', strokeWidth: 2 }),
    el('polygon', { points: rhombus(D), fill: 'url(#bezel)', stroke: '#1d4a66', strokeWidth: 2, strokeLinejoin: 'round' }),
    el('polygon', { points: rhombus(D - 1.6), fill: 'none', stroke: 'url(#bezelHl)', strokeWidth: small ? 1.6 : 1.1, strokeLinejoin: 'round' }),
    el('polygon', { points: rhombus(G + 1.2), fill: '#1d4a66', opacity: 0.8 }),
  );
  // gema: mesa (rombo chico) y 12 facetas, más claras arriba a la izquierda
  const N: [number, number] = [50, 50 - G];
  const E: [number, number] = [50 + G, 50];
  const S: [number, number] = [50, 50 + G];
  const W: [number, number] = [50 - G, 50];
  const n: [number, number] = [50, 50 - T];
  const e: [number, number] = [50 + T, 50];
  const s: [number, number] = [50, 50 + T];
  const w: [number, number] = [50 - T, 50];
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const quads: [[number, number], [number, number], [number, number], [number, number], string[]][] = [
    [N, n, w, W, ['#f2fdff', '#c9f2ff', '#a9e8ff']],
    [E, e, n, N, ['#56c4f5', '#7bd6fc', '#a2e6ff']],
    [S, s, e, E, ['#1677b8', '#2390d2', '#37a4e2']],
    [W, w, s, S, ['#8ddcff', '#4ab6ec', '#2b98d6']],
  ];
  const facet = { stroke: '#ffffff', strokeOpacity: small ? 0.3 : 0.5, strokeWidth: 0.5, strokeLinejoin: 'round' as const };
  for (const [A, a, b, B, col] of quads) {
    const M = mid(A, B);
    out.push(
      el('polygon', { points: `${pt(...A)} ${pt(...a)} ${pt(...M)}`, fill: col[0], ...facet }),
      el('polygon', { points: `${pt(...a)} ${pt(...b)} ${pt(...M)}`, fill: col[1], ...facet }),
      el('polygon', { points: `${pt(...b)} ${pt(...B)} ${pt(...M)}`, fill: col[2], ...facet }),
    );
  }
  out.push(el('polygon', { points: rhombus(T), fill: 'url(#tbl)', ...facet }));
  // reflejo sobre la mesa y destellos
  out.push(el('polygon', { points: `${pt(50, 50 - T + 2.5)} ${pt(50 - T + 2.5, 50)} ${pt(50 - 4, 50)} ${pt(50, 50 - 4)}`, fill: '#fff', opacity: 0.7 }));
  out.push(sparkle(37, 33, small ? 6 : 7.5, { fill: '#fff' }));
  if (!small) {
    out.push(sparkle(66, 63, 4, { fill: '#fff', opacity: 0.9 }));
    out.push(sparkle(79, 22, 3.2, { fill: '#fff', opacity: 0.85 }));
  }
  return out;
}

// ---------------------------------------------------------------- salida

const nodeCache = new Map<string, SvgNode>();
// sin `emblem`: no cambia el dibujo
const keyOf = (s: MedalSpec) => `${s.tier}.${s.step}.${s.small ? 1 : 0}`;

/** Árbol SVG de la medalla (raíz `svg` con viewBox 0 0 100 100). Se guarda en caché. */
export function medalNode(spec: MedalSpec): SvgNode {
  const key = keyOf(spec);
  let node = nodeCache.get(key);
  if (!node) {
    node = el('svg', { viewBox: '0 0 100 100' }, spec.tier === 'diamante' ? diamondMedal(spec) : roundMedal(spec));
    nodeCache.set(key, node);
  }
  return node;
}

// atributos que en SVG se escriben en camelCase
const CAMEL = new Set(['viewBox', 'gradientUnits', 'gradientTransform', 'clipPathUnits']);
const attrName = (k: string) => (CAMEL.has(k) ? k : k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()));

function toXml(n: SvgNode): string {
  const attrs = Object.entries(n.a)
    .map(([k, v]) => ` ${attrName(k)}="${v}"`)
    .join('');
  return n.c?.length ? `<${n.t}${attrs}>${n.c.map(toXml).join('')}</${n.t}>` : `<${n.t}${attrs}/>`;
}

/** SVG en texto, con tamaño en píxeles (para `<img>` y `<canvas>`). */
export function medalSvg(spec: MedalSpec, px: number): string {
  const root = medalNode(spec);
  return toXml({ ...root, a: { xmlns: 'http://www.w3.org/2000/svg', width: px, height: px, ...root.a } });
}

const uriCache = new Map<string, string>();

/** `data:image/svg+xml` de la medalla (sin tamaño fijo: escala con el `<img>`). */
export function medalDataUri(spec: MedalSpec): string {
  const key = keyOf(spec);
  let uri = uriCache.get(key);
  if (!uri) {
    const root = medalNode(spec);
    uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(toXml({ ...root, a: { xmlns: 'http://www.w3.org/2000/svg', ...root.a } }));
    uriCache.set(key, uri);
  }
  return uri;
}

/** Bajo este tamaño (px) se dibuja la versión simple. */
export const SMALL_MEDAL_PX = 30;

/**
 * Insignia de la tarjeta de compartir (en píxeles de la tarjeta de 1080): lado de la medalla,
 * distancia del centro a la línea base del nombre y tamaño de su letra. La usan `share.web.ts`
 * (canvas) y `ShareCardHost.native.tsx`, para que las dos tarjetas queden iguales.
 */
export const SHARE_BADGE = { box: 170, nameDy: 120, nameSize: 29 } as const;
