// Lista de paletas que ve la prueba: las 8 reales del juego + las candidatas de la variante.
// TB_VARIANTE = 'base' (corrida a: los 9 hex `colores`) | 'efectivo' (corrida b: color efectivo bajo el número).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PALETTES as REALES } from '@/cosmetics/palettes';

const json = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./candidatas.json', import.meta.url)), 'utf8'));
export const VARIANTE: 'base' | 'efectivo' = process.env.TB_VARIANTE === 'efectivo' ? 'efectivo' : 'base';
const nuevas: Record<string, string[]> = VARIANTE === 'efectivo' ? json.efectivo : json.base;

// Solo se pueden usar ids que sean claves de PALETTES en la prueba; los ids nuevos se agregan como objetos sueltos.
export const PALETTES: Record<string, { id: string; colors: readonly string[]; shine?: boolean }> = {
  ...(REALES as unknown as Record<string, { id: string; colors: readonly string[]; shine?: boolean }>),
};
for (const [id, colors] of Object.entries(nuevas)) PALETTES[id] = { id, colors };
export const PALETTE_IDS = Object.keys(PALETTES);
export const IDS_NUEVAS = Object.keys(nuevas);
