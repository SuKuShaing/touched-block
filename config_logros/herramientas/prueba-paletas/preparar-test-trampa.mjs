// Genera contorno-trampa.test.ts desde el palettes.test.ts REAL con cambios mínimos para que el rojo de la trampa y
// el color del número puedan ser DISTINTOS por paleta (hoy son globales: C.trapNumber y C.text). Los umbrales y las
// referencias de la Clásica no cambian (se calculan con el rojo/blanco reales); solo las paletas candidatas usan su
// propio rojo/número. Ninguna aserción se relaja.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const real = path.resolve(aqui, '..', '..', '..', 'apps', 'client', 'src', 'cosmetics', 'palettes.test.ts');
let t = fs.readFileSync(real, 'utf8').replace(/\r\n/g, '\n');
const cambiar = (de, a, minimo = 1) => {
  const n = t.split(de).length - 1;
  if (n < minimo) throw new Error(`No se encontró (${n}): ${de}`);
  t = t.split(de).join(a);
};
cambiar("import {\n  PALETTE_IDS,\n  PALETTES,\n  contrastRatio,", "import {\n  PALETTES as PALETTES_REALES,\n  contrastRatio,");
cambiar("} from './palettes';", "} from '@/cosmetics/palettes';\nimport { PALETTES, PALETTE_IDS, TRAP_OF, NUM_OF } from './candidatas-trampa';");
cambiar("const redVsSafe = (colors: readonly string[]) => SAFE_POS.map((i) => contrastRatio(TRAP_RED, colors[i]));", "const redVsSafe = (colors: readonly string[], red: string = TRAP_RED) => SAFE_POS.map((i) => contrastRatio(red, colors[i]));");
cambiar("const hueVsSafe = (colors: readonly string[]) => SAFE_POS.map((i) => hueDistance(TRAP_RED, colors[i]));", "const hueVsSafe = (colors: readonly string[], red: string = TRAP_RED) => SAFE_POS.map((i) => hueDistance(red, colors[i]));");
cambiar("hueVsSafe(PALETTES[id].colors)", "hueVsSafe(PALETTES[id].colors, TRAP_OF[id] ?? TRAP_RED)", 3);
cambiar("redVsSafe(PALETTES[id].colors)", "redVsSafe(PALETTES[id].colors, TRAP_OF[id] ?? TRAP_RED)", 2);
cambiar("expect(contrastRatio(WHITE, c)).toBeGreaterThanOrEqual(CLASSIC_WHITE_MIN)", "expect(contrastRatio(NUM_OF[id] ?? WHITE, c)).toBeGreaterThanOrEqual(CLASSIC_WHITE_MIN)");

const cab = `// ARCHIVO GENERADO por preparar-test-trampa.mjs a partir de apps/client/src/cosmetics/palettes.test.ts.
// Cambios: (1) las paletas salen de ./candidatas-trampa; (2) rojo de trampa y color del número pueden ser por paleta
// (TRAP_OF / NUM_OF); los umbrales y las referencias de la Clásica no se tocan. No editar a mano.
`;
fs.writeFileSync(path.join(aqui, 'contorno-trampa.test.ts'), cab + t);
console.log('ok: contorno-trampa.test.ts');
