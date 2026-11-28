import { describe, expect, it } from 'vitest';
import { achievementIconDataUri, achievementIconSvg } from './achievementIcon';

// Los 32 diseños de referencia, como texto. El tipo se declara aquí porque el cliente no carga los
// tipos de Vite ni de Node.
declare global {
  interface ImportMeta {
    glob(pattern: string, options: { query: '?raw'; import: 'default'; eager: true }): Record<string, string>;
  }
}
const files = import.meta.glob('../../../../config_logros/logros_iconos/*.svg', { query: '?raw', import: 'default', eager: true });

const IDS = ['racha', 'partidas', 'diasReto', 'mejorReto'] as const;
const MATERIALS = ['vacio', 'papel', 'carton', 'madera', 'bronce', 'plata', 'oro', 'diamante'];
const CASES = IDS.flatMap((id) => MATERIALS.map((material, level) => ({ id, material, level })));

/** Sin el tamaño del `<svg>` raíz ni diferencias de espacios. */
const normalize = (svg: string) =>
  svg
    .replace(/^(<svg\b[^>]*?) width="[^"]*" height="[^"]*"/, '$1')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();

const idsOf = (svg: string) => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);

describe('iconos de logros', () => {
  it('hay una referencia por cada logro y material', () => {
    expect(Object.keys(files)).toHaveLength(CASES.length);
  });

  it.each(CASES)('$id $material coincide con la referencia', ({ id, material, level }) => {
    const reference = files[`../../../../config_logros/logros_iconos/${id}-${material}.svg`];
    expect(reference).toBeDefined();
    expect(normalize(achievementIconSvg(id, level, 120))).toBe(normalize(reference));
  });

  it('los ids no se repiten entre los 32 y cada url(#…) apunta a uno propio', () => {
    const all: string[] = [];
    for (const { id, level } of CASES) {
      const svg = achievementIconSvg(id, level, 38);
      const own = idsOf(svg);
      all.push(...own);
      for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(own).toContain(m[1]);
      expect(svg).not.toMatch(/NaN|undefined|Infinity| transform=| filter=/);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it('lleva el tamaño pedido; fuera de 1 a 7 es el vacío', () => {
    expect(achievementIconSvg('racha', 3, 74).startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="74" height="74" viewBox="0 0 100 100">')).toBe(true);
    for (const level of [-1, 8, NaN]) expect(achievementIconSvg('racha', level, 38)).toBe(achievementIconSvg('racha', 0, 38));
  });

  it('el data URI es el mismo dibujo, sin tamaño fijo', () => {
    const uri = achievementIconDataUri('partidas', 6);
    expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
    expect(svg).toBe(achievementIconSvg('partidas', 6, 38).replace(' width="38" height="38"', ''));
    expect(achievementIconDataUri('partidas', 6)).toBe(uri);
  });
});
