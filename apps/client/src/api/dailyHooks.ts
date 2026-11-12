import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { type DateKey, isDateKey } from '@tb/engine';
import { toast } from '@/components/Toast';
import { features } from '@/config';
import { type DailyStatus, dailyStatus, loadDailyLocal, markDailyClaimed, pendingDailyClaims, tzOffsetMinutes, useDailyLocal } from '@/lib/daily';
import { loadHist } from '@/lib/history';
import { guestMissions, rewardMissions } from '@/lib/missions';
import { useLocalStats } from '@/lib/stats';
import { isApiError } from './client';
import { type DailyOverview, type MissionView, fetchDaily, fetchDailyLeaderboard, fetchMissions } from './daily';
import { claimRun } from './endpoints';
import { useViewer } from './hooks';
import type { Scope } from './types';

/**
 * Consultas del reto diario y las misiones. Las claves incluyen el id del usuario (o 'guest'),
 * como en `hooks.ts`. Después de una partida del reto conviene invalidar 'daily', 'dailyLb' y
 * 'missions'.
 */

/** GET /daily de esa fecha (con o sin sesión). */
export function useDaily(date: DateKey, enabled = true) {
  const v = useViewer();
  return useQuery({
    queryKey: ['daily', date, v.key],
    queryFn: () => fetchDaily(date),
    enabled: features.accounts && enabled && isDateKey(date),
  });
}

/** GET /daily/leaderboard (mundo, país o amigos) de esa fecha. */
export function useDailyLeaderboard(date: DateKey, scope: Scope, country: string | null, enabled = true) {
  const v = useViewer();
  return useQuery({
    queryKey: ['dailyLb', date, scope, country, v.key],
    queryFn: () => fetchDailyLeaderboard(date, scope, country),
    enabled: features.accounts && enabled && isDateKey(date),
    placeholderData: keepPreviousData,
  });
}

/**
 * Estado del reto de hoy para la tarjeta y la pantalla final: con sesión, lo de `GET /daily`;
 * como invitado, lo de `tb_daily1` (`dailyStatus` de `lib/daily.ts`). `overview` trae además el
 * resumen de ayer.
 */
export function useDailyStatus(date: DateKey, enabled = true): { status: DailyStatus; overview: DailyOverview | undefined; loading: boolean } {
  const v = useViewer();
  const local = useDailyLocal();
  const q = useDaily(date, enabled);
  const status = useMemo(() => dailyStatus({ date, loggedIn: v.loggedIn, server: q.data ?? null, local }), [date, v.loggedIn, q.data, local]);
  return { status, overview: q.data, loading: q.isPending && q.fetchStatus !== 'idle' };
}

export interface MissionsState {
  /** Las tres misiones con su avance (null mientras cargan o si fallaron). */
  missions: MissionView[] | null;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Misiones de esa fecha. Con sesión, `GET /missions` (el servidor premia). Como invitado se
 * calculan en el dispositivo y las cumplidas se premian aquí (una sola vez).
 */
export function useTodayMissions(date: DateKey, enabled = true): MissionsState {
  const v = useViewer();
  const server = useQuery({
    queryKey: ['missions', date, v.key],
    queryFn: () => fetchMissions(date, tzOffsetMinutes()),
    enabled: features.accounts && v.loggedIn && enabled && isDateKey(date),
  });

  // invitado: se recalcula al cambiar las estadísticas (cada partida terminada) o el reto local
  const stats = useLocalStats();
  const daily = useDailyLocal();
  const guest = useMemo(
    () => (!v.loggedIn && enabled && isDateKey(date) ? guestMissions(date, loadHist(), daily) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [v.loggedIn, enabled, date, daily, stats],
  );
  useEffect(() => {
    if (guest) rewardMissions(date, guest); // suma bloques extra → cambian `stats` → se recalcula con rewarded
  }, [date, guest]);

  if (v.loggedIn) {
    return {
      missions: server.data?.missions ?? null,
      loading: server.isPending && server.fetchStatus !== 'idle',
      error: server.error,
      refetch: () => void server.refetch(),
    };
  }
  return { missions: guest, loading: false, error: null, refetch: () => {} };
}

/** Errores con los que una partida de invitado ya no se puede reclamar (se olvida). */
const FINAL_CLAIM_ERRORS = new Set([
  'run_already_claimed',
  'run_not_finished',
  'run_not_valid',
  'run_not_found',
  'claim_expired',
  'invalid_claim_token',
  'daily_attempts_exhausted',
]);

/**
 * Al iniciar sesión, reclama las partidas del reto que se jugaron como invitado en la última
 * hora (`tb_daily1`). `exclude` es la partida que está reclamando la pantalla final, para no
 * pedirla dos veces. La API solo acepta el reclamo si la cuenta todavía no jugó el reto de esa
 * fecha: si ya lo jugó (`409 daily_attempts_exhausted`) no es un error, la partida se olvida sin
 * avisar. Si se reclama, un aviso breve lo cuenta.
 */
export function useClaimPendingDaily(exclude?: string | null) {
  const v = useViewer();
  const qc = useQueryClient();
  const busy = useRef(false);
  const excludeRef = useRef(exclude);
  excludeRef.current = exclude;

  useEffect(() => {
    if (!features.accounts || !v.loggedIn || busy.current) return;
    const pending = pendingDailyClaims(loadDailyLocal()).filter((p) => p.runId !== excludeRef.current);
    if (pending.length === 0) return;
    busy.current = true;
    void (async () => {
      let claimed = false;
      for (const p of pending) {
        try {
          await claimRun(p.runId, p.claimToken);
          markDailyClaimed(p.date);
          claimed = true;
        } catch (e) {
          if (isApiError(e) && FINAL_CLAIM_ERRORS.has(e.code)) markDailyClaimed(p.date);
          // sin red u otro error: se reintenta la próxima vez
        }
      }
      busy.current = false;
      if (claimed) {
        toast('Tu partida del reto diario quedó guardada en tu cuenta');
        for (const k of ['daily', 'dailyLb', 'missions', 'me']) void qc.invalidateQueries({ queryKey: [k] });
      }
    })();
  }, [v.loggedIn, v.key, qc]);
}
