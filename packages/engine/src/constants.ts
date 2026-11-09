// Constantes de balance. Si cambias alguna, actualiza también las tablas de
// rompe-el-bloque.md y sube RULES_VERSION (las partidas con otra versión no se
// comparan en los rankings).
export const RULES_VERSION = 2;

export const START_TIME = 10; // segundos iniciales
export const BASE_LIVES = 5; // vidas de base
export const MAX_LIVES_CAP = 8; // tope de vidas con invitaciones (+1 por invitado)
export const LIFE_MIN = 3; // vida mínima de un bloque (s) antes de la etapa final
export const LIFE_MAX = 5; // vida máxima de un bloque (s); no depende del número
export const BOMB_PENALTY = 30; // segundos que quita tocar una trampa
export const BOMB_CHANCE = 0.16; // probabilidad de trampa roja por bloque generado
export const BOMB_MIN_PLAYED = 8; // segundos de juego antes de la primera trampa
export const BOMB_MAX_AT_ONCE = 2; // trampas simultáneas como máximo (rojas + resultados ≤ 0)

/** Tipos de bloque. */
export type BlockKind = 'num' | 'add' | 'sub' | 'mul' | 'div';

// Castigo por bloque escapado: su resultado × multiplicador según el tipo
export const MISS_MULT_NUM = 3; // números solos
export const MISS_MULT_ADDSUB = 4; // sumas y restas
export const MISS_MULT_MULDIV = 5; // multiplicaciones y divisiones
export function missMultFor(kind: BlockKind): number {
  if (kind === 'num') return MISS_MULT_NUM;
  if (kind === 'add' || kind === 'sub') return MISS_MULT_ADDSUB;
  return MISS_MULT_MULDIV;
}

// ---- Progresión (segundos jugados) ----
export const NUM_MAX = 10; // los números llegan hasta 10
export const NUM_STEP = 20; // +1 al número máximo cada NUM_STEP s (parte en 3)
/** Las sumas y restas aparecen cuando los números llegan a NUM_MAX. */
export const ADD_START = (NUM_MAX - 3) * NUM_STEP; // 140 s
export const ADD_MAX = 10; // operandos de sumas/restas hasta 10 ("10+10")
export const ADD_STEP = 15; // +1 al operando máximo cada ADD_STEP s (parte en 1)
/** Las multiplicaciones y divisiones aparecen cuando las sumas llegan a "10+10". */
export const MUL_START = ADD_START + (ADD_MAX - 1) * ADD_STEP; // 275 s
export const MUL_MAX = 5; // factores hasta 5 ("5×5")
export const MUL_STEP = 15; // +1 al factor máximo cada MUL_STEP s (parte en 2)
/** Cuando ya aparece todo, la vida de los bloques baja: 4 s, 3 s, 2 s y 1 s. */
export const LIFE_STAGE_START = MUL_START + (MUL_MAX - 2) * MUL_STEP + 30; // 350 s
export const LIFE_STAGE_STEP = 30; // cada cuánto baja 1 s la vida
export const LIFE_STAGE_FIRST = 4;
export const LIFE_STAGE_LAST = 1;

/** Proporción de cada familia de bloques cuando ya están disponibles. */
export const MIX_WITH_ADD = { num: 0.5, add: 0.5 } as const;
export const MIX_WITH_MUL = { num: 0.4, add: 0.35, mul: 0.25 } as const;
export const SUB_CHANCE = 0.4; // dentro de sumas/restas
export const DIV_CHANCE = 0.4; // dentro de multiplicaciones/divisiones

// ---- Combos: bloques destruidos seguidos sin ningún error ----
/** [racha dentro del ciclo, segundos extra]. Al llegar a 20 el ciclo se repite (23 → +1 s…). */
export const COMBO_REWARDS: readonly (readonly [number, number])[] = [
  [3, 1],
  [5, 2],
  [10, 3],
  [15, 4],
  [20, 5],
];
export const COMBO_CYCLE = 20;
export function comboBonusFor(streak: number): number {
  if (streak <= 0) return 0;
  const p = ((streak - 1) % COMBO_CYCLE) + 1;
  for (const [at, bonus] of COMBO_REWARDS) if (at === p) return bonus;
  return 0;
}

/** Paso fijo de simulación (s). */
export const DT = 1 / 60;
export const TICKS_PER_SECOND = 60;

/** Colores de bloque, indexados por número − 1 (el 10 vuelve al primero). */
export const COLORS = [
  '#e5484d',
  '#f76b15',
  '#e5a50a',
  '#30a46c',
  '#0091ff',
  '#6e56cf',
  '#d6409f',
  '#12a594',
  '#8e4ec6',
] as const;

/** Colores rojizos: una trampa roja sobre ellos no se vería, así que usa uno de SAFE. */
export const REDDISH: readonly string[] = ['#e5484d', '#f76b15', '#d6409f'];
export const SAFE = ['#e5a50a', '#30a46c', '#0091ff', '#6e56cf', '#12a594', '#8e4ec6'] as const;

/** Símbolos que se muestran en los bloques con operación. */
export const OP_SYMBOL = { add: '+', sub: '−', mul: '×', div: '÷' } as const;

/** Vidas que corresponden a un jugador según cuántos amigos invitó. */
export function livesFor(invitedCount: number): number {
  return Math.min(BASE_LIVES + Math.max(0, Math.floor(invitedCount)), MAX_LIVES_CAP);
}

// Curvas de dificultad (dependen del tiempo jugado en segundos)
export const maxNumFor = (played: number) => Math.min(3 + Math.floor(played / NUM_STEP), NUM_MAX);
export const maxAddFor = (played: number) =>
  played < ADD_START ? 0 : Math.min(1 + Math.floor((played - ADD_START) / ADD_STEP), ADD_MAX);
export const maxMulFor = (played: number) =>
  played < MUL_START ? 0 : Math.min(2 + Math.floor((played - MUL_START) / MUL_STEP), MUL_MAX);
/** Vida fija de la etapa final, o null si todavía es aleatoria entre LIFE_MIN y LIFE_MAX. */
export const stageLifeFor = (played: number): number | null =>
  played < LIFE_STAGE_START
    ? null
    : Math.max(LIFE_STAGE_LAST, LIFE_STAGE_FIRST - Math.floor((played - LIFE_STAGE_START) / LIFE_STAGE_STEP));
export const maxConcFor = (played: number) => Math.min(3 + Math.floor(played / 30), 6);
export const spawnCooldown = (played: number, r: number) => 0.5 + r * 0.6 - Math.min(played / 120, 1) * 0.25;
export const blockSizeFor = (w: number, h: number) => Math.max(66, Math.min(92, Math.min(w, h) / 4.2));
/** Los bloques con operación son rectangulares. */
export const OP_WIDTH_RATIO = 1.7;
