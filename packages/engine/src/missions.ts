// Misiones del día (plan de jugabilidad, fase 5.2). Tres por día, elegidas de forma
// determinista a partir de la fecha, para que el cliente y el servidor coincidan. Solo usan
// datos que el servidor ya verifica: mejor racha, duración, bloques destruidos, partidas
// jugadas y haber jugado el reto del día.
import { TICKS_PER_SECOND } from './constants';
import { type DateKey, isDateKey } from './daily';
import { MILESTONES, type Milestone } from './progress';
import { nextRandom } from './rng';

/**
 * - `streak`: racha de `target` en una partida.
 * - `reach`: llegar al segundo `target` en una partida (un hito de MILESTONES).
 * - `killDay`: destruir `target` bloques hoy, sumando todas las partidas.
 * - `runsDay`: jugar `target` partidas hoy.
 * - `daily`: jugar el reto del día (`target` = 1).
 */
export type MissionKind = 'streak' | 'reach' | 'killDay' | 'runsDay' | 'daily';

export interface Mission {
  /** Identificador estable (se puede guardar; no cambiar los existentes). */
  id: string;
  kind: MissionKind;
  /** Racha, segundo, bloques, partidas o 1, según el tipo. */
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

/** Misiones posibles (provisorio: metas y premios). */
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
  let candidates = [...MISSION_POOL];
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
  }
  value = Math.max(0, Math.min(Math.floor(value) || 0, m.target));
  return { value, done: value >= m.target };
}
