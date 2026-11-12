import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  DAILY_ATTEMPTS_ACCOUNT,
  DAILY_ATTEMPTS_GUEST,
  DAILY_EPOCH,
  type DailyStreak,
  type DateKey,
  type GameMods,
  addDays,
  dailyModsFor,
  dailyNumber,
  dailyStreak,
  dayIndex,
  isDateKey,
  weekdayOf,
} from '@tb/engine';
import { storage } from '@/platform/storage';

/**
 * Reto diario en el cliente (plan de jugabilidad, fase 4): la fecha local del jugador (D7: el
 * reto cambia a la medianoche de cada uno), la cuenta regresiva, y lo que este dispositivo
 * recuerda en `tb_daily1`: intentos empezados (el invitado tiene 1, D8), partidas terminadas,
 * la partida de invitado por reclamar, si ya vio la hoja de reglas y el aviso de ayer, y las
 * fechas jugadas (racha del invitado). No depende de la versión de reglas.
 */
export const DAILY_KEY = 'tb_daily1';

/** Desde qué visita se presentan el reto diario y las misiones (la 1.ª es solo para jugar). */
export const DAILY_FROM_VISIT = 2;
/** …o desde cuántas partidas terminadas, lo que llegue primero (ver `dailyVisible`). */
export const DAILY_FROM_RUNS = 3;

/**
 * Con menos jugadores que esto en un día se muestra la posición ("Vas 2.º de 4") en vez del
 * porcentaje (plan 4.2; el mismo umbral que usa la API para el logro).
 */
export const PCT_MIN_PLAYERS = 10;

/** Plazo para reclamar una partida de invitado al iniciar sesión (la API da 1 h). */
export const CLAIM_WINDOW_MS = 60 * 60 * 1000;

/** Días con detalle (partidas, intentos) que se guardan. */
const DAYS_KEPT = 14;
/** Fechas jugadas que se guardan para la racha (más de un año). */
const PLAYED_MAX = 400;

// ---------------------------------------------------------------- fechas

const p2 = (n: number) => String(n).padStart(2, '0');

/** Fecha local del dispositivo como 'AAAA-MM-DD'. */
export function localDateKey(now: Date = new Date()): DateKey {
  return `${String(now.getFullYear()).padStart(4, '0')}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
}

function parts(key: DateKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

/** Inicio y fin (ms, exclusivo) del día local `key` en este dispositivo. */
export function localDayRange(key: DateKey): [number, number] {
  const [y, m, d] = parts(key);
  return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime()];
}

/** Milisegundos hasta la próxima medianoche local (respeta los cambios de horario). */
export function msToNextMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return Math.max(0, next - now.getTime());
}

/** Minutos al este de UTC, como pide `GET /missions` (`tz`). */
export const tzOffsetMinutes = (now: Date = new Date()) => -now.getTimezoneOffset() || 0;

/** Cuenta regresiva "h:mm:ss" (redondea hacia arriba). */
export function fmtCountdown(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${h}:${p2(m)}:${p2(t % 60)}`;
}

/** Cuenta regresiva para leer en voz alta: "5 h 12 min", "12 min", "menos de 1 min". */
export function countdownWords(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return 'menos de 1 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/** 12 → "12.º". */
export const ordinal = (n: number) => `${n}.º`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------- el reto de una fecha

export interface DailyInfo {
  date: DateKey;
  number: number;
  /** "Directo a las sumas", "Partida normal"… */
  title: string;
  mods: GameMods | null;
}

/** Número, modificador y título del reto de esa fecha, calculados con el motor (sin red). */
export function dailyInfo(date: DateKey): DailyInfo {
  const { mods, title } = dailyModsFor(date);
  return { date, number: dailyNumber(date), title, mods };
}

/** "Hoy: directo a las sumas". */
export const todayLine = (title: string) => `Hoy: ${title.charAt(0).toLowerCase()}${title.slice(1)}`;

/** Intentos como puntos: los que quedan llenos (●●○ = quedan 2 de 3). */
export function attemptDots(left: number, max: number): string {
  const m = Math.max(0, Math.floor(max));
  const l = Math.max(0, Math.min(m, Math.floor(left)));
  return '●'.repeat(l) + '○'.repeat(m - l);
}

/** "Te quedan 2 intentos", "Te queda 1 intento", "Sin intentos por hoy". */
export function attemptsText(left: number): string {
  if (left <= 0) return 'Sin intentos por hoy';
  return left === 1 ? 'Te queda 1 intento' : `Te quedan ${left} intentos`;
}

// ---------------------------------------------------------------- posición

/**
 * Posición en el reto del día: "Mejor que el 72 %" con 10 jugadores o más; si no, "Vas 2.º de 4"
 * (o "Habrías quedado 2.º de 4" para un invitado). Con 1 jugador: "Eres el primero en jugarlo".
 */
export function positionText(r: { rank: number; total: number; betterThanPct: number }, guest = false): string {
  if (guest) {
    const base = `Habrías quedado ${ordinal(r.rank)} de ${r.total}`;
    return r.total >= PCT_MIN_PLAYERS ? `${base} (mejor que el ${r.betterThanPct} %)` : base;
  }
  if (r.total >= PCT_MIN_PLAYERS) return `Mejor que el ${r.betterThanPct} %`;
  if (r.total <= 1) return 'Eres el primero en jugarlo hoy';
  return `Vas ${ordinal(r.rank)} de ${r.total}`;
}

/** "Superaste a 2 de tus 3 amigos" (null si ningún amigo jugó). */
export function friendsText(f: { beaten: number; total: number }): string | null {
  if (!(f.total > 0)) return null;
  if (f.beaten >= f.total) return f.total === 1 ? 'Superaste a tu amigo que jugó hoy' : `¡Superaste a tus ${f.total} amigos que jugaron hoy!`;
  if (f.beaten === 0) return f.total === 1 ? 'Tu amigo que jugó hoy va mejor que tú' : `Tus ${f.total} amigos que jugaron hoy van mejor que tú`;
  return `Superaste a ${f.beaten} de tus ${f.total} amigos que jugaron hoy`;
}

/** "Racha: 4 días" (null sin racha). */
export function streakText(current: number): string | null {
  return current > 0 ? `Racha: ${plural(current, 'día', 'días')}` : null;
}

export interface YesterdaySummary {
  date: DateKey;
  rank: number | null;
  total: number;
  winner: { username: string; killed: number };
}

/** "Ayer quedaste 12.º de 80. Ganó @jose con 91." / "Ayer ganó @jose con 91 bloques (80 jugadores)." */
export function yesterdayText(y: YesterdaySummary): string {
  const players = plural(y.total, 'jugador', 'jugadores');
  if (y.rank === 1) return y.total > 1 ? `¡Ayer ganaste el reto! Jugaron ${players}.` : 'Ayer fuiste el único en jugar el reto.';
  if (y.rank) return `Ayer quedaste ${ordinal(y.rank)} de ${y.total}. Ganó @${y.winner.username} con ${y.winner.killed}.`;
  return `Ayer ganó @${y.winner.username} con ${plural(y.winner.killed, 'bloque', 'bloques')} (${players}).`;
}

// ---------------------------------------------------------------- semana

export const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const WEEK_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

export interface WeekDay {
  date: DateKey;
  /** L M M J V S D */
  label: string;
  /** "lunes"… (para lectores de pantalla). */
  name: string;
  played: boolean;
  today: boolean;
  future: boolean;
}

/** La semana de `today` (lunes a domingo) con los días jugados. */
export function weekStrip(today: DateKey, played: readonly string[]): WeekDay[] {
  const set = new Set(played);
  const monday = addDays(today, -weekdayOf(today));
  const t = dayIndex(today);
  return WEEK_LABELS.map((label, i) => {
    const date = addDays(monday, i);
    return { date, label, name: WEEK_NAMES[i], played: set.has(date), today: date === today, future: dayIndex(date) > t };
  });
}

// ---------------------------------------------------------------- tb_daily1

/** Una partida del reto terminada en este dispositivo. */
export interface DailyRunLocal {
  /** destruidos, escapados, ticks, mejor racha, fin (ms) */
  k: number;
  m: number;
  t: number;
  s: number;
  d: number;
}

export interface DailyDayLocal {
  /** Intentos empezados en este dispositivo (con o sin cuenta). */
  used: number;
  runs: DailyRunLocal[];
  /** Partida de invitado por reclamar (`at`: cuándo terminó; sin `at`, todavía no termina). */
  claim?: { runId: string; claimToken: string; at?: number };
  /** Invitado: dónde habría quedado (la respuesta de terminar). */
  would?: { rank: number; total: number; pct: number };
}

export interface DailyLocal {
  days: Record<DateKey, DailyDayLocal>;
  /** Fechas con una partida del reto terminada, en orden (racha del invitado). */
  played: DateKey[];
  /** Ya vio la hoja de reglas (la siguiente vez la tarjeta empieza directo). */
  rulesSeen: boolean;
  /** Fecha del último "Ayer quedaste…" que se mostró. */
  yesterdaySeen: DateKey | null;
  /** Invitado: mejor "mejor que el N %" (0 en días con menos de 10 jugadores), o null. */
  bestPct: number | null;
}

export const EMPTY_DAILY: DailyLocal = { days: {}, played: [], rulesSeen: false, yesterdaySeen: null, bestPct: null };

const nat = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function parseRun(v: unknown): DailyRunLocal | null {
  if (!isObj(v) || typeof v.k !== 'number') return null;
  return { k: nat(v.k), m: nat(v.m), t: nat(v.t), s: nat(v.s), d: nat(v.d) };
}

function parseDay(v: unknown): DailyDayLocal {
  const o = isObj(v) ? v : {};
  const day: DailyDayLocal = {
    used: nat(o.used),
    runs: Array.isArray(o.runs) ? o.runs.map(parseRun).filter((r): r is DailyRunLocal => r !== null) : [],
  };
  const c = o.claim;
  if (isObj(c) && typeof c.runId === 'string' && typeof c.claimToken === 'string') {
    day.claim = { runId: c.runId, claimToken: c.claimToken, ...(typeof c.at === 'number' ? { at: c.at } : {}) };
  }
  const w = o.would;
  if (isObj(w) && typeof w.rank === 'number' && typeof w.total === 'number') day.would = { rank: nat(w.rank), total: nat(w.total), pct: nat(w.pct) };
  return day;
}

/** Lee `tb_daily1` tolerando datos viejos o rotos. */
export function parseDailyLocal(raw: string | null): DailyLocal {
  if (!raw) return { ...EMPTY_DAILY, days: {}, played: [] };
  try {
    const o: unknown = JSON.parse(raw);
    if (!isObj(o)) return { ...EMPTY_DAILY, days: {}, played: [] };
    const days: Record<DateKey, DailyDayLocal> = {};
    if (isObj(o.days)) for (const [k, v] of Object.entries(o.days)) if (isDateKey(k)) days[k] = parseDay(v);
    const played = Array.isArray(o.played) ? [...new Set(o.played.filter(isDateKey))].sort() : [];
    return {
      days,
      played,
      rulesSeen: o.rulesSeen === true,
      yesterdaySeen: isDateKey(o.yesterdaySeen) ? o.yesterdaySeen : null,
      bestPct: typeof o.bestPct === 'number' && Number.isFinite(o.bestPct) ? nat(o.bestPct) : null,
    };
  } catch {
    return { ...EMPTY_DAILY, days: {}, played: [] };
  }
}

/** Deja solo los últimos DAYS_KEPT días con detalle y PLAYED_MAX fechas jugadas. */
function prune(d: DailyLocal, ref: DateKey): DailyLocal {
  const from = dayIndex(ref) - DAYS_KEPT;
  const days: Record<DateKey, DailyDayLocal> = {};
  for (const [k, v] of Object.entries(d.days)) if (dayIndex(k) > from) days[k] = v;
  const played = d.played.length > PLAYED_MAX ? d.played.slice(-PLAYED_MAX) : d.played;
  return { ...d, days, played };
}

let current: DailyLocal | null = null;
const listeners = new Set<() => void>();

/** Estado local del reto (el mismo objeto mientras no cambie). */
export function loadDailyLocal(): DailyLocal {
  if (!current) current = parseDailyLocal(storage.get(DAILY_KEY));
  return current;
}

function save(next: DailyLocal, ref: DateKey) {
  const keys = Object.keys(next.days);
  const newest = keys.reduce((a, b) => (b > a ? b : a), ref);
  current = prune(next, newest);
  try {
    storage.set(DAILY_KEY, JSON.stringify(current));
  } catch {}
  listeners.forEach((l) => l());
}

export function subscribeDailyLocal(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Hook: estado local del reto; se vuelve a dibujar al cambiar. */
export function useDailyLocal(): DailyLocal {
  return useSyncExternalStore(subscribeDailyLocal, loadDailyLocal, loadDailyLocal);
}

const dayOf = (d: DailyLocal, date: DateKey): DailyDayLocal => d.days[date] ?? { used: 0, runs: [] };

function updateDay(date: DateKey, fn: (day: DailyDayLocal) => DailyDayLocal, extra: Partial<DailyLocal> = {}) {
  const d = loadDailyLocal();
  save({ ...d, ...extra, days: { ...d.days, [date]: fn(dayOf(d, date)) } }, date);
}

/**
 * Se empezó una partida del reto (`POST /runs` respondió): gasta un intento en este
 * dispositivo. Como invitado, `claim` guarda la partida para poder reclamarla al iniciar sesión.
 */
export function markDailyStarted(date: DateKey, claim?: { runId: string; claimToken?: string | null }) {
  if (!isDateKey(date)) return;
  updateDay(date, (day) => ({
    ...day,
    used: day.used + 1,
    ...(claim?.claimToken ? { claim: { runId: claim.runId, claimToken: claim.claimToken } } : {}),
  }));
}

/** Terminó una partida del reto: la guarda, marca el día como jugado y abre el plazo para reclamarla. */
export function recordDailyFinish(
  date: DateKey,
  r: { killed: number; missed: number; durationTicks: number; bestStreak: number },
  now = Date.now(),
) {
  if (!isDateKey(date)) return;
  const d = loadDailyLocal();
  const played = d.played.includes(date) ? d.played : [...d.played, date].sort();
  updateDay(
    date,
    (day) => ({
      ...day,
      runs: [...day.runs, { k: nat(r.killed), m: nat(r.missed), t: nat(r.durationTicks), s: nat(r.bestStreak), d: now }],
      ...(day.claim && day.claim.at === undefined ? { claim: { ...day.claim, at: now } } : {}),
    }),
    { played },
  );
}

/** Invitado: guarda dónde habría quedado (y su mejor porcentaje para el logro). */
export function recordDailyGuestResult(date: DateKey, r: { rank: number; total: number; betterThanPct: number }) {
  if (!isDateKey(date)) return;
  const pct = r.total >= PCT_MIN_PLAYERS ? nat(r.betterThanPct) : 0;
  const bestPct = Math.max(loadDailyLocal().bestPct ?? 0, pct);
  updateDay(date, (day) => ({ ...day, would: { rank: nat(r.rank), total: nat(r.total), pct: nat(r.betterThanPct) } }), { bestPct });
}

/** La partida de invitado de esa fecha ya se reclamó (o ya no se puede): se olvida. */
export function markDailyClaimed(date: DateKey) {
  const day = loadDailyLocal().days[date];
  if (!day?.claim) return;
  updateDay(date, (d) => {
    const rest = { ...d };
    delete rest.claim;
    return rest;
  });
}

export interface PendingClaim {
  date: DateKey;
  runId: string;
  claimToken: string;
}

/** Partidas de invitado terminadas hace menos de CLAIM_WINDOW_MS, para reclamarlas al iniciar sesión. */
export function pendingDailyClaims(d: DailyLocal, now = Date.now()): PendingClaim[] {
  const out: PendingClaim[] = [];
  for (const [date, day] of Object.entries(d.days)) {
    const c = day.claim;
    if (c && c.at !== undefined && now - c.at <= CLAIM_WINDOW_MS) out.push({ date, runId: c.runId, claimToken: c.claimToken });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export const markRulesSeen = () => {
  const d = loadDailyLocal();
  if (!d.rulesSeen) save({ ...d, rulesSeen: true }, localDateKey());
};

export const markYesterdaySeen = (date: DateKey) => {
  const d = loadDailyLocal();
  if (d.yesterdaySeen !== date && isDateKey(date)) save({ ...d, yesterdaySeen: date }, localDateKey());
};

// ---------------------------------------------------------------- lecturas

/** Intentos empezados en este dispositivo esa fecha. */
export const localUsed = (d: DailyLocal, date: DateKey) => d.days[date]?.used ?? 0;

/** Partidas del reto terminadas en este dispositivo esa fecha. */
export const localRuns = (d: DailyLocal, date: DateKey): readonly DailyRunLocal[] => d.days[date]?.runs ?? [];

/** La mejor de varias partidas (más destruidos; a igualdad, menos escapados). */
export function bestRunOf(runs: readonly DailyRunLocal[]): DailyRunLocal | null {
  let best: DailyRunLocal | null = null;
  for (const r of runs) if (!best || r.k > best.k || (r.k === best.k && r.m < best.m)) best = r;
  return best;
}

/** Racha de días del reto jugados en este dispositivo. */
export const localStreak = (d: DailyLocal, today: DateKey): DailyStreak => dailyStreak(d.played, today);

/** Mejor racha de días jugada en este dispositivo (no depende de hoy). */
export function localStreakBest(d: DailyLocal): number {
  const last = d.played[d.played.length - 1];
  return dailyStreak(d.played, last ?? DAILY_EPOCH).best;
}

// ---------------------------------------------------------------- estado de la tarjeta

/** Lo que trae `GET /daily` que usa la tarjeta (ver `DailyOverview` en `api/daily.ts`). */
export interface DailyServerView {
  number: number;
  title: string;
  mods: GameMods | null;
  attemptsMax: number;
  attemptsUsed: number;
  best: { killed: number; missed: number } | null;
  streak: DailyStreak;
  /** Fechas jugadas en los 7 días que terminan en la fecha pedida (opcional: la API anterior no lo manda). */
  week?: readonly string[];
}

export interface DailyStatus extends DailyInfo {
  attemptsMax: number;
  attemptsUsed: number;
  attemptsLeft: number;
  /** Con sesión, mientras no llega `GET /daily`: los intentos todavía no se conocen. */
  attemptsKnown: boolean;
  canPlay: boolean;
  /** Mejor resultado del día (del servidor con sesión; de este dispositivo como invitado). */
  best: { killed: number; missed: number } | null;
  streak: DailyStreak;
  /** Días jugados (para la tira de la semana). */
  played: DateKey[];
}

/**
 * Estado del reto de hoy para la tarjeta y la pantalla final. Con sesión manda el servidor
 * (intentos, mejor, racha); como invitado, `tb_daily1` (1 intento, D8). Los intentos que se
 * empezaron en este dispositivo con una cuenta también cuentan para el invitado: cerrar sesión
 * no da intentos nuevos.
 */
export function dailyStatus(o: { date: DateKey; loggedIn: boolean; server?: DailyServerView | null; local: DailyLocal }): DailyStatus {
  const { date, loggedIn, server, local } = o;
  const info = dailyInfo(date);
  const localBest = bestRunOf(localRuns(local, date));
  let played = [...local.played];
  let attemptsMax: number;
  let attemptsUsed: number;
  let attemptsKnown = true;
  let best: { killed: number; missed: number } | null;
  let streak: DailyStreak;
  if (loggedIn) {
    attemptsMax = server?.attemptsMax ?? DAILY_ATTEMPTS_ACCOUNT;
    attemptsUsed = server ? server.attemptsUsed : 0;
    attemptsKnown = !!server;
    best = server ? server.best && { killed: server.best.killed, missed: server.best.missed } : localBest && { killed: localBest.k, missed: localBest.m };
    streak = server?.streak ?? localStreak(local, date);
    // la semana de la cuenta (`week` de GET /daily) manda; sin ella, lo jugado en este dispositivo
    if (server?.week) played = server.week.filter(isDateKey);
    if (server?.best && !played.includes(date)) played.push(date);
  } else {
    attemptsMax = DAILY_ATTEMPTS_GUEST;
    attemptsUsed = localUsed(local, date);
    best = localBest && { killed: localBest.k, missed: localBest.m };
    streak = localStreak(local, date);
  }
  const attemptsLeft = Math.max(0, attemptsMax - attemptsUsed);
  return {
    ...info,
    ...(server ? { number: server.number, title: server.title, mods: server.mods } : {}),
    attemptsMax,
    attemptsUsed: Math.min(attemptsUsed, attemptsMax),
    attemptsLeft,
    attemptsKnown,
    canPlay: attemptsLeft > 0,
    best,
    streak,
    played: played.sort(),
  };
}

/** ¿Se muestra el aviso de ayer? Una vez por fecha. */
export const shouldShowYesterday = (local: DailyLocal, yesterday: { date: DateKey } | null | undefined) =>
  !!yesterday && local.yesterdaySeen !== yesterday.date;

// ---------------------------------------------------------------- inicio

/** Lo que decide si ya se presentan el reto, las misiones y "Retar a un amigo". */
export interface UnlockState {
  /** ¿Hay API configurada? Sin ella no existen. */
  accounts: boolean;
  /** Visitas de este dispositivo (`onboarding.ts`). */
  visits: number;
  /** Partidas terminadas: las de este dispositivo o las de la cuenta, la mayor (`playedRuns`). */
  runs: number;
}

/**
 * ¿Se presentan el reto y las misiones (y "Retar a un amigo")? Con la API configurada, desde la
 * 2.ª visita del dispositivo o desde DAILY_FROM_RUNS partidas, lo que llegue primero. Contar las
 * partidas de la cuenta hace que la misma cuenta en un celular nuevo los vea al tiro.
 */
export const dailyVisible = (o: UnlockState) => o.accounts && (o.visits >= DAILY_FROM_VISIT || o.runs >= DAILY_FROM_RUNS);

/** Partidas que cuentan para desbloquear: las de este dispositivo o las de la cuenta, la mayor. */
export const playedRuns = (localRuns: number, user?: { stats?: { totalRuns: number } } | null) =>
  Math.max(localRuns, user?.stats?.totalRuns ?? 0);

/**
 * Cuántas partidas le faltan para desbloquearlos, para avisarle que jugar los activa; null si ya
 * se ven, si no hay API o si todavía no termina ninguna (la 1.ª partida es solo para jugar).
 */
export function runsToUnlock(o: UnlockState): number | null {
  if (!o.accounts || dailyVisible(o) || o.runs < 1) return null;
  return DAILY_FROM_RUNS - o.runs;
}

/** "Te faltan 2 partidas para desbloquear el reto del día y las misiones." */
export const unlockHintText = (left: number) =>
  `Te ${left === 1 ? 'falta 1 partida' : `faltan ${left} partidas`} para desbloquear el reto del día y las misiones.`;

/** Parámetro del enlace que comparte el reto: `…/touched-block/?diario=1`. */
export const DAILY_PARAM = 'diario';

/** ¿La URL trae `?diario=1`? (de los parámetros de la ruta). */
export function readDailyParam(params: Record<string, unknown> | null | undefined): boolean {
  const v = params?.[DAILY_PARAM];
  const s = Array.isArray(v) ? v[0] : v;
  return s === '1' || s === 'true' || s === '';
}

/** Botón principal después de una partida del reto: "Otro intento (quedan 2)" / "Otro intento (queda 1)". */
export const anotherAttemptText = (left: number) => `Otro intento (${left === 1 ? 'queda 1' : `quedan ${left}`})`;

export type HomeCard = 'daily' | 'install' | null;

/**
 * Como máximo una tarjeta promocional a la vez en el inicio (plan, "Para que lo nuevo no
 * estorbe"): el reto mientras le queden intentos; si no, la de instalar (si corresponde); si no
 * hay nada que instalar, el reto con "Vuelve mañana".
 */
export function homeCard(o: { daily: boolean; dailyPlayable: boolean; install: boolean }): HomeCard {
  if (o.daily && o.dailyPlayable) return 'daily';
  if (o.install) return 'install';
  return o.daily ? 'daily' : null;
}

// ---------------------------------------------------------------- hooks de tiempo

/** Fecha local de hoy; cambia sola a la medianoche (y al volver a la pestaña). */
export function useToday(): DateKey {
  const [today, setToday] = useState(() => localDateKey());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () =>
      setToday((prev) => {
        const k = localDateKey();
        return k === prev ? prev : k;
      });
    const schedule = () => {
      // como mucho cada hora: los temporizadores largos se atrasan si el equipo se suspende
      timer = setTimeout(() => {
        check();
        schedule();
      }, Math.min(msToNextMidnight() + 500, 60 * 60 * 1000));
    };
    schedule();
    const hasDoc = typeof document !== 'undefined';
    const onVisible = () => {
      try {
        if (document.visibilityState !== 'hidden') check();
      } catch {}
    };
    if (hasDoc) document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      if (hasDoc) document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return today;
}

/** Milisegundos hasta la próxima medianoche local, actualizado cada segundo. */
export function useMsToMidnight(): number {
  const [ms, setMs] = useState(() => msToNextMidnight());
  useEffect(() => {
    const id = setInterval(() => setMs(msToNextMidnight()), 1000);
    return () => clearInterval(id);
  }, []);
  return ms;
}
