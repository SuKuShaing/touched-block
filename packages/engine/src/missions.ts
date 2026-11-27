// Misiones del día (plan de jugabilidad, fase 5.2). Tres por día, elegidas de forma
// determinista a partir de la fecha, para que el cliente y el servidor coincidan. Solo usan
// datos que el servidor ya verifica: mejor racha, duración, bloques destruidos, partidas
// jugadas, haber jugado el reto del día y haber empezado a seguir a alguien.
import { LIFE_STAGE_FIRST, TICKS_PER_SECOND } from './constants';
import { type DateKey, dayIndex, isDateKey } from './daily';
import { MILESTONES, type Milestone } from './progress';
import { nextRandom } from './rng';

/**
 * - `streak`: racha de `target` en una partida.
 * - `reach`: llegar al segundo `target` en una partida (un hito de MILESTONES).
 * - `killDay`: destruir `target` bloques hoy, sumando todas las partidas.
 * - `runsDay`: jugar `target` partidas hoy.
 * - `daily`: jugar el reto del día (`target` = 1).
 * - `follow`: empezar a seguir a un jugador hoy (`target` = 1). Solo se cumple con cuenta.
 */
export type MissionKind = 'streak' | 'reach' | 'killDay' | 'runsDay' | 'daily' | 'follow';

export interface Mission {
  /** Identificador estable (se puede guardar; no cambiar los existentes). */
  id: string;
  kind: MissionKind;
  /** Racha, segundo, bloques o partidas, según el tipo (1 en `daily` y `follow`). */
  target: number;
  /** "Racha de 15", "Llega al 8", "Destruye 60 bloques hoy"… */
  title: string;
  /** Bloques extra para el nivel al completarla. */
  reward: number;
}

function milestone(kind: Milestone['kind'], value?: number): Milestone {
  const m = MILESTONES.find((x) => x.kind === kind && (value === undefined || x.value === value));
  if (!m) throw new Error(`no existe el hito ${kind} ${value ?? ''}`);
  return m;
}

/** "Llega al 8", "Llega a las sumas y restas" (los nombres de los hitos vienen de MILESTONES). */
function reachTitle(m: Milestone): string {
  return m.name.startsWith('el ') ? `Llega al ${m.name.slice(3)}` : `Llega a ${m.name}`;
}

function reach(id: string, m: Milestone, reward: number): Mission {
  return { id, kind: 'reach', target: m.at, title: reachTitle(m), reward };
}

const M5 = milestone('num', 5);
const M8 = milestone('num', 8);
const M_ADD = milestone('add');
const M_MUL = milestone('mul');

/**
 * Primer día del pool completo; antes rigen solo las LEGACY_POOL_SIZE primeras. Si no se
 * publica a tiempo, se corre junto con DAILY_CYCLE_FROM (daily.ts).
 */
export const MISSIONS_POOL_FROM: DateKey = '2026-12-07';
const LEGACY_POOL_SIZE = 13;

/**
 * Misiones posibles (provisorio: metas y premios). El orden decide el sorteo: no reordenar ni
 * insertar. Cambiar el tamaño cambia las misiones de casi todos los días, así que cualquier
 * ampliación necesita su propia fecha de inicio.
 */
export const MISSION_POOL: readonly Mission[] = [
  { id: 'racha10', kind: 'streak', target: 10, title: 'Racha de 10', reward: 20 },
  { id: 'racha15', kind: 'streak', target: 15, title: 'Racha de 15', reward: 30 },
  { id: 'racha25', kind: 'streak', target: 25, title: 'Racha de 25', reward: 50 },
  reach('llega5', M5, 20),
  reach('llega8', M8, 30),
  reach('llegaSumas', M_ADD, 50),
  reach('llegaMult', M_MUL, 60),
  { id: 'destruye30', kind: 'killDay', target: 30, title: 'Destruye 30 bloques hoy', reward: 20 },
  { id: 'destruye60', kind: 'killDay', target: 60, title: 'Destruye 60 bloques hoy', reward: 30 },
  { id: 'destruye120', kind: 'killDay', target: 120, title: 'Destruye 120 bloques hoy', reward: 50 },
  { id: 'juega3', kind: 'runsDay', target: 3, title: 'Juega 3 partidas hoy', reward: 20 },
  { id: 'juega5', kind: 'runsDay', target: 5, title: 'Juega 5 partidas hoy', reward: 30 },
  { id: 'reto', kind: 'daily', target: 1, title: 'Juega el reto del día', reward: 40 },
  // desde MISSIONS_POOL_FROM
  { id: 'sigue', kind: 'follow', target: 1, title: 'Sigue a un jugador hoy', reward: 20 },
  { id: 'racha20', kind: 'streak', target: 20, title: 'Racha de 20', reward: 40 },
  { id: 'racha40', kind: 'streak', target: 40, title: 'Racha de 40', reward: 60 },
  reach('llega9', milestone('num', 9), 40),
  reach('llegaFinal', milestone('life', LIFE_STAGE_FIRST), 60),
  { id: 'destruye90', kind: 'killDay', target: 90, title: 'Destruye 90 bloques hoy', reward: 40 },
  { id: 'destruye250', kind: 'killDay', target: 250, title: 'Destruye 250 bloques hoy', reward: 60 },
  { id: 'juega6', kind: 'runsDay', target: 6, title: 'Juega 6 partidas hoy', reward: 30 },
  { id: 'racha30', kind: 'streak', target: 30, title: 'Racha de 30', reward: 50 },
  { id: 'racha50', kind: 'streak', target: 50, title: 'Racha de 50', reward: 60 },
  reach('llega7', milestone('num', 7), 30),
  { id: 'destruye180', kind: 'killDay', target: 180, title: 'Destruye 180 bloques hoy', reward: 50 },
  { id: 'destruye400', kind: 'killDay', target: 400, title: 'Destruye 400 bloques hoy', reward: 60 },
  { id: 'juega10', kind: 'runsDay', target: 10, title: 'Juega 10 partidas hoy', reward: 40 },
  { id: 'juega15', kind: 'runsDay', target: 15, title: 'Juega 15 partidas hoy', reward: 50 },
];

/** Misiones por día. */
export const MISSIONS_PER_DAY = 3;

/** FNV-1a de 32 bits (solo operaciones enteras). */
function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

/**
 * Las tres misiones de esa fecha: distintas y de tipos distintos (así nunca hay dos de racha
 * el mismo día, ni más de una de jugar el reto). Deterministas a partir de la fecha.
 */
export function missionsFor(key: DateKey): Mission[] {
  if (!isDateKey(key)) throw new Error(`fecha inválida: ${String(key)}`);
  const rng = { rng: hashString(`misiones:${key}`) };
  let candidates =
    dayIndex(key) < dayIndex(MISSIONS_POOL_FROM) ? MISSION_POOL.slice(0, LEGACY_POOL_SIZE) : [...MISSION_POOL];
  const out: Mission[] = [];
  while (out.length < MISSIONS_PER_DAY && candidates.length > 0) {
    const m = candidates[Math.floor(nextRandom(rng) * candidates.length)];
    out.push(m);
    candidates = candidates.filter((c) => c.kind !== m.kind);
  }
  return out;
}

/** Resumen de las partidas de un día de un jugador (lo arma el servidor, o el cliente como invitado). */
export interface DayAgg {
  /** Partidas terminadas hoy (de cualquier modo). */
  runs: number;
  /** Bloques destruidos hoy, sumando todas las partidas. */
  killed: number;
  /** Mejor racha en una partida de hoy. */
  bestStreak: number;
  /** Duración de la partida más larga de hoy, en ticks. */
  maxTicks: number;
  /** ¿Jugó el reto del día? */
  playedDaily: boolean;
  /**
   * ¿Empezó a seguir hoy a alguien, sin contar los seguimientos de una invitación? Lo decide
   * el servidor; para un invitado es siempre false.
   */
  followedToday: boolean;
}

export interface MissionProgress {
  /** Avance, entre 0 y `target`. */
  value: number;
  done: boolean;
}

/** Avance de una misión con las partidas del día. */
export function missionProgress(m: Mission, agg: DayAgg): MissionProgress {
  let value: number;
  switch (m.kind) {
    case 'streak':
      value = agg.bestStreak;
      break;
    case 'reach':
      // compara enteros (ticks) para que cliente y servidor den siempre lo mismo
      value = agg.maxTicks >= m.target * TICKS_PER_SECOND ? m.target : Math.floor(agg.maxTicks / TICKS_PER_SECOND);
      break;
    case 'killDay':
      value = agg.killed;
      break;
    case 'runsDay':
      value = agg.runs;
      break;
    case 'daily':
      value = agg.playedDaily ? 1 : 0;
      break;
    case 'follow':
      value = agg.followedToday ? 1 : 0;
      break;
  }
  value = Math.max(0, Math.min(Math.floor(value) || 0, m.target));
  return { value, done: value >= m.target };
}
