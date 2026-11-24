// Muestrea los colores REALMENTE dibujados de cada fondo (con sus patrones, brillos y animación congelada en un cuadro) a partir de una
// captura de pantalla, para comprobar lo que de verdad queda bajo un bloque translúcido (no solo el color base).
// Uso: node muestrear.mjs <captura.png> <celdas.json> [lado=14]
//   captura.png  captura de la web con los campos de los fondos SIN bloques (ver README.md, "Muestreo")
//   celdas.json  [{ "id": "oceano", "x": 6, "y": 6, "w": 290, "h": 200 }, ...] en píxeles CSS de la captura (escala 1)
// Para cada celda toma una rejilla de 8 × 10 ventanas de `lado` × `lado` px, promedia cada una (lo que ve un bloque, no un píxel suelto)
// y escribe muestras.json: { id: ["#rrggbb", ...] }.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const [, , png, celdasJson, ladoArg] = process.argv;
const lado = Number(ladoArg || 14);

function leerPng(archivo) {
  const b = fs.readFileSync(archivo);
  let p = 8;
  let w = 0, h = 0, tipo = 0, prof = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const t = b.toString('latin1', p + 4, p + 8);
    const d = b.subarray(p + 8, p + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); prof = d[8]; tipo = d[9]; if (d[12] !== 0) throw new Error('PNG entrelazado'); }
    if (t === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (prof !== 8 || (tipo !== 2 && tipo !== 6)) throw new Error('solo PNG RGB/RGBA de 8 bits');
  const bpp = tipo === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const fila = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const up = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = fila[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}

const img = leerPng(png);
const celdas = JSON.parse(fs.readFileSync(celdasJson, 'utf8'));
const hex = (v) => '#' + v.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
const salida = {};
for (const c of celdas) {
  const lista = [];
  for (let j = 0; j < 10; j++) {
    for (let i = 0; i < 8; i++) {
      const cx = Math.round(c.x + ((i + 0.5) / 8) * c.w);
      const cy = Math.round(c.y + ((j + 0.5) / 10) * c.h);
      const s = [0, 0, 0];
      let n = 0;
      for (let y = cy - lado / 2; y < cy + lado / 2; y++)
        for (let x = cx - lado / 2; x < cx + lado / 2; x++) {
          if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
          const o = (Math.floor(y) * img.w + Math.floor(x)) * img.bpp;
          s[0] += img.px[o]; s[1] += img.px[o + 1]; s[2] += img.px[o + 2];
          n++;
        }
      lista.push(hex(s.map((v) => v / n)));
    }
  }
  salida[c.id] = lista;
}
fs.writeFileSync(path.join(aqui, 'muestras.json'), JSON.stringify(salida, null, 1));
console.log('ok', Object.keys(salida).map((k) => `${k}:${new Set(salida[k]).size}`).join(' '));
