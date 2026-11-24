// Genera palettes.candidatas.test.ts a partir del palettes.test.ts REAL del juego, con solo dos cambios:
//   1. importa desde el archivo real (alias `@/cosmetics/palettes`) y renombra PALETTES -> PALETTES_REALES;
//   2. define PALETTES / PALETTE_IDS = las 8 de hoy + las candidatas de la variante elegida (TB_VARIANTE).
// No toca ninguna aserción ni umbral: todo el resto del archivo es idéntico.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const real = path.resolve(aqui, '..', '..', '..', 'apps', 'client', 'src', 'cosmetics', 'palettes.test.ts');
let t = fs.readFileSync(real, 'utf8').replace(/\r\n/g, '\n');

const imp = "import {\n  PALETTE_IDS,\n  PALETTES,\n  contrastRatio,";
if (!t.includes(imp)) throw new Error('El import del test real cambió; revisar preparar-test.mjs');
t = t.replace(imp, "import {\n  PALETTES as PALETTES_REALES,\n  contrastRatio,");
if (!t.includes("} from './palettes';")) throw new Error("No se encontró } from './palettes';");
t = t.replace("} from './palettes';", `} from '@/cosmetics/palettes';
import { PALETTES, PALETTE_IDS } from './candidatas';`);

const cab = `// ARCHIVO GENERADO por preparar-test.mjs a partir de apps/client/src/cosmetics/palettes.test.ts.
// Único cambio: PALETTES / PALETTE_IDS incluyen las 8 paletas de hoy + las candidatas (ver ./candidatas.ts).
// No editar a mano.
`;
fs.writeFileSync(path.join(aqui, 'palettes.candidatas.test.ts'), cab + t);
console.log('ok: palettes.candidatas.test.ts (' + t.split('\n').length + ' líneas)');
