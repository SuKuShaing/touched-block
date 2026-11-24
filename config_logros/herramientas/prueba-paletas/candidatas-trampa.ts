// Paletas que ve contorno-trampa.test.ts: las 8 reales + controles + un "Contorno puro" por cada candidato de
// candidatos-contorno.json (colores = el fondo #12121a en las 9 posiciones; rojo y número propios por paleta).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PALETTES as REALES } from '@/cosmetics/palettes';

type P = { id: string; colors: readonly string[]; shine?: boolean };
const leer = (f: string) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8'));
const cand = leer('./candidatos-contorno.json');
const cat = leer('./candidatas.json');

export const PALETTES: Record<string, P> = { ...(REALES as unknown as Record<string, P>) };
export const TRAP_OF: Record<string, string> = {};
export const NUM_OF: Record<string, string> = {};

// controles
PALETTES['ctl-contorno55'] = { id: 'ctl-contorno55', colors: cat.efectivo.contorno55 }; // debe pasar (alternativa A)
PALETTES['ctl-contorno-bordes-crudos'] = { id: 'ctl-contorno-bordes-crudos', colors: cat.base.contorno }; // los hex de borde tal cual

for (const c of cand.candidatos as { id: string; rojo: string; numero: string }[]) {
  const id = 'puro|' + c.id;
  PALETTES[id] = { id, colors: Array(9).fill(cand.fondo) };
  TRAP_OF[id] = c.rojo;
  NUM_OF[id] = c.numero;
}
export const PALETTE_IDS = Object.keys(PALETTES);
