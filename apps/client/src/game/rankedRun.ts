import { type GameMods, RULES_VERSION } from '@tb/engine';
import { ApiError } from '@/api/client';
import { finishRun, startRun } from '@/api/endpoints';
import type { ChallengeStartInfo, DailyStartInfo, RunModeName, RunResult } from '@/api/types';
import { features } from '@/config';
import { type RunStartFailReason, startFailureText } from '@/lib/challenge';
import { FIELD_MAX, FIELD_MIN, serverField } from './playArea';
import type { GameResult } from './types';

/** Máximo que se espera a POST /runs antes de empezar con una semilla local (partida normal). */
export const START_WAIT_MS = 3000;
/** Máximo que se espera a POST /runs en un reto (no hay semilla local de respaldo). */
export const CHALLENGE_WAIT_MS = 10_000;

/**
 * Qué partida empezar:
 * - `normal`: la de siempre (semilla del servidor o, sin conexión, local).
 * - `duel`: reto a un amigo. Sin `challenge` se crea uno nuevo; con él se une a ese reto.
 * - `daily`: reto diario de la fecha local `date` ("AAAA-MM-DD").
 */
export type RunOptions = { mode: 'normal' } | { mode: 'duel'; challenge?: string } | { mode: 'daily'; date: string };

export const NORMAL_RUN: RunOptions = { mode: 'normal' };

/** Partida con semilla del servidor (puede entrar al ranking, al reto o al reto del día). */
export interface ServerRun {
  kind: 'server';
  mode: RunModeName;
  runId: string;
  seed: number;
  maxLives: number;
  /** Solo invitados: para terminar y reclamar la partida. */
  claimToken?: string;
  /** Campo a jugar (el de la respuesta: en los retos lo decide el servidor). */
  fieldW: number;
  fieldH: number;
  /** Modificadores con que hay que crear el juego (null si no hay). */
  mods: GameMods | null;
  /** duel: código del reto y lo que mandó POST /runs (quien lo creó y su resultado, al unirse). */
  challengeCode?: string;
  challenge?: ChallengeStartInfo;
  /** duel: esta partida creó el reto (POST /runs sin código). */
  created?: boolean;
  /** daily: número, título del modificador e intentos. */
  daily?: DailyStartInfo;
}

/** Cómo se juega la partida: con una semilla del servidor o local (solo partidas normales). */
export type RunMode = { kind: 'local'; reason: 'off' | 'offline' | 'outdated' } | ServerRun;

/** No se pudo empezar un reto (duel o daily): no hay semilla local de respaldo. */
export interface RunStartFailure {
  kind: 'failed';
  mode: 'duel' | 'daily';
  reason: RunStartFailReason;
  /** Mensaje listo para mostrar ("El reto necesita conexión."). */
  message: string;
}

export type PreparedRun = RunMode | RunStartFailure;

const failure = (mode: 'duel' | 'daily', reason: RunStartFailReason, serverMessage?: string): RunStartFailure => ({
  kind: 'failed',
  mode,
  reason,
  message: startFailureText(mode, reason, serverMessage),
});

const KNOWN: readonly RunStartFailReason[] = ['challenge_not_found', 'challenge_expired', 'daily_attempts_exhausted', 'daily_date_invalid'];

/** Error de POST /runs en un reto → motivo tipado. */
function failureFrom(mode: 'duel' | 'daily', e: unknown): RunStartFailure {
  if (e instanceof ApiError) {
    if (e.status === 0) return failure(mode, e.code === 'no_api' ? 'off' : 'offline');
    const code = e.code as RunStartFailReason;
    if (KNOWN.includes(code)) return failure(mode, code);
    return failure(mode, 'error', e.message);
  }
  return failure(mode, 'error');
}

/**
 * POST /runs. Nunca lanza.
 * - Partida normal: no demora el inicio más de START_WAIT_MS; sin respuesta (o sin API) se juega
 *   con una semilla local (`{ kind: 'local' }`), como siempre.
 * - Retos (duel, daily): espera hasta CHALLENGE_WAIT_MS y, si no se puede, devuelve
 *   `{ kind: 'failed', reason, message }` para mostrar el motivo: no hay reto sin servidor.
 */
export async function prepareRun(fieldW: number, fieldH: number, opts: RunOptions = NORMAL_RUN): Promise<PreparedRun> {
  const challenge = opts.mode !== 'normal';
  if (!features.accounts) return challenge ? failure(opts.mode, 'off') : { kind: 'local', reason: 'off' };
  if (fieldW < FIELD_MIN || fieldH < FIELD_MIN || fieldW > FIELD_MAX || fieldH > FIELD_MAX) {
    return challenge ? failure(opts.mode, 'error', 'La pantalla es demasiado chica para jugar el reto.') : { kind: 'local', reason: 'offline' };
  }
  const wait = challenge ? CHALLENGE_WAIT_MS : START_WAIT_MS;
  const body = {
    fieldW,
    fieldH,
    mode: opts.mode,
    ...(opts.mode === 'duel' && opts.challenge ? { challenge: opts.challenge } : {}),
    ...(opts.mode === 'daily' ? { date: opts.date } : {}),
  };
  let error: unknown = null;
  try {
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), wait));
    const r = await Promise.race([
      startRun(body, wait).catch((e: unknown) => {
        error = e;
        return null;
      }),
      timeout,
    ]);
    if (!r) {
      if (!challenge) return { kind: 'local', reason: 'offline' };
      return error ? failureFrom(opts.mode, error) : failure(opts.mode, 'offline');
    }
    if (r.rulesVersion !== RULES_VERSION) return challenge ? failure(opts.mode, 'outdated') : { kind: 'local', reason: 'outdated' };
    // normal: si la API (anterior a la fase 3) no manda el campo, es el enviado. Retos: el del
    // servidor o nada (con el de esta pantalla sería otra partida que la de los demás).
    const field = serverField(challenge, { fieldW, fieldH }, r);
    if (!field) return failure(opts.mode === 'daily' ? 'daily' : 'duel', 'error');
    return {
      kind: 'server',
      mode: r.mode ?? 'normal',
      runId: r.runId,
      seed: r.seed,
      maxLives: r.maxLives,
      claimToken: r.claimToken,
      fieldW: field.fieldW,
      fieldH: field.fieldH,
      mods: r.mods ?? null,
      ...(r.challengeCode ? { challengeCode: r.challengeCode } : {}),
      ...(r.challenge ? { challenge: r.challenge } : {}),
      ...(opts.mode === 'duel' && r.challengeCode ? { created: !opts.challenge } : {}),
      ...(r.daily ? { daily: r.daily } : {}),
    };
  } catch (e) {
    return challenge ? failureFrom(opts.mode, e) : { kind: 'local', reason: 'offline' };
  }
}

/** POST /runs/:id/finish con los toques y el resultado. */
export function submitRun(mode: ServerRun, r: GameResult): Promise<RunResult> {
  return finishRun(mode.runId, {
    inputs: r.inputs,
    killed: r.killed,
    missed: r.missed,
    ...(mode.claimToken ? { claimToken: mode.claimToken } : {}),
  });
}

/** ¿La partida es de un reto (duel o daily)? Esas no tocan el récord ni el historial local (D6). */
export const isChallengeMode = (m: RunModeName) => m !== 'normal';
