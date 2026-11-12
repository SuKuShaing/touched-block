/** Tipos de la API (ver docs/api.md). */
import type { GameMods, TierRef } from '@tb/engine';

export type { GameMods, TierRef };

/**
 * Estadísticas de la cuenta (fase 2). Solo las partidas de modo normal cuentan para `bestTicks`
 * y `bestStreak`; `totalKilled` y `totalRuns` cuentan todas.
 */
export interface PlayerStats {
  /** Duración de la partida más larga, en ticks (60 por segundo). Define la insignia. */
  bestTicks: number;
  bestStreak: number;
  totalKilled: number;
  totalRuns: number;
  /** Bloques extra para el nivel (misiones, fase 5). */
  bonusXp: number;
  /** Mejor porcentaje en un reto diario (fase 4), o null. */
  bestDailyPct: number | null;
  /** Mejor racha de días seguidos de reto diario (fase 4). */
  dailyStreakBest: number;
}

export interface UserRef {
  id: string;
  username: string;
}

export interface Me {
  id: string;
  username: string;
  country: string | null;
  countryChangedAt: string | null;
  nextCountryChangeAt: string | null;
  invitedBy: UserRef | null;
  invitedCount: number;
  maxLives: number;
  followingCount: number;
  followersCount: number;
  createdAt: string;
  /** Opcional: la API anterior a la fase 2 no lo manda. */
  stats?: PlayerStats;
  /** Insignia pública (calculada en el servidor), o null si no tiene partidas. */
  tier?: TierRef | null;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  isNew: boolean;
  user: Me;
}

/** Modo de una partida: la de siempre, reto a un amigo o reto diario. */
export type RunModeName = 'normal' | 'duel' | 'daily';

/** Cuerpo de POST /runs. `challenge` solo con `duel` (sin él se crea un reto); `date` solo con `daily`. */
export interface StartRunBody {
  /** Tamaño real del campo en px lógicos (también en los retos). */
  fieldW: number;
  fieldH: number;
  mode?: RunModeName;
  challenge?: string;
  /** Fecha local del jugador "AAAA-MM-DD" (reto diario). */
  date?: string;
}

/** Resultado de quien creó un reto (al unirse). `username`/`tier` null: invitado que no reclamó. */
export interface ChallengeCreator {
  username: string | null;
  tier: TierRef | null;
  killed: number;
  missed: number;
}

/** `challenge` de POST /runs en modo duel. `creator` null al crearlo o si quien lo creó no lo terminó. */
export interface ChallengeStartInfo {
  code: string;
  expiresAt: string;
  creator: ChallengeCreator | null;
}

/** `daily` de POST /runs en modo daily. */
export interface DailyStartInfo {
  date: string;
  /** "Reto #6". */
  number: number;
  /** El modificador del día en palabras ("Directo a las sumas"). */
  title: string;
  /** 3 con sesión, 1 como invitado. */
  attemptsMax: number;
  /** Intentos gastados contando este (como invitado siempre 1: los cuenta el cliente). */
  attemptsUsed: number;
}

/** Respuesta de POST /runs. */
export interface RunStart {
  runId: string;
  seed: number;
  maxLives: number;
  rulesVersion: number;
  /** El campo a jugar: en `normal` el enviado; en los retos lo decide el servidor. */
  fieldW: number;
  fieldH: number;
  startedAt: string;
  claimToken?: string;
  /** Opcionales: la API anterior a la fase 3 no los manda (entonces es `normal` sin modificadores). */
  mode?: RunModeName;
  mods?: GameMods | null;
  /** Solo en `duel`. */
  challengeCode?: string;
  challenge?: ChallengeStartInfo;
  /** Solo en `daily`. */
  daily?: DailyStartInfo;
}

/** Un resultado de un reto a un amigo (GET /challenges/:code). */
export interface ChallengeEntry {
  /** null: invitado que no reclamó su partida. */
  username: string | null;
  tier: TierRef | null;
  killed: number;
  missed: number;
  /** Es de quien llama (con sesión) o de la partida `runId` (invitado). */
  isMe: boolean;
  /** Es la partida con que se creó el reto. */
  isCreator: boolean;
  createdAt: string;
}

/** GET /challenges/:code (y `challenge` de RunResult en modo duel). */
export interface ChallengeView {
  code: string;
  /** false si venció o es de otra versión de reglas. */
  playable: boolean;
  expiresAt: string;
  fieldW: number;
  fieldH: number;
  /** Hasta 100, ordenados como los rankings. */
  entries: ChallengeEntry[];
}

/** `daily` de RunResult (terminar o reclamar) con sesión: el día de la cuenta. */
export interface DailyRunResult {
  date: string;
  number: number;
  /** Intentos que quedan ese día. */
  attemptsLeft: number;
  /** Esta partida quedó como su mejor del día. */
  isBestToday: boolean;
  /** Posición de su mejor resultado del día. */
  rank: number;
  total: number;
  /** "Mejor que el N %". Con menos de 10 jugadores conviene mostrar la posición. */
  betterThanPct: number;
  /** Entre quienes sigue y jugaron ese día: cuántos tienen peor puntaje que su mejor. */
  friends: { beaten: number; total: number };
  /** Racha de días jugando el reto. */
  streak: { current: number; best: number };
}

/** `daily` de RunResult de un invitado: dónde habría quedado (su resultado no entra al ranking del día). */
export interface GuestDailyRunResult {
  date: string;
  number: number;
  rank: number;
  /** Lo cuenta a él. */
  total: number;
  betterThanPct: number;
}

/** `daily` de RunResult: el de la cuenta o el del invitado (se distinguen con `isAccountDaily` de `api/daily.ts`). */
export type DailyRunInfo = DailyRunResult | GuestDailyRunResult;

export type Period = 'week' | 'month' | 'year' | 'all';
export type Scope = 'world' | 'country' | 'friends';

export interface Ranks {
  world: number;
  country: number | null;
}

/** Respuesta de POST /runs/:id/finish y /claim. */
export interface RunResult {
  runId: string;
  valid: boolean;
  killed: number;
  missed: number;
  durationMs: number;
  // rechazada
  reason?: string;
  message?: string;
  // válida con sesión (o reclamada)
  isNewBest?: boolean;
  newBestPeriods?: Period[];
  ranks?: Ranks | null;
  // válida de invitado
  claimable?: boolean;
  claimExpiresAt?: string;
  /** Válida con sesión (o reclamada): estadísticas de la cuenta después de la partida. */
  stats?: PlayerStats;
  /** Válida de reto a un amigo: el reto con este resultado incluido. */
  challenge?: ChallengeView;
  /** Válida del reto diario: con sesión, el día de la cuenta; como invitado, dónde habría quedado. */
  daily?: DailyRunInfo;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  country: string | null;
  killed: number;
  missed: number;
  achievedAt: string;
  isMe?: boolean;
  tier?: TierRef | null;
}

export interface Leaderboard {
  scope: Scope;
  period: Period;
  periodKey: string;
  country?: string;
  total: number;
  entries: LeaderboardEntry[];
  /** Sin sesión no viene; con sesión es null si no tengo puntaje en ese ranking. */
  me?: { rank: number; killed: number; missed: number; achievedAt: string; tier?: TierRef | null } | null;
}

export interface MeRun {
  id: string;
  killed: number;
  missed: number;
  durationMs: number;
  maxLives: number;
  finishedAt: string;
  isBest: boolean;
}

export interface MeRuns {
  period: Period;
  periodKey: string;
  best: { runId: string; killed: number; missed: number; achievedAt: string } | null;
  runs: MeRun[];
}

export interface PublicProfile {
  id: string;
  username: string;
  country: string | null;
  best: { killed: number; missed: number; achievedAt: string } | null;
  invitedCount: number;
  followersCount: number;
  followingCount: number;
  createdAt: string;
  isMe?: boolean;
  isFollowing?: boolean;
  tier?: TierRef | null;
}

export interface SearchUser {
  id: string;
  username: string;
  country: string | null;
  isFollowing?: boolean;
}

export interface FollowUser {
  id: string;
  username: string;
  country: string | null;
  followedAt: string;
}

export interface CheckUsername {
  username: string;
  valid: boolean;
  available: boolean;
  message?: string;
}

export interface InviterResult {
  inviter: UserRef;
  inviterInvitedCount: number;
  inviterMaxLives: number;
}
