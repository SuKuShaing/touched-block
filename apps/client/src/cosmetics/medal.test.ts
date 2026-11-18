import { describe, expect, it } from 'vitest';
import { TIERS, type TierId } from '@tb/engine';
import { medalDataUri, medalNode, medalSvg, type MedalSpec, type SvgNode } from './medal';

const MATS: TierId[] = ['madera', 'bronce', 'plata', 'oro', 'diamante'];

/** Todas las variantes que dibuja la app: cada insignia y cada logro, en grande y en chico. */
const SPECS: MedalSpec[] = [];
for (const small of [false, true]) {
  for (const t of TIERS) SPECS.push({ tier: t.tier, step: t.step, emblem: 'tier', small });
  for (const m of MATS) SPECS.push({ tier: m, step: 1, emblem: 'star', small });
}

function walk(n: SvgNode, f: (n: SvgNode) => void) {
  f(n);
  n.c?.forEach((c) => walk(c, f));
}

// lo que dibuja MedalImage.native.tsx (react-native-svg); otra etiqueta no se vería en la app
const NATIVE_TAGS = new Set(['svg', 'circle', 'clipPath', 'defs', 'ellipse', 'g', 'line', 'linearGradient', 'path', 'polygon', 'radialGradient', 'rect', 'stop']);

describe('medallas', () => {
  it.each(SPECS.map((s) => [`${s.tier} ${s.step} ${s.emblem}${s.small ? ' chica' : ''}`, s]))('%s: SVG válido para web y app', (_, spec) => {
    const root = medalNode(spec as MedalSpec);
    expect(root.a.viewBox).toBe('0 0 100 100');
    const ids = new Set<string>();
    const refs: string[] = [];
    walk(root, (n) => {
      expect(NATIVE_TAGS.has(n.t)).toBe(true);
      // sin transformaciones ni filtros: se dibujan igual en todas partes
      expect(n.a.transform).toBeUndefined();
      expect(n.a.filter).toBeUndefined();
      for (const v of Object.values(n.a)) {
        expect(String(v)).not.toMatch(/NaN|undefined|Infinity/);
        const m = /^url\(#(\w+)\)$/.exec(String(v));
        if (m) refs.push(m[1]);
      }
      if (n.a.id !== undefined) {
        expect(ids.has(String(n.a.id))).toBe(false);
        ids.add(String(n.a.id));
      }
    });
    // cada degradado o recorte usado está definido
    for (const r of refs) expect(ids.has(r)).toBe(true);
  });

  it('las divisiones de Madera se distinguen', () => {
    const svgs = [1, 2, 3].map((step) => medalSvg({ tier: 'madera', step, emblem: 'tier', small: false }, 64));
    expect(new Set(svgs).size).toBe(3);
  });

  it('el texto SVG lleva tamaño y espacio de nombres; el data URI se guarda en caché', () => {
    const spec: MedalSpec = { tier: 'oro', step: 1, emblem: 'tier', small: false };
    const svg = medalSvg(spec, 150);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 100 100">')).toBe(true);
    expect(svg).toContain('stop-color=');
    expect(svg).toContain('clip-path="url(#fc)"');
    expect(medalDataUri(spec)).toBe(medalDataUri({ ...spec }));
  });
});
