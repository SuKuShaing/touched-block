import type { TapInput } from '@tb/engine';
import { browserCountry } from '@/lib/countries';
import { auth } from '@/platform/auth';
import { runPlatform } from '@/platform/runPlatform';
import { ApiError, api } from './client';
import { session } from './session';
import type {
  ChallengeView,
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
  StartRunBody,
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
  void auth.signOut?.();
  if (rt) await api('POST', '/auth/logout', { auth: 'none', body: { refreshToken: rt }, timeoutMs: 5000 }).catch(() => {});
}

export async function deleteAccount() {
  await api('DELETE', '/me', { auth: 'required' });
  session.clear();
  // como en logout(): en la app suelta la cuenta de Google elegida
  void auth.signOut?.();
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

/** Cuerpo de POST /runs. Sin `mode` (o con `normal`) se manda solo el tamaño, como antes de la fase 3. */
function startRunBody(body: StartRunBody) {
  return !body.mode || body.mode === 'normal'
    ? { fieldW: body.fieldW, fieldH: body.fieldH }
    : {
        fieldW: body.fieldW,
        fieldH: body.fieldH,
        mode: body.mode,
        ...(body.mode === 'duel' && body.challenge ? { challenge: body.challenge } : {}),
        ...(body.mode === 'daily' && body.date ? { date: body.date } : {}),
      };
}

/** La API anterior a `platform` rechaza campos desconocidos (400 validation_error en `platform`). */
const rejectsPlatform = (e: unknown) =>
  e instanceof ApiError &&
  e.status === 400 &&
  e.code === 'validation_error' &&
  Array.isArray(e.body.fields) &&
  e.body.fields.some((f: unknown) => (f as { field?: unknown } | null)?.field === 'platform');

/** La API ya rechazó `platform` una vez: no se vuelve a mandar hasta recargar (sin dos POST por partida). */
let platformRejected = false;

/**
 * POST /runs con `platform` (desde dónde se juega, solo estadística). Si la API todavía no conoce
 * el campo (se publicó la web antes que la API), se repite sin él y se recuerda en memoria.
 */
export async function startRun(body: StartRunBody, timeoutMs: number): Promise<RunStart> {
  const base = startRunBody(body);
  const platform = platformRejected ? null : runPlatform();
  if (!platform) return api<RunStart>('POST', '/runs', { body: base, timeoutMs });
  try {
    return await api<RunStart>('POST', '/runs', { body: { ...base, platform }, timeoutMs });
  } catch (e) {
    if (!rejectsPlatform(e)) throw e;
    platformRejected = true;
    return api<RunStart>('POST', '/runs', { body: base, timeoutMs });
  }
}

export const finishRun = (runId: string, body: { inputs: TapInput[]; killed: number; missed: number; claimToken?: string }) =>
  api<RunResult>('POST', `/runs/${runId}/finish`, { body, timeoutMs: 20_000 });

export const claimRun = (runId: string, claimToken: string) =>
  api<RunResult>('POST', `/runs/${runId}/claim`, { auth: 'required', body: { claimToken } });

export const fetchMyRuns = (period: Period) => api<MeRuns>('GET', '/me/runs' + q({ period, limit: 50 }), { auth: 'required' });

// ---- retos a un amigo ----

/** GET /challenges/:code. `runId` (una partida propia) marca `isMe` también para un invitado. */
export const fetchChallenge = (code: string, runId?: string | null) =>
  api<ChallengeView>('GET', '/challenges/' + encodeURIComponent(code) + q({ runId }), { timeoutMs: 10_000 });

// ---- rankings ----

export const fetchLeaderboard = (scope: Scope, period: Period, country?: string | null) =>
  api<Leaderboard>('GET', '/leaderboards' + q({ scope, period, country: scope === 'country' ? country : undefined, limit: 50 }));
