import { describe, expect, it } from 'vitest';
import { TIERS } from '@tb/engine';
import { medalDataUri, medalNode, medalSvg, type MedalSpec, type SvgNode } from './medal';

// fs de Node sin depender de @types/node (el cliente no los tiene); vitest corre en apps/client
const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(path: string, enc: 'utf8'): string };

/** Todas las variantes que dibuja la app: cada insignia, en grande y en chico. */
const SPECS: MedalSpec[] = [false, true].flatMap((small) => TIERS.map((t) => ({ tier: t.tier, step: t.step, small })));

function walk(n: SvgNode, f: (n: SvgNode) => void) {
  f(n);
  n.c?.forEach((c) => walk(c, f));
}

// lo que dibuja MedalImage.native.tsx (react-native-svg); otra etiqueta no se vería en la app
const NATIVE_TAGS = new Set(['svg', 'circle', 'clipPath', 'defs', 'ellipse', 'g', 'line', 'linearGradient', 'path', 'polygon', 'radialGradient', 'rect', 'stop']);

/**
 * El SVG como lista de etiquetas comparable: atributos en orden alfabético y números a 2 decimales;
 * sin el espacio de nombres ni el tamaño de la raíz.
 */
function canonical(svg: string): string[] {
  return [...svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)].map(([, closing, tag, rawAttrs, selfClosing]) => {
    const attrs = [...rawAttrs.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)]
      .filter(([, name]) => !(tag === 'svg' && ['xmlns', 'width', 'height'].includes(name)))
      .map(([, name, value]) => `${name}=${/^-?\d+(\.\d+)?$/.test(value) ? Math.round(Number(value) * 100) / 100 : value}`)
      .sort();
    return [closing + tag + selfClosing, ...attrs].join(' ');
  });
}

describe('medallas', () => {
  it.each(SPECS.map((s) => [`${s.tier} ${s.step}${s.small ? ' chica' : ''}`, s]))('%s: SVG válido para web y app', (_, spec) => {
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

  const NEW_DESIGNS = [
    ['Papel', 1],
    ['Cartón', 2],
    ['Madera', 3],
  ] as const;

  it.each(NEW_DESIGNS.flatMap(([name, step]) => [false, true].map((small) => [`${name}${small ? ' chica' : ''}`, step, small] as const)))(
    '%s: igual al diseño de referencia',
    (_, step, small) => {
      const reference = fs.readFileSync(`../../config_logros/insignias_nuevas/madera-${step}${small ? '-small' : ''}.svg`, 'utf8');
      expect(canonical(medalSvg({ tier: 'madera', step, small }, 120))).toEqual(canonical(reference));
    },
  );

  it('Papel, Cartón y Madera se distinguen, en grande y en chico', () => {
    for (const small of [false, true]) {
      const svgs = NEW_DESIGNS.map(([, step]) => medalSvg({ tier: 'madera', step, small }, 64));
      expect(new Set(svgs).size).toBe(3);
    }
  });

  it('el texto SVG lleva tamaño y espacio de nombres; el data URI se guarda en caché', () => {
    const spec: MedalSpec = { tier: 'oro', step: 1, small: false };
    const svg = medalSvg(spec, 150);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 100 100">')).toBe(true);
    expect(svg).toContain('stop-color=');
    expect(svg).toContain('clip-path="url(#fc)"');
    expect(medalDataUri(spec)).toBe(medalDataUri({ ...spec }));
  });
});
