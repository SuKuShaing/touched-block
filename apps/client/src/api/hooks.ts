import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { tierRefForTicks } from '@tb/engine';
import { features } from '@/config';
import { ApiError } from './client';
import { fetchChallenge, fetchFollowing, fetchLeaderboard, fetchMe, fetchMyRuns, fetchProfile } from './endpoints';
import { session, useSession } from './session';
import type { Leaderboard, Period, PlayerStats, Scope, TierRef } from './types';

/**
 * Consultas con TanStack Query. Las claves incluyen el id del usuario (o 'guest'), así que al
 * iniciar o cerrar sesión se vuelven a pedir solas.
 */
export function useViewer() {
  const s = useSession();
  return { ...s, key: s.user?.id ?? (s.status === 'authed' ? 'authed' : 'guest'), loggedIn: s.status === 'authed' };
}

/** GET /me en segundo plano (actualiza invitados, corazones…); el valor vive en la sesión. */
export function useMeRefresh() {
  const v = useViewer();
  return useQuery({ queryKey: ['me', v.key], queryFn: fetchMe, enabled: features.accounts && v.loggedIn, staleTime: 15_000 });
}

export function useLeaderboard(scope: Scope, period: Period, country: string | null, enabled = true) {
  const v = useViewer();
  return useQuery({
    queryKey: ['lb', scope, period, country, v.key],
    queryFn: () => fetchLeaderboard(scope, period, country),
    enabled: features.accounts && enabled,
    // al cambiar de pestaña o filtro se sigue viendo la lista anterior (atenuada) hasta que llega la nueva
    placeholderData: keepPreviousData,
  });
}

/**
 * Pide el ranking semanal de amigos (con la misma clave de caché que `useLeaderboard`), para los
 * avisos de la partida y la cercanía de la pantalla final. Sin sesión o sin API devuelve null;
 * nunca lanza.
 */
export function useFetchFriendsWeek() {
  const qc = useQueryClient();
  return useCallback(async (): Promise<Leaderboard | null> => {
    const s = session.get();
    if (!features.accounts || s.status !== 'authed') return null;
    const key = s.user?.id ?? 'authed';
    try {
      return await qc.fetchQuery({
        queryKey: ['lb', 'friends', 'week', null, key],
        queryFn: () => fetchLeaderboard('friends', 'week', null),
        staleTime: 30_000,
      });
    } catch {
      return null;
    }
  }, [qc]);
}

export function useMyRuns(period: Period, enabled = true) {
  const v = useViewer();
  return useQuery({
    queryKey: ['myRuns', period, v.key],
    queryFn: () => fetchMyRuns(period),
    enabled: features.accounts && v.loggedIn && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useProfile(username: string) {
  const v = useViewer();
  return useQuery({
    queryKey: ['profile', username.toLowerCase(), v.key],
    queryFn: () => fetchProfile(username),
    enabled: features.accounts && !!username,
  });
}

export function useFollowing() {
  const v = useViewer();
  return useQuery({ queryKey: ['following', v.key], queryFn: fetchFollowing, enabled: features.accounts && v.loggedIn });
}

/**
 * GET /challenges/:code (la invitación al abrir un enlace de reto). Sin reintentos para un reto que
 * no existe; los errores de red se reintentan una vez (por defecto del QueryClient).
 */
export function useChallenge(code: string | null) {
  const v = useViewer();
  return useQuery({
    queryKey: ['challenge', code, v.key],
    queryFn: () => fetchChallenge(code!),
    enabled: features.accounts && !!code,
    staleTime: 15_000,
    retry: (count, e) => e instanceof ApiError && e.status === 0 && e.code !== 'no_api' && count < 1,
  });
}

/** Insignia pública como la calcula el servidor (`tierOf`): null si todavía no hay partidas válidas. */
export const tierOfStats = (s: Pick<PlayerStats, 'bestTicks' | 'totalRuns'>): TierRef | null =>
  s.totalRuns > 0 ? tierRefForTicks(s.bestTicks) : null;

/**
 * Después de una partida válida con sesión: `RunResult.stats` pasa al usuario de la sesión (y su
 * insignia), para que la Colección y la insignia queden al día sin esperar a GET /me. Solo si la
 * sesión sigue siendo la de quien jugó (`ownerId`).
 */
export function applyRunStats(stats: PlayerStats | undefined, ownerId: string | null) {
  const u = session.get().user;
  if (!stats || !u || (ownerId && u.id !== ownerId)) return;
  session.setUser({ ...u, stats, tier: tierOfStats(stats) });
}

/** Invalida lo que depende de mis datos (después de jugar, seguir, cambiar país…). */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => {
    for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
  };
}
