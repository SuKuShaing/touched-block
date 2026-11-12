import { type GameMods, MILESTONES, type Milestone, TICKS_PER_SECOND, milestoneIndexAt } from '@tb/engine';

/**
 * Camino de etapas: posiciones en la pista, avance hacia el próximo hito y las frases de la
 * pantalla final. Funciones puras; los hitos y sus nombres salen del motor (`MILESTONES`).
 */

export const ticksToSeconds = (ticks: number) => (ticks > 0 ? ticks / TICKS_PER_SECOND : 0);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Posición 0..1 en la pista. La escala no es lineal: cada hito ocupa el mismo ancho, para que
 * los primeros segundos no se vean como una barra casi vacía.
 */
export function trackPos(seconds: number): number {
  const n = MILESTONES.length;
  if (!(seconds > 0) || n === 0) return 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const at = MILESTONES[i].at;
    if (seconds < at) return (i + (seconds - prev) / (at - prev)) / n;
    prev = at;
  }
  return 1;
}

/** Posición 0..1 del hito `i` (el final de su tramo). */
export const milestonePos = (i: number) => (i + 1) / MILESTONES.length;

/**
 * Avance hacia el próximo hito durante la partida (`played` en segundos, como el motor):
 * `ratio` 0..1 desde el hito anterior y el próximo hito (null si ya se cruzaron todos).
 */
export function milestoneProgress(played: number): { ratio: number; next: Milestone | null } {
  const idx = milestoneIndexAt(played);
  if (idx >= MILESTONES.length) return { ratio: 1, next: null };
  const prevAt = idx > 0 ? MILESTONES[idx - 1].at : 0;
  const next = MILESTONES[idx];
  return { ratio: clamp01((played - prevAt) / (next.at - prevAt)), next };
}

/** "a" + nombre del hito, con la contracción: "al 5", "a las sumas y restas". */
export const toMilestone = (name: string) => (name.startsWith('el ') ? 'al ' + name.slice(3) : 'a ' + name);

/**
 * Frase bajo el camino de etapas:
 * 1. si cruzó un hito nuevo para él: "¡Llegaste a las sumas y restas!";
 * 2. si no: "Te faltaron 28 s para las sumas y restas" (el siguiente hito).
 * `prevBestTicks` es su partida más larga ANTES de esta (0 si es la primera).
 */
export function stagePhrase(todayTicks: number, prevBestTicks: number): string {
  const today = ticksToSeconds(todayTicks);
  const idx = milestoneIndexAt(today);
  const prevIdx = milestoneIndexAt(ticksToSeconds(prevBestTicks));
  if (idx > prevIdx) return `¡Llegaste ${toMilestone(MILESTONES[idx - 1].name)}!`;
  return nextMilestonePhrase(today);
}

/**
 * Frase sin comparar con su mejor partida: "Te faltaron 28 s para las sumas y restas" (el
 * siguiente hito) o, si ya los cruzó todos, "Llegaste a los bloques de 1 s". Es la de las
 * partidas de reto (duel, daily), que no cuentan para la insignia (D6): ahí no se felicita por
 * "llegar" a un hito. `seconds` es la dificultad alcanzada (con `startAt`, los segundos jugados
 * más ese inicio, como `difficultyTime` del motor).
 */
export function nextMilestonePhrase(seconds: number): string {
  const s = seconds > 0 ? seconds : 0;
  const idx = milestoneIndexAt(s);
  if (idx >= MILESTONES.length) return `Llegaste ${toMilestone(MILESTONES[MILESTONES.length - 1].name)}`;
  const next = MILESTONES[idx];
  const left = Math.max(1, Math.ceil(next.at - s - 1e-9));
  return `Te faltaron ${left} s para ${next.name}`;
}

/**
 * Dónde parte el camino de etapas de una partida de reto, en segundos de dificultad, según sus
 * modificadores; o null si el camino no tiene sentido y se omite:
 * - sin modificadores, `lives` o `noRed`: parte en 0 (la dificultad es la de siempre);
 * - `startAt`: parte ahí (la partida empezó "como si ya se hubieran jugado N segundos");
 * - `only` (una sola familia de bloques): null, porque los hitos de números y operaciones no se
 *   cumplen en esa partida.
 */
export function challengeTrackStart(mods: GameMods | null | undefined): number | null {
  if (!mods) return 0;
  if (mods.only) return null;
  return mods.startAt && mods.startAt > 0 ? mods.startAt : 0;
}

/** "Te faltaron N bloques para tu récord" (los que faltaban para superarlo), o null si fue récord o no había. */
export function recordGapText(killed: number, bestBefore: number): string | null {
  if (bestBefore <= 0 || killed > bestBefore) return null;
  const n = bestBefore - killed + 1;
  return n === 1 ? 'Te faltó 1 bloque para tu récord' : `Te faltaron ${n} bloques para tu récord`;
}

// ---------------------------------------------------------------- amigos

/** Puntaje semanal de alguien del ranking de amigos (GET /leaderboards?scope=friends&period=week). */
export interface FriendScore {
  userId: string;
  username: string;
  killed: number;
  isMe?: boolean;
}

const isMine = (e: FriendScore, meId: string | null) => !!e.isMe || (!!meId && e.userId === meId);

/**
 * El amigo más cercano por encima de `ref` (el mayor entre esta partida y mi mejor de la
 * semana), o null. `diff` = cuántos bloques más tiene.
 */
export function friendAhead(entries: readonly FriendScore[], meId: string | null, ref: number): { username: string; diff: number } | null {
  let best: FriendScore | null = null;
  for (const e of entries) {
    if (isMine(e, meId) || !(e.killed > ref)) continue;
    if (!best || e.killed < best.killed) best = e;
  }
  return best ? { username: best.username, diff: best.killed - ref } : null;
}

export const friendAheadText = (f: { username: string; diff: number }) =>
  f.diff === 1 ? `Estás a 1 bloque de @${f.username} esta semana` : `Estás a ${f.diff} bloques de @${f.username} esta semana`;

/**
 * Amigos que vale la pena avisar al superarlos en plena partida: los que todavía no superé esta
 * semana (puntaje ≥ mi mejor de la semana), de menor a mayor.
 */
export function friendTargets(entries: readonly FriendScore[], meId: string | null, myWeekBest: number): FriendScore[] {
  return entries.filter((e) => !isMine(e, meId) && e.killed > 0 && e.killed >= myWeekBest).sort((a, b) => a.killed - b.killed);
}

/** Cuántos de `targets` (ordenados de menor a mayor) quedan superados con `killed` bloques. */
export function passedCount(targets: readonly FriendScore[], killed: number): number {
  let i = 0;
  while (i < targets.length && killed > targets[i].killed) i++;
  return i;
}
