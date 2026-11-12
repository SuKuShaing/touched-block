// Hitos de la partida e insignias. Funciones puras derivadas de las constantes: no cambian
// las reglas (game.ts no las usa) y dan lo mismo en el cliente y en el servidor.
import {
  ADD_START,
  LIFE_STAGE_FIRST,
  LIFE_STAGE_LAST,
  LIFE_STAGE_START,
  LIFE_STAGE_STEP,
  MUL_START,
  NUM_MAX,
  NUM_STEP,
  TICKS_PER_SECOND,
  maxAddFor,
  maxMulFor,
  maxNumFor,
  missMultAt,
  stageLifeFor,
} from './constants';

/**
 * Tipo de hito:
 * - `num`: aparece un número nuevo (`value` = el número).
 * - `add`: aparece el 10 y las sumas y restas (`value` = NUM_MAX).
 * - `mul`: aparecen las multiplicaciones y divisiones (`value` = 0).
 * - `life`: etapa final, los bloques duran `value` segundos.
 */
export type MilestoneKind = 'num' | 'add' | 'mul' | 'life';

export interface Milestone {
  /** Segundo jugado en que el motor cambia. */
  at: number;
  kind: MilestoneKind;
  value: number;
  /** Ícono corto para la pista y el marcador: "5", "+ −", "× ÷", "4 s". */
  icon: string;
  /** Para frases: "Te faltaron 28 s para {name}" / "¡Llegaste a {name}!". */
  name: string;
}

function buildMilestones(): Milestone[] {
  const out: Milestone[] = [];
  for (let n = 4; n <= NUM_MAX; n++) {
    const at = (n - 3) * NUM_STEP;
    if (at >= ADD_START) break; // el último número llega junto con las sumas
    out.push({ at, kind: 'num', value: n, icon: String(n), name: `el ${n}` });
  }
  out.push({ at: ADD_START, kind: 'add', value: NUM_MAX, icon: '+ −', name: 'las sumas y restas' });
  out.push({ at: MUL_START, kind: 'mul', value: 0, icon: '× ÷', name: 'las multiplicaciones y divisiones' });
  for (let v = LIFE_STAGE_FIRST; v >= LIFE_STAGE_LAST; v--) {
    const at = LIFE_STAGE_START + (LIFE_STAGE_FIRST - v) * LIFE_STAGE_STEP;
    out.push({ at, kind: 'life', value: v, icon: `${v} s`, name: `los bloques de ${v} s` });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Hitos en orden: 20, 40, … 120 (números), 140 (sumas), 275 (multiplicaciones), 350–440 (etapa final). */
export const MILESTONES: readonly Milestone[] = buildMilestones();

/** ¿El motor ya cambió por este hito? Usa las mismas curvas que el motor, para coincidir al instante. */
function reached(m: Milestone, played: number): boolean {
  switch (m.kind) {
    case 'num':
      return maxNumFor(played) >= m.value;
    case 'add':
      return maxAddFor(played) > 0;
    case 'mul':
      return maxMulFor(played) > 0;
    case 'life': {
      const life = stageLifeFor(played);
      return life !== null && life <= m.value;
    }
  }
}

/** Cuántos hitos se han cruzado con `played` segundos jugados (0 … MILESTONES.length). */
export function milestoneIndexAt(played: number): number {
  let i = 0;
  while (i < MILESTONES.length && reached(MILESTONES[i], played)) i++;
  return i;
}

/** Multiplicador de castigo vigente justo al cruzar el hito (para el aviso "Escapar ahora resta ×6"). */
export function missMultFor(m: Milestone): number {
  return missMultAt(m.at);
}

// ---- Insignias ----

export type TierId = 'madera' | 'bronce' | 'plata' | 'oro' | 'diamante';

export interface TierStep {
  /** Posición en TIERS (0 = Madera I … 6 = Diamante). */
  index: number;
  tier: TierId;
  /** 1–3 en madera; 1 en las demás. */
  step: number;
  /** "Madera II", "Bronce"… */
  name: string;
  /** Segundos jugados en una partida para ganarla (0 = terminar una partida). */
  at: number;
  /** Requisito en palabras: "Llegar a las sumas y restas". */
  goal: string;
}

/** Referencia compacta que viaja en la API. */
export interface TierRef {
  tier: TierId;
  step: number;
}

const numAt = (n: number) => (n - 3) * NUM_STEP;
const DIAMOND_AT = LIFE_STAGE_START + (LIFE_STAGE_FIRST - LIFE_STAGE_LAST) * LIFE_STAGE_STEP;

/** Insignias (umbrales provisorios, decisión D1: parten en las etapas del juego). */
export const TIERS: readonly TierStep[] = [
  { index: 0, tier: 'madera', step: 1, name: 'Madera I', at: 0, goal: 'Terminar una partida' },
  { index: 1, tier: 'madera', step: 2, name: 'Madera II', at: numAt(5), goal: 'Llegar al 5' },
  { index: 2, tier: 'madera', step: 3, name: 'Madera III', at: numAt(8), goal: 'Llegar al 8' },
  { index: 3, tier: 'bronce', step: 1, name: 'Bronce', at: ADD_START, goal: 'Llegar a las sumas y restas' },
  { index: 4, tier: 'plata', step: 1, name: 'Plata', at: MUL_START, goal: 'Llegar a las multiplicaciones y divisiones' },
  { index: 5, tier: 'oro', step: 1, name: 'Oro', at: LIFE_STAGE_START, goal: 'Llegar a la etapa final' },
  { index: 6, tier: 'diamante', step: 1, name: 'Diamante', at: DIAMOND_AT, goal: `Llegar a los bloques de ${LIFE_STAGE_LAST} s` },
];

/**
 * Índice de la insignia según la duración de la mejor partida (en ticks), o −1 si no hay
 * partidas. Compara enteros para que cliente y servidor den siempre lo mismo.
 */
export function tierIndexForTicks(ticks: number | null | undefined): number {
  if (ticks === null || ticks === undefined || !(ticks >= 0)) return -1;
  let i = 0;
  for (let j = 1; j < TIERS.length; j++) if (ticks >= TIERS[j].at * TICKS_PER_SECOND) i = j;
  return i;
}

/** Insignia según la duración de la mejor partida (ticks), o null si nunca terminó una. */
export function tierForTicks(ticks: number | null | undefined): TierStep | null {
  const i = tierIndexForTicks(ticks);
  return i < 0 ? null : TIERS[i];
}

/** `{ tier, step }` para la API, o null. */
export function tierRefForTicks(ticks: number | null | undefined): TierRef | null {
  const t = tierForTicks(ticks);
  return t ? { tier: t.tier, step: t.step } : null;
}

/** Índice en TIERS de una referencia de la API (−1 si no es válida). */
export function tierIndexOf(ref: TierRef | null | undefined): number {
  if (!ref) return -1;
  return TIERS.findIndex((t) => t.tier === ref.tier && t.step === ref.step);
}
