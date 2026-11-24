// Lee medidas-fondos.json y escribe RESULTADOS-FONDOS.md: por cada fondo y paleta translúcida, si pasa las reglas de palettes.test.ts
// con el color efectivo sobre cada color de prueba del fondo, y el margen más justo de cada regla (positivo = sobra).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const { casos, opacas } = JSON.parse(fs.readFileSync(path.join(aqui, 'medidas-fondos.json'), 'utf8'));
const cand = JSON.parse(fs.readFileSync(path.join(aqui, 'candidatas-fondos.json'), 'utf8'));
const f = (x) => (x >= 0 ? '+' : '') + x.toFixed(Math.abs(x) >= 10 ? 1 : 3).replace('.', ',');
const REGLAS = ['tono SAFE en rango Clásica ±5°', 'caso más difícil de tono', 'media de tono', 'contraste rojo en rango Clásica', 'caso más difícil de contraste', 'texto blanco ≥ Clásica', '9 colores #rrggbb distintos'];
const CORTO = ['tono rango', 'tono difícil', 'tono media', 'rojo rango', 'rojo difícil', 'blanco', '9 distintos'];

let md = '# Paletas sobre los fondos nuevos (CAMBIO-022)\n\nGenerado por `correr.sh` (`bash config_logros/herramientas/prueba-fondos/correr.sh`; no toca el juego ni `prueba-paletas`, solo importa su `reglas.ts`). Margen = lo que sobra (negativo = lo que falta). Para cada fondo se toma el peor caso entre sus colores de prueba (`prueba` de `FONDOS` en `coleccion.js`: el color principal y los extremos del degradé).\n\nOtras piezas: `barrido.spec.ts` (qué fondos dejan pasar a las tres translúcidas, escribe `barrido.json`), `ajustar.spec.ts` + `deseados.json` (cuánto oscurecer un color para que pase, escribe `ajustes.json`) y, para el muestreo del final, `muestrear.mjs` (lee una captura PNG de los campos sin bloques y un JSON con sus celdas) + `muestras.spec.ts`.\n\n';
md += '## Opacas (control: no dependen del fondo)\n\n';
const opFallan = opacas.filter((o) => o.reglas.some((r) => !r.ok));
md += opFallan.length === 0 ? `Las ${opacas.length} paletas opacas (${opacas.map((o) => o.paleta).join(', ')}) pasan todas las reglas. Su color es el mismo sobre cualquier fondo.\n\n` : 'FALLAN: ' + opFallan.map((o) => o.paleta).join(', ') + '\n\n';

md += '## Translúcidas sobre cada fondo\n\n| fondo | colores de prueba | paleta | ' + CORTO.join(' | ') + ' |\n|---|---|---|' + CORTO.map(() => '---').join('|') + '|\n';
const filas = [];
for (const fo of cand.fondos) {
  for (const paleta of ['cristal', 'contorno', 'esmerilado']) {
    const cs = casos.filter((c) => c.fondo === fo.id && c.paleta === paleta);
    const celdas = REGLAS.map((r) => {
      const ms = cs.map((c) => c.reglas.find((x) => x.regla === r));
      const peor = ms.reduce((a, b) => (b.margen < a.margen ? b : a));
      const ok = ms.every((m) => m.ok);
      return { ok, txt: (ok ? 'pasa ' : '**FALLA** ') + (r.startsWith('9') ? '' : f(peor.margen)) };
    });
    filas.push({ fondo: fo.id, paleta, celdas });
    md += `| ${fo.id} | ${fo.prueba.join(' ')} | ${paleta} | ${celdas.map((c) => c.txt).join(' | ')} |\n`;
  }
}
const fallas = filas.filter((x) => x.celdas.some((c) => !c.ok));
md += `\n**${filas.length - fallas.length} de ${filas.length} combinaciones pasan todas las reglas.**` + (fallas.length ? ' Fallan: ' + fallas.map((x) => `${x.fondo}/${x.paleta}`).join(', ') + '.' : '') + '\n';

// margen más justo por paleta translúcida, entre todos los fondos
md += '\n## Margen más justo de cada regla por paleta (entre todos los fondos)\n\n| paleta | regla | margen | fondo |\n|---|---|---|---|\n';
for (const paleta of ['cristal', 'contorno', 'esmerilado']) {
  for (const r of ['contraste rojo en rango Clásica', 'caso más difícil de contraste', 'caso más difícil de tono', 'texto blanco ≥ Clásica']) {
    let mejor = null;
    for (const c of casos.filter((x) => x.paleta === paleta)) {
      const m = c.reglas.find((x) => x.regla === r);
      if (!mejor || m.margen < mejor.m.margen) mejor = { m, c };
    }
    md += `| ${paleta} | ${r} | ${f(mejor.m.margen)} | ${mejor.c.fondo} (${mejor.c.bg}) |\n`;
  }
}
// colores realmente dibujados (muestrear.mjs + muestras.spec.ts), si existen
const ruta = path.join(aqui, 'medidas-muestras.json');
if (fs.existsSync(ruta)) {
  const ms = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  md += '\n## Colores realmente dibujados (muestreo de una captura)\n\nSe toman 80 ventanas de 30 × 30 px por fondo (patrones, brillos y un cuadro de la animación incluidos) y se mide Cristal / Contorno / Esmerilado sobre el promedio de cada ventana. Cada celda es `ventanas que fallan / 80`.\n\n| fondo | cristal | contorno | esmerilado |\n|---|---|---|---|\n';
  for (const [fo, ps] of Object.entries(ms)) md += `| ${fo} | ${ps.cristal.fallan} / ${ps.cristal.total} | ${ps.contorno.fallan} / ${ps.contorno.total} | ${ps.esmerilado.fallan} / ${ps.esmerilado.total} |\n`;
}
fs.writeFileSync(path.join(aqui, 'RESULTADOS-FONDOS.md'), md);
console.log(md);
