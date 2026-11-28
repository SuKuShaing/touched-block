// Lee medidas-fondos.json y escribe RESULTADOS-FONDOS.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const m = JSON.parse(fs.readFileSync(path.join(aqui, 'medidas-fondos.json'), 'utf8'));
const cand = JSON.parse(fs.readFileSync(path.join(aqui, 'candidatas-fondos.json'), 'utf8'));
const n = (x, d = 2) => x.toFixed(d).replace('.', ',');
const mas = (x) => (x >= 0 ? '+' : '') + n(x, Math.abs(x) >= 10 ? 1 : 3);
const CORTO = {
  'tono SAFE en rango Clásica ±5°': 'tono rango',
  'caso más difícil de tono': 'tono difícil',
  'media de tono': 'tono media',
  'contraste rojo en rango Clásica': 'rojo rango',
  'caso más difícil de contraste': 'rojo difícil',
  'texto blanco ≥ Clásica': 'blanco',
  '9 colores #rrggbb distintos': '9 distintos',
};

const totalFondos = m.fondos.filter((f) => f.dibujado).length;

let md = `# Fondos nuevos y paletas (CAMBIO-022 y 026)

Generado por \`correr.sh\` (\`bash config_logros/herramientas/prueba-fondos/correr.sh\`; no toca el juego ni \`prueba-paletas\`, solo importa su \`reglas.ts\`).

## 1. Reglas de no ventaja (trampa roja ${m.trampa} y texto blanco)

Se miden contra el color del bloque. Cristal, Contorno y Esmerilado se dibujan sobre un respaldo opaco \`${cand.respaldo}\`, así que **ningún color de bloque depende del fondo**: el resultado vale para los ${totalFondos} fondos. Margen = lo que sobra (negativo = lo que falta).

| paleta | ${Object.values(CORTO).join(' | ')} |
|---|${Object.values(CORTO).map(() => '---').join('|')}|
`;
for (const p of m.paletas) {
  const celdas = Object.keys(CORTO).map((r) => {
    const x = p.reglas.find((y) => y.regla === r);
    return (x.ok ? 'pasa' : '**FALLA**') + (r.startsWith('9') ? '' : ' ' + mas(x.margen));
  });
  md += `| ${p.id} | ${celdas.join(' | ')} |\n`;
}
const fallan = m.paletas.filter((p) => p.reglas.some((r) => !r.ok));
md += `\n**${m.paletas.length - fallan.length} de ${m.paletas.length} paletas pasan todas las reglas.**${fallan.length ? ' Fallan: ' + fallan.map((p) => p.id).join(', ') + '.' : ''}\n`;

md += `
## 2. Los bloques contra cada fondo

Esto **no es una regla del juego**: es una medida propia para comprobar que los bloques se recortan. Para cada fondo se compara cada una de las 14 × 9 casillas (color de relleno, sin contar bordes ni sombra) con lo dibujado (336 ventanas de 14 × 14 px de una captura del campo sin bloques, \`muestras.json\`; las animaciones quedan en un cuadro) y se anota el caso más justo. ΔE = diferencia de color CIEDE2000 (0 = iguales; sobre unas 10 se ven claramente distintos). Contraste = WCAG (1 = misma claridad).

| fondo | ΔE mínimo | casilla y color de fondo | contraste mínimo | casilla y color de fondo | ventanas con ΔE < 10 | ventanas rojas |
|---|---|---|---|---|---|---|
`;
for (const f of m.fondos) {
  const d = f.dibujado;
  if (!d) continue;
  md += `| ${f.id} | ${n(d.deltaE.v, 1)} | ${d.deltaE.bloque} sobre ${d.deltaE.fondo} | ${n(d.contraste.v)} | ${d.contraste.bloque} sobre ${d.contraste.fondo} | ${d.justas} / ${d.total} | ${d.rojas} / ${d.total} |\n`;
}
md += `
"Ventanas con ΔE < 10" = trozos del fondo donde al menos una de las 126 casillas queda por debajo de 10. "Ventana roja" = tono a 15° o menos del rojo puro, saturación ≥ 0,35 y luminosidad ≥ 0,12.

## 3. El rojo de las trampas contra cada fondo

El número rojo siempre va **sobre el bloque**, nunca sobre el fondo; esto solo comprueba que ningún fondo sea parecido a ese rojo.

| fondo | ΔE mínimo con ${m.trampa} | color de fondo | contraste mínimo | color de fondo |
|---|---|---|---|---|
`;
for (const f of m.fondos) {
  const d = f.dibujado;
  if (!d) continue;
  md += `| ${f.id} | ${n(d.rojoDeltaE.v, 1)} | ${d.rojoDeltaE.fondo} | ${n(d.rojoContraste.v)} | ${d.rojoContraste.fondo} |\n`;
}
md += `
## 4. Regla REDDISH

\`REDDISH\` (${m.reddish.join(', ')}) es una lista de **colores de bloque** del motor: si al bloque le toca uno de ellos, una trampa roja usa la paleta \`SAFE\`. El motor no conoce el fondo del campo, así que ningún fondo la activa ni la desactiva.

## Cómo repetir el muestreo

Las secciones 2 y 3 usan \`muestras.json\`. Si cambia el dibujo de un fondo: captura a escala 1 los campos que cambiaron, sin bloques ni rótulos (unos 230 × 560 px cada uno), anota sus celdas (\`[{ "id", "x", "y", "w", "h" }]\`), corre \`node muestrear.mjs <captura.png> <celdas.json>\` y luego \`correr.sh\`.

Control de la fórmula ΔE: negro–blanco ${n(m.formula.negroBlanco, 1)}, color consigo mismo ${n(m.formula.igual, 1)}, rojo–verde puros ${n(m.formula.rojoVerde, 1)}.
`;
fs.writeFileSync(path.join(aqui, 'RESULTADOS-FONDOS.md'), md);
console.log(md);
