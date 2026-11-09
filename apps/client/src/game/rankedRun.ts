import { RULES_VERSION } from '@tb/engine';
import { finishRun, startRun } from '@/api/endpoints';
import type { RunResult } from '@/api/types';
import { features } from '@/config';
import type { GameResult } from './types';

/** Máximo que se espera a POST /runs antes de empezar con una semilla local. */
export const START_WAIT_MS = 1500;

/** Cómo se juega la partida: con una semilla del servidor (puede entrar al ranking) o local. */
export type RunMode =
  | { kind: 'local'; reason: 'off' | 'offline' | 'outdated' }
  | { kind: 'server'; runId: string; seed: number; maxLives: number; claimToken?: string };

const FIELD_MIN = 160;
const FIELD_MAX = 4096;

/** POST /runs, sin demorar el inicio más de START_WAIT_MS. Nunca lanza. */
export async function prepareRun(fieldW: number, fieldH: number): Promise<RunMode> {
  if (!features.accounts) return { kind: 'local', reason: 'off' };
  if (fieldW < FIELD_MIN || fieldH < FIELD_MIN || fieldW > FIELD_MAX || fieldH > FIELD_MAX) return { kind: 'local', reason: 'offline' };
  try {
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), START_WAIT_MS));
    const r = await Promise.race([startRun(fieldW, fieldH, START_WAIT_MS).catch(() => null), timeout]);
    if (!r) return { kind: 'local', reason: 'offline' };
    if (r.rulesVersion !== RULES_VERSION) return { kind: 'local', reason: 'outdated' };
    return { kind: 'server', runId: r.runId, seed: r.seed, maxLives: r.maxLives, claimToken: r.claimToken };
  } catch {
    return { kind: 'local', reason: 'offline' };
  }
}

/** POST /runs/:id/finish con los toques y el resultado. */
export function submitRun(mode: Extract<RunMode, { kind: 'server' }>, r: GameResult): Promise<RunResult> {
  return finishRun(mode.runId, {
    inputs: r.inputs,
    killed: r.killed,
    missed: r.missed,
    ...(mode.claimToken ? { claimToken: mode.claimToken } : {}),
  });
}
