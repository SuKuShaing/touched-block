import { type DateKey, type DayAgg, addDays, dailyModsFor, dayIndex, isDateKey, missionProgress, missionsFor } from '@tb/engine';
import type { MissionView } from '@/api/daily';
import { storage } from '@/platform/storage';
import { type DailyLocal, type DailyRunLocal, localDayRange, localRuns } from './daily';
import type { HistEntry } from './history';
import { addBonusXp } from './stats';

/**
 * Misiones del día (plan de jugabilidad, fase 5.2). Con sesión vienen de `GET /missions` (el
 * servidor premia). Como invitado se calculan aquí con las mismas funciones del motor
 * (`missionsFor`, `missionProgress`), sobre el historial local de hoy (`tb_hist5`) y las
 * partidas del reto de `tb_daily1`; el premio (`addBonusXp`) se da una sola vez por misión y
 * fecha, y los ids premiados se guardan en `tb_miss1`.
 */
export const MISSIONS_KEY = 'tb_miss1';

/** Fechas con misiones premiadas que se recuerdan. */
const DAYS_KEPT = 7;

/**
 * Resumen del día para el invitado, como lo arma el servidor (`MissionsService.dayAgg`):
 * - partidas y bloques: todas las del día (historial normal más las del reto);
 * - mejor racha y duración: solo las partidas sin modificadores (las del reto cuentan si ese
 *   día no tiene modificador);
 * - `playedDaily`: terminó una partida del reto de esa fecha.
 * Las partidas normales cuentan por la hora en que terminaron (`d`, en el día local).
 */
export function dayAggFrom(date: DateKey, hist: readonly HistEntry[], daily: readonly DailyRunLocal[]): DayAgg {
  const [from, to] = localDayRange(date);
  const plainDaily = dailyModsFor(date).mods === null;
  const agg: DayAgg = { runs: 0, killed: 0, bestStreak: 0, maxTicks: 0, playedDaily: daily.length > 0 };
  for (const g of hist) {
    if (!(g.d >= from && g.d < to)) continue;
    agg.runs++;
    agg.killed += g.k;
    agg.bestStreak = Math.max(agg.bestStreak, g.s ?? 0);
    agg.maxTicks = Math.max(agg.maxTicks, g.t ?? 0);
  }
  for (const r of daily) {
    agg.runs++;
    agg.killed += r.k;
    if (plainDaily) {
      agg.bestStreak = Math.max(agg.bestStreak, r.s);
      agg.maxTicks = Math.max(agg.maxTicks, r.t);
    }
  }
  return agg;
}

/** Las tres misiones de la fecha con su avance. */
export function missionViews(date: DateKey, agg: DayAgg, rewarded: ReadonlySet<string> = new Set()): MissionView[] {
  return missionsFor(date).map((m) => {
    const p = missionProgress(m, agg);
    return { id: m.id, kind: m.kind, title: m.title, target: m.target, value: p.value, done: p.done, reward: m.reward, rewarded: rewarded.has(m.id) };
  });
}

// ---- premios del invitado (tb_miss1: { fecha: [ids] }) ----

function readRewarded(): Record<DateKey, string[]> {
  try {
    const o: unknown = JSON.parse(storage.get(MISSIONS_KEY) || '{}');
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out: Record<DateKey, string[]> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (isDateKey(k) && Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string');
    }
    return out;
  } catch {
    return {};
  }
}

/** Ids de las misiones ya premiadas en esa fecha (como invitado, en este dispositivo). */
export function loadRewarded(date: DateKey): Set<string> {
  return new Set(readRewarded()[date] ?? []);
}

function saveRewarded(date: DateKey, ids: Set<string>) {
  const all = readRewarded();
  all[date] = [...ids];
  const from = dayIndex(addDays(date, -DAYS_KEPT));
  for (const k of Object.keys(all)) if (dayIndex(k) <= from) delete all[k];
  try {
    storage.set(MISSIONS_KEY, JSON.stringify(all));
  } catch {}
}

/**
 * Premia (una sola vez) las misiones cumplidas que todavía no tenían premio: suma su `reward`
 * a los bloques extra del dispositivo. Devuelve las recién premiadas (ya con `rewarded: true`).
 */
export function rewardMissions(date: DateKey, views: readonly MissionView[]): MissionView[] {
  const done = loadRewarded(date);
  const fresh = views.filter((m) => m.done && !done.has(m.id));
  if (fresh.length === 0) return [];
  for (const m of fresh) done.add(m.id);
  saveRewarded(date, done); // primero la marca: si algo falla después, no se premia dos veces
  for (const m of fresh) addBonusXp(m.reward);
  return fresh.map((m) => ({ ...m, rewarded: true }));
}

/** Misiones del invitado para esa fecha (solo lee; el premio lo da `rewardMissions`). */
export function guestMissions(date: DateKey, hist: readonly HistEntry[], daily: DailyLocal): MissionView[] {
  return missionViews(date, dayAggFrom(date, hist, localRuns(daily, date)), loadRewarded(date));
}

// ---- pantalla final ----

/** Misiones que se cumplieron entre dos lecturas (para la pantalla final). Sin lectura previa, ninguna. */
export function newlyCompleted(before: readonly MissionView[] | null | undefined, after: readonly MissionView[] | null | undefined): MissionView[] {
  if (!before || !after) return [];
  const was = new Map(before.map((m) => [m.id, m.done]));
  return after.filter((m) => m.done && was.has(m.id) && !was.get(m.id));
}

/** Cuántas están cumplidas. */
export const doneCount = (views: readonly MissionView[]) => views.filter((m) => m.done).length;

/** "9/15", "112/140 s", "Lista". */
export function progressLabel(m: MissionView): string {
  if (m.done) return 'Lista';
  return m.kind === 'reach' ? `${m.value}/${m.target} s` : `${m.value}/${m.target}`;
}
