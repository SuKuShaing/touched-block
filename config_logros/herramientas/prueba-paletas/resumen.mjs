// Lee vitest-<v>.json (resultado oficial de las aserciones del juego) y medidas-<v>.json (valores y márgenes),
// comprueba que coinciden y escribe resumen-<v>.md con la tabla paleta x regla.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const MAPA = [
  ['tiene 9 colores #rrggbb distintos', '9 colores #rrggbb distintos'],
  ['el tono de cada color SAFE está en el rango de la Clásica', 'tono SAFE en rango Clásica ±5°'],
  ['el caso más difícil de tono es tan difícil como en la Clásica', 'caso más difícil de tono'],
  ['en promedio, el tono no es más fácil ni más difícil que en la Clásica', 'media de tono'],
  ['el rojo de la trampa contrasta como en la Clásica', 'contraste rojo en rango Clásica'],
  ['el caso más difícil de contraste es tan difícil como en la Clásica', 'caso más difícil de contraste'],
  ['el texto blanco se lee igual o mejor', 'texto blanco ≥ Clásica'],
];
const f = (x, d = 3) => (Math.abs(x) >= 100 ? x.toFixed(1) : x.toFixed(d));

let todo = '';
for (const v of ['base', 'efectivo']) {
  const oficial = JSON.parse(fs.readFileSync(path.join(aqui, `vitest-${v}.json`), 'utf8'));
  const medidas = JSON.parse(fs.readFileSync(path.join(aqui, `medidas-${v}.json`), 'utf8'));
  const res = oficial.testResults[0].assertionResults;
  const estado = new Map(res.map((r) => [r.title, r.status]));
  let incoherencias = 0;
  let md = `### Corrida ${v}\n\nAserciones oficiales: ${oficial.numPassedTests} pasan, ${oficial.numFailedTests} fallan, de ${oficial.numTotalTests}.\n\n`;
  const globalDistinta = estado.get('cada paleta se ve distinta de las demás');
  md += `"cada paleta se ve distinta de las demás": ${globalDistinta}\n\n`;
  md += '| paleta | ' + MAPA.map((m) => m[1]).join(' | ') + ' | ΔE mín (informativo) |\n|---|' + MAPA.map(() => '---').join('|') + '|---|\n';
  const fallas = [];
  for (const [id, info] of Object.entries(medidas)) {
    if (!info.nueva) continue;
    const celdas = MAPA.map(([titulo, regla]) => {
      const st = estado.get(`${id}: ${titulo}`) ?? estado.get(`${id} ${titulo.replace(/^tiene /, 'tiene ')}`);
      const m = info.reglas.find((r) => r.regla === regla);
      const oficialOk = st === 'passed';
      if (st === undefined) return '?';
      if (oficialOk !== m.ok) incoherencias++;
      if (!oficialOk) fallas.push({ id, regla, m });
      return `${oficialOk ? 'pasa' : '**FALLA**'} (${f(m.margen)})`;
    });
    md += `| ${id} | ${celdas.join(' | ')} | ${f(info.deltaEMin, 1)} (${info.deltaEPar}) |\n`;
  }
  // las 8 reales: pasan todas?
  const reales = Object.entries(medidas).filter(([, i]) => !i.nueva);
  const realesFallan = res.filter((r) => reales.some(([id]) => r.title.startsWith(id + ':')) && r.status !== 'passed');
  md += `\nPaletas de hoy (${reales.map(([id]) => id).join(', ')}): ${realesFallan.length === 0 ? 'todas las aserciones pasan' : 'FALLAN ' + realesFallan.length}.\n`;
  md += `Coherencia medidas vs vitest: ${incoherencias === 0 ? 'OK (0 discrepancias)' : incoherencias + ' DISCREPANCIAS'}.\n\n`;
  md += '#### Fallas\n\n';
  for (const x of fallas) {
    md += `- ${x.id} · ${x.regla}: medido ${f(x.m.valor)} vs umbral ${x.m.umbral}; margen ${f(x.m.margen)} (${x.m.donde})\n`;
  }
  fs.writeFileSync(path.join(aqui, `resumen-${v}.md`), md);
  todo += md + '\n';
}
console.log(todo);
