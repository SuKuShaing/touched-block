/** Tipos de la API (ver apps/api/API.md). */

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
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  isNew: boolean;
  user: Me;
}

export interface RunStart {
  runId: string;
  seed: number;
  maxLives: number;
  rulesVersion: number;
  fieldW: number;
  fieldH: number;
  startedAt: string;
  claimToken?: string;
}

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
}

export interface Leaderboard {
  scope: Scope;
  period: Period;
  periodKey: string;
  country?: string;
  total: number;
  entries: LeaderboardEntry[];
  /** Sin sesión no viene; con sesión es null si no tengo puntaje en ese ranking. */
  me?: { rank: number; killed: number; missed: number; achievedAt: string } | null;
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
