/**
 * Reto diario y misiones del día (fases 4 y 5, ver docs/api.md): tipos y llamadas a
 * `GET /daily`, `GET /daily/leaderboard` y `GET /missions`. Los tipos del objeto `daily` de
 * `POST /runs` y de terminar / reclamar viven en `types.ts` (se reexportan aquí).
 */
import type { DailyStreak, DateKey, GameMods, MissionKind, TierRef } from '@tb/engine';
import { api } from './client';
import type { DailyRunInfo, DailyRunResult, LeaderboardEntry, Scope } from './types';

export type { DailyRunInfo, DailyRunResult, DailyStartInfo, GuestDailyRunResult } from './types';

const q = (params: Record<string, string | number | undefined | null>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? '?' + s : '';
};

// ---- GET /daily ----

/** Mi mejor resultado del día (con sesión). */
export interface DailyBest {
  killed: number;
  missed: number;
  bestStreak: number;
  achievedAt: string;
  /** Posición de ese resultado en el ranking del día. */
  rank: number;
}

/** Resumen del día anterior (null si ese día nadie tuvo resultado). */
export interface DailyYesterday {
  date: DateKey;
  /** Mi posición; null si no jugué ese día o no hay sesión. */
  rank: number | null;
  total: number;
  betterThanPct: number | null;
  winner: { username: string; killed: number };
}

export interface DailyOverview {
  date: DateKey;
  number: number;
  /** El modificador del día en palabras ("Directo a las sumas"). */
  title: string;
  mods: GameMods | null;
  fieldW: number;
  fieldH: number;
  /** 3 con sesión, 1 sin sesión. */
  attemptsMax: number;
  /** Con sesión, partidas del reto de esa fecha que empezó; sin sesión, siempre 0. */
  attemptsUsed: number;
  best: DailyBest | null;
  /** Jugadores con resultado ese día. */
  total: number;
  /** Con sesión, la racha de días; sin sesión, { current: 0, best: 0 }. */
  streak: DailyStreak;
  /**
   * Con sesión, las fechas en que jugó el reto dentro de los 7 días que terminan en `date` (para
   * la tira de la semana); sin sesión, []. Opcional: la API anterior no lo manda.
   */
  week?: DateKey[];
  yesterday: DailyYesterday | null;
}

export const fetchDaily = (date: DateKey) => api<DailyOverview>('GET', '/daily' + q({ date }));

// ---- GET /daily/leaderboard ----

/** Fila fija con mi posición (como en `GET /leaderboards`). */
export interface DailyMe {
  rank: number;
  killed: number;
  missed: number;
  achievedAt: string;
  tier: TierRef | null;
}

export interface DailyLeaderboard {
  scope: Scope;
  date: DateKey;
  number: number;
  country?: string;
  total: number;
  entries: LeaderboardEntry[];
  /** Sin sesión no viene; con sesión es null si no tengo resultado ese día (o en ese país). */
  me?: DailyMe | null;
}

export const fetchDailyLeaderboard = (date: DateKey, scope: Scope, country?: string | null) =>
  api<DailyLeaderboard>(
    'GET',
    '/daily/leaderboard' + q({ date, scope, country: scope === 'country' ? country : undefined, limit: 50 }),
  );

// ---- GET /missions ----

/** Una misión del día con su avance (la API y el cálculo local del invitado dan lo mismo). */
export interface MissionView {
  id: string;
  kind: MissionKind;
  title: string;
  target: number;
  /** Avance, entre 0 y `target`. */
  value: number;
  done: boolean;
  /** Bloques extra para el nivel. */
  reward: number;
  /** El premio ya se entregó. */
  rewarded: boolean;
}

export interface MissionsResponse {
  date: DateKey;
  missions: MissionView[];
  /** Total de bloques extra de la cuenta, ya con los premios de esta lectura. */
  bonusXp: number;
}

/** `tz`: minutos al este de UTC (`-new Date().getTimezoneOffset()`). Requiere sesión. */
export const fetchMissions = (date: DateKey, tz: number) =>
  api<MissionsResponse>('GET', '/missions' + q({ date, tz }), { auth: 'required' });

// ---- terminar / reclamar (modo daily) ----

/**
 * ¿Es el resultado de una cuenta? (Si no, es el de un invitado: "habrías quedado".) El tipo de la
 * cuenta incluye todos los campos del de invitado, así que se distingue por `attemptsLeft`.
 */
export const isAccountDaily = (d: DailyRunInfo): d is DailyRunResult => 'attemptsLeft' in d;

/** ¿Es el resultado de un invitado ("habrías quedado")? */
export const isGuestDaily = (d: DailyRunInfo): boolean => !isAccountDaily(d);
