// Prueba de paletas con los fondos nuevos (CAMBIO-022). No toca el juego ni la carpeta prueba-paletas.
//
// Las reglas de apps/client/src/cosmetics/palettes.test.ts miden la trampa roja #ff2a2a y el texto blanco contra el COLOR DEL BLOQUE.
// Desde 2026-11-26 (alternativa A) las tres paletas translúcidas, Cristal (relleno 50 %), Contorno (55 %) y Esmerilado (capa al 70 %
// + brillo central 0,117), se dibujan sobre un respaldo opaco: su color efectivo ya no depende del fondo, igual que en las opacas.
// Por eso basta medir las 14 paletas una vez. El respaldo se lee de preview.css y se comprueba que las tres lo usen.
//
// Uso: node generar.mjs  -> candidatas-fondos.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(aqui, '..', '..', 'coleccion.js'), 'utf8');
const css = fs.readFileSync(path.resolve(aqui, '..', '..', 'preview.css'), 'utf8');

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

const respaldo = (css.match(/--respaldo:\s*(#[0-9a-f]{6})/i) || [])[1];
if (!respaldo) throw new Error('preview.css no define --respaldo');
for (const estilo of ['vpCristal', 'vpContorno', 'vpEsmerilado']) {
  const regla = css.match(new RegExp(`\\.${estilo} \\.vpBq \\{([^}]*)\\}`));
  if (!regla || !/background:[^;]*var\(--respaldo\);/.test(regla[1])) throw new Error(`.${estilo} .vpBq no dibuja el respaldo`);
}

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

/** Color que de verdad queda bajo el número en cada casilla. */
const efectivos = (p) => {
  if (p.id === 'cristal' || p.id === 'contorno') return p.colores.map((c) => sobre(c, p.relleno, respaldo));
  if (p.id === 'esmerilado') return p.colores.map((c) => esmeriladoEfectivo(c, respaldo));
  return p.colores.slice();
};

const paletas = PALETAS.map((p) => ({ id: p.id, estilo: p.estilo || 'plano', colores: efectivos(p) }));
const fondos = [{ id: 'liso', n: 'Liso', prueba: ['#12121a'] }, ...FONDOS.filter((f) => f.nuevo).map(({ id, n, prueba }) => ({ id, n, prueba }))];
fs.writeFileSync(path.join(aqui, 'candidatas-fondos.json'), JSON.stringify({ respaldo, fondos, paletas }, null, 2) + '\n');
console.log(`ok: ${paletas.length} paletas, respaldo ${respaldo}`);
