// Prueba de paletas sobre los fondos nuevos (CAMBIO-022). No toca el juego ni la carpeta prueba-paletas.
//
// Qué mide: las reglas de apps/client/src/cosmetics/palettes.test.ts (la trampa roja #ff2a2a y el texto blanco contra el COLOR DEL BLOQUE).
// El fondo del campo NO entra en esas reglas mientras el bloque es opaco (Clásica, Alto contraste, Pastel, Neón, Retro, Dorado, Diamante,
// Constancia, Tenue, Degradé, Botón): su color es el mismo sobre cualquier fondo. Solo cambia el color efectivo de las tres paletas
// translúcidas, que dejan pasar lo que hay detrás: Cristal (50 %), Contorno (55 %) y Esmerilado (capa al 70 % + brillo central 0,117).
// Por eso, para cada fondo se recalcula el color efectivo de esas tres sobre cada color de `prueba` del fondo (el principal y los extremos
// de su degradé), con las mismas fórmulas de herramientas/prueba-paletas/generar-candidatas.mjs, y se pasan por `evaluar` (reglas.ts de
// prueba-paletas, que repite las aserciones reales y está verificada contra vitest: 0 discrepancias).
//
// Uso: node generar.mjs  -> candidatas-fondos.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(aqui, '..', '..', 'coleccion.js'), 'utf8');

function extraer(desde, hasta, nombre) {
  const i = src.indexOf(desde);
  const j = src.indexOf(hasta, i);
  if (i < 0 || j < 0) throw new Error('No se encontró ' + desde);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src.slice(i, j) + `\nthis.X = ${nombre};`, ctx);
  return ctx.X;
}
const PALETAS = extraer('const CLASICA', '// Valores por defecto', 'PALETAS');
const FONDOS = extraer('const FONDOS = [', '/** Los fondos que existen', 'FONDOS');

const BG_JUEGO = '#12121a';
const aRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const aHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mezclar = (hex, destino, t) => aHex(aRgb(hex).map((v, i) => Math.round(v * (1 - t) + destino[i] * t)));
const sobre = (hex, a, fondo) => mezclar(fondo, aRgb(hex), a);
const esmeriladoEfectivo = (hex, fondo) => {
  const capa = mezclar('#dde8ff', aRgb(hex), 0.35);
  return mezclar(sobre(capa, 0.7, fondo), [255, 255, 255], 0.117);
};
const por = (id) => PALETAS.find((p) => p.id === id);

const traslucidas = {
  cristal: (fondo) => por('cristal').colores.map((c) => sobre(c, por('cristal').relleno, fondo)),
  contorno: (fondo) => por('contorno').colores.map((c) => sobre(c, por('contorno').relleno, fondo)),
  esmerilado: (fondo) => por('esmerilado').colores.map((c) => esmeriladoEfectivo(c, fondo)),
};

const fondos = [{ id: 'liso', n: 'Liso (referencia de hoy)', prueba: [BG_JUEGO] }, ...FONDOS.filter((f) => f.nuevo)];
const casos = [];
for (const f of fondos) {
  for (const bg of f.prueba) {
    for (const [pid, fn] of Object.entries(traslucidas)) casos.push({ fondo: f.id, bg, paleta: pid, colores: fn(bg) });
  }
}
// Control: las opacas no dependen del fondo; se miden una sola vez (en la prueba de paletas ya pasan; aquí se confirma con la misma función).
const opacas = {};
for (const p of PALETAS) {
  if (['cristal', 'contorno', 'esmerilado'].includes(p.id)) continue;
  opacas[p.id] = p.colores.slice();
}
fs.writeFileSync(path.join(aqui, 'candidatas-fondos.json'), JSON.stringify({ fondos: fondos.map(({ id, n, prueba }) => ({ id, n, prueba })), casos, opacas }, null, 2) + '\n');
console.log(`ok: ${casos.length} casos translúcidos + ${Object.keys(opacas).length} paletas opacas de control`);
