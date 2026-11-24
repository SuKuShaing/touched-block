// Lee PALETAS de config_logros/coleccion.js (sin copiar los hex a mano) y genera candidatas.json
// con las dos corridas de la prueba de paletas:
//   base      = los 9 hex `colores` tal cual (corrida a)
//   efectivo  = el color que queda bajo el número según cambios.md (corrida b)
// Uso: node generar-candidatas.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuente = path.resolve(aqui, '..', '..', 'coleccion.js');
const src = fs.readFileSync(fuente, 'utf8');

// Extrae solo `const CLASICA = ...; const PALETAS = [...];` (hasta el comentario de valores por defecto).
const ini = src.indexOf('const CLASICA');
const fin = src.indexOf('// Valores por defecto');
if (ini < 0 || fin < 0) throw new Error('No se encontró const CLASICA / "Valores por defecto" en coleccion.js');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(ini, fin) + '\nthis.PALETAS = PALETAS;', ctx);
const PALETAS = ctx.PALETAS;

// --- Fórmulas de cambios.md (las mismas de coleccion.js) ---
const BG = '#12121a'; // theme.ts C.bg
const aRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const aHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** mezcla por canal en sRGB, redondeada (igual que mezclarHex de coleccion.js) */
const mezclar = (hex, destino, t) => aHex(aRgb(hex).map((v, i) => Math.round(v * (1 - t) + destino[i] * t)));
/** color con opacidad `a` sobre el fondo `fondo` */
const sobre = (hex, a, fondo = BG) => mezclar(fondo, aRgb(hex), a);

const DEGRADE_MEZCLA = 0.035;
const degradeTonos = (hex) => [mezclar(hex, [255, 255, 255], DEGRADE_MEZCLA), mezclar(hex, [0, 0, 0], DEGRADE_MEZCLA)];
const ESM_BASE = '#dde8ff';
const ESM_TINTE = 0.35;
const ESM_OPACIDAD = 0.7;
const ESM_BRILLO_CENTRO = 0.117; // blanco al centro del bloque (cambios.md CAMBIO-019-A)
const esmeriladoEfectivo = (hex) => {
  const capa = mezclar(ESM_BASE, aRgb(hex), ESM_TINTE);
  const sobreFondo = sobre(capa, ESM_OPACIDAD);
  return mezclar(sobreFondo, [255, 255, 255], ESM_BRILLO_CENTRO);
};

const por = (id) => {
  const p = PALETAS.find((x) => x.id === id);
  if (!p) throw new Error('No existe la paleta ' + id);
  return p;
};
const cristal = por('cristal');
const contorno = por('contorno');
const degrade = por('degrade');
const tenue = por('tenue');
const boton = por('boton');
const esmerilado = por('esmerilado');

// Valores efectivos documentados en cambios.md, para comprobar que la fórmula reproduce lo que dice el documento.
const DOC = {
  cristal: '#895968 #896552 #897440 #53816e #4c6f8d #5d5d8d #89577d #417b75 #6d578d',
  contorno55: '#943248 #94541d #94740c #168759 #286998 #655d98 #942b6f #088379 #7d5198',
  esmerilado: '#b08995 #a7908e #a9a18d #85a9a3 #8ba0c0 #9796ba #b183ab #82aab6 #988bba',
};

const efectivo = {
  cristal: cristal.colores.map((c) => sobre(c, cristal.relleno)),
  contorno: contorno.colores.map((c) => sobre(c, contorno.relleno)), // relleno 0 = lo que hoy dibuja la web: todo es el fondo
  contorno55: contorno.colores.map((c) => sobre(c, 0.55)), // variante recomendada en cambios.md (decisión 1)
  degrade: degrade.colores.slice(),
  'degrade-arriba': degrade.colores.map((c) => degradeTonos(c)[0]),
  'degrade-abajo': degrade.colores.map((c) => degradeTonos(c)[1]),
  tenue: tenue.colores.slice(), // relleno opaco; el borde (Clásica) no queda bajo el número
  boton: boton.colores.slice(), // opaco; las sombras interiores quedan fuera del número
  esmerilado: PALETAS.find((p) => p.id === 'esmerilado').colores.map(esmeriladoEfectivo),
};

const comprobacion = {};
for (const k of Object.keys(DOC)) {
  const doc = DOC[k].split(' ');
  comprobacion[k] = { calculado: efectivo[k].join(' '), documentado: DOC[k], coincide: efectivo[k].every((c, i) => c === doc[i]) };
}

const salida = {
  fuente: 'config_logros/coleccion.js',
  sha1Fuente: crypto.createHash('sha1').update(src).digest('hex'),
  fondo: BG,
  base: Object.fromEntries(
    ['cristal', 'contorno', 'degrade', 'tenue', 'boton', 'esmerilado'].map((id) => [id, por(id).colores.slice()]),
  ),
  efectivo,
  comprobacion,
};
fs.writeFileSync(path.join(aqui, 'candidatas.json'), JSON.stringify(salida, null, 2) + '\n');
console.log(JSON.stringify({ sha1Fuente: salida.sha1Fuente, comprobacion }, null, 2));
