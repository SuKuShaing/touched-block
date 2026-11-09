import type { TapInput } from '@tb/engine';
import { browserCountry } from '@/lib/countries';
import { api } from './client';
import { session } from './session';
import type {
  CheckUsername,
  FollowUser,
  InviterResult,
  Leaderboard,
  LoginResponse,
  Me,
  MeRuns,
  Period,
  PublicProfile,
  RunResult,
  RunStart,
  Scope,
  SearchUser,
} from './types';

const q = (params: Record<string, string | number | undefined | null>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? '?' + s : '';
};

// ---- auth ----

export async function loginGoogle(idToken: string): Promise<LoginResponse> {
  const country = browserCountry();
  const r = await api<LoginResponse>('POST', '/auth/google', { auth: 'none', body: { idToken, ...(country ? { country } : {}) } });
  session.apply(r);
  return r;
}

/** Cierra la sesión: revoca el refresh token (si se puede) y la borra localmente. */
export async function logout() {
  const rt = session.refreshToken();
  session.clear();
  if (rt) await api('POST', '/auth/logout', { auth: 'none', body: { refreshToken: rt }, timeoutMs: 5000 }).catch(() => {});
}

export async function deleteAccount() {
  await api('DELETE', '/me', { auth: 'required' });
  session.clear();
}

// ---- usuarios ----

export async function fetchMe(): Promise<Me> {
  const me = await api<Me>('GET', '/me', { auth: 'required' });
  session.setUser(me);
  return me;
}

export async function updateMe(patch: { username?: string; country?: string }): Promise<Me> {
  const me = await api<Me>('PATCH', '/me', { auth: 'required', body: patch });
  session.setUser(me);
  return me;
}

export const checkUsername = (u: string, signal?: AbortSignal) =>
  api<CheckUsername>('GET', '/users/check-username' + q({ u }), { signal });

export const searchUsers = (query: string, signal?: AbortSignal) =>
  api<{ users: SearchUser[] }>('GET', '/users/search' + q({ q: query }), { signal });

export const fetchProfile = (username: string) => api<PublicProfile>('GET', '/users/' + encodeURIComponent(username));

// ---- social ----

export const setInviter = (username: string) => api<InviterResult>('POST', '/me/inviter', { auth: 'required', body: { username } });
export const follow = (userId: string) => api<void>('POST', '/follows/' + userId, { auth: 'required' });
export const unfollow = (userId: string) => api<void>('DELETE', '/follows/' + userId, { auth: 'required' });
export const fetchFollowing = () => api<{ users: FollowUser[] }>('GET', '/me/following', { auth: 'required' });

// ---- partidas ----

export const startRun = (fieldW: number, fieldH: number, timeoutMs: number) =>
  api<RunStart>('POST', '/runs', { body: { fieldW, fieldH }, timeoutMs });

export const finishRun = (runId: string, body: { inputs: TapInput[]; killed: number; missed: number; claimToken?: string }) =>
  api<RunResult>('POST', `/runs/${runId}/finish`, { body, timeoutMs: 20_000 });

export const claimRun = (runId: string, claimToken: string) =>
  api<RunResult>('POST', `/runs/${runId}/claim`, { auth: 'required', body: { claimToken } });

export const fetchMyRuns = (period: Period) => api<MeRuns>('GET', '/me/runs' + q({ period, limit: 50 }), { auth: 'required' });

// ---- rankings ----

export const fetchLeaderboard = (scope: Scope, period: Period, country?: string | null) =>
  api<Leaderboard>('GET', '/leaderboards' + q({ scope, period, country: scope === 'country' ? country : undefined, limit: 50 }));
