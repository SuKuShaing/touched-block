import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { features } from '@/config';
import { fetchFollowing, fetchLeaderboard, fetchMe, fetchMyRuns, fetchProfile } from './endpoints';
import { useSession } from './session';
import type { Period, Scope } from './types';

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

/** Invalida lo que depende de mis datos (después de jugar, seguir, cambiar país…). */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => {
    for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
  };
}
