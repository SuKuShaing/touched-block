// No es una prueba del juego: vuelca a medidas-fondos.json los valores y márgenes de las reglas de palettes.test.ts para cada caso
// de candidatas-fondos.json (usa evaluar() de ../prueba-paletas/reglas.ts, con las funciones reales del juego).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { it } from 'vitest';
import { evaluar } from '../prueba-paletas/reglas';

it('medir paletas sobre fondos', () => {
  const j = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./candidatas-fondos.json', import.meta.url)), 'utf8'));
  const casos = j.casos.map((c: { fondo: string; bg: string; paleta: string; colores: string[] }) => ({ ...c, reglas: evaluar(c.colores) }));
  const opacas = Object.entries(j.opacas as Record<string, string[]>).map(([paleta, colores]) => ({ paleta, reglas: evaluar(colores) }));
  fs.writeFileSync(fileURLToPath(new URL('./medidas-fondos.json', import.meta.url)), JSON.stringify({ casos, opacas }, null, 2));
});
