import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BASE_LIVES,
  DT,
  RULES_VERSION,
  type GameEvent,
  type GameState,
  type TapInput,
  createGame,
  drainEvents,
  randomSeed,
  step,
  tap,
} from '@tb/engine';
import type { GameResult } from './types';

const round1 = (v: number) => Math.round(v * 10) / 10;

export interface RunnerHandlers {
  /** Eventos del motor (sonidos, partículas, textos…), en orden. */
  onEvents(events: GameEvent[], s: GameState): void;
  onEnd(result: GameResult): void;
}

/**
 * Corre el motor: requestAnimationFrame + acumulador de paso fijo (DT = 1/60 s), con el dt de
 * cada cuadro limitado a 0.1 s como en legacy. Los toques se aplican al instante y se guardan
 * como [tick, x, y] para poder repetir la partida.
 */
export function useGameRunner(handlers: RunnerHandlers) {
  const h = useRef(handlers);
  h.current = handlers;

  const gs = useRef<GameState | null>(null);
  const inputs = useRef<TapInput[]>([]);
  const playingRef = useRef(false);
  const raf = useRef(0);
  const last = useRef(0);
  const acc = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [, setFrame] = useState(0);

  const flush = useCallback(() => {
    const s = gs.current;
    if (!s) return;
    const evs = drainEvents(s);
    if (evs.length) h.current.onEvents(evs, s);
    if (s.over && playingRef.current) {
      playingRef.current = false;
      cancelAnimationFrame(raf.current);
      setPlaying(false);
      h.current.onEnd({
        seed: s.config.seed,
        maxLives: s.config.maxLives,
        fieldW: s.config.fieldW,
        fieldH: s.config.fieldH,
        inputs: inputs.current.slice(),
        killed: s.killed,
        missed: s.missed,
        bestStreak: s.bestStreak,
        endReason: s.endReason ?? 'tiempo',
        durationTicks: s.tick,
        rulesVersion: RULES_VERSION,
      });
    }
  }, []);

  const loop = useCallback(
    (ts: number) => {
      const s = gs.current;
      if (!s || !playingRef.current) return;
      const dt = Math.min(Math.max(0, (ts - last.current) / 1000), 0.1);
      last.current = ts;
      acc.current += dt;
      while (acc.current >= DT && !s.over) {
        step(s);
        acc.current -= DT;
      }
      flush();
      setFrame((f) => (f + 1) | 0);
      if (playingRef.current) raf.current = requestAnimationFrame(loop);
    },
    [flush],
  );

  const start = useCallback(
    /** Empieza una partida. `seed` y `maxLives` vienen de POST /runs (o una semilla local si no hay API). */
    (fieldW: number, fieldH: number, maxLives = BASE_LIVES, seed = randomSeed()) => {
      cancelAnimationFrame(raf.current);
      gs.current = createGame({ seed, maxLives, fieldW, fieldH });
      inputs.current = [];
      acc.current = 0;
      last.current = performance.now();
      playingRef.current = true;
      setPlaying(true);
      setFrame((f) => (f + 1) | 0);
      raf.current = requestAnimationFrame(loop);
    },
    [loop],
  );

  /**
   * Toque en coordenadas lógicas del motor. Se redondea a 1 decimal y se limita al campo ANTES
   * de llamar a tap(): el servidor repite la partida con exactamente estos valores.
   */
  const tapAt = useCallback(
    (rx: number, ry: number) => {
      const s = gs.current;
      if (!s || !playingRef.current || s.over) return;
      const x = round1(Math.min(Math.max(rx, 0), s.config.fieldW));
      const y = round1(Math.min(Math.max(ry, 0), s.config.fieldH));
      inputs.current.push([s.tick, x, y]);
      tap(s, x, y);
      flush();
      setFrame((f) => (f + 1) | 0);
    },
    [flush],
  );

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Solo en desarrollo (web): window.__tb_debug.state da acceso al estado del motor para
  // probar etapas avanzadas (p. ej. __tb_debug.state.played = 300). No existe en producción.
  useEffect(() => {
    if (!__DEV__ || typeof window === 'undefined') return;
    const w = window as unknown as { __tb_debug?: { readonly state: GameState | null } };
    w.__tb_debug = {
      get state() {
        return gs.current;
      },
    };
    return () => {
      delete w.__tb_debug;
    };
  }, []);

  return { state: gs.current, playing, start, tapAt };
}
