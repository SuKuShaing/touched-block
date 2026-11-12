import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BASE_LIVES,
  DT,
  RULES_VERSION,
  type GameEvent,
  type GameMods,
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
  /**
   * Después de cada cuadro o toque (haya o no eventos), mientras la partida sigue: para lo que
   * depende del estado y no de un evento (hitos, récord, amigos superados).
   */
  onFrame?(s: GameState): void;
  onEnd(result: GameResult): void;
}

/** Cómo se crea la partida. Con API, todo sale de la respuesta de POST /runs. */
export interface StartConfig {
  /** Campo lógico (en los retos, el del servidor; puede no ser el tamaño de la pantalla). */
  fieldW: number;
  fieldH: number;
  maxLives?: number;
  /** Sin semilla (sin API): una local, que no entra al ranking. */
  seed?: number;
  /** Modificadores (reto diario con modificador); null o ausente en las demás. */
  mods?: GameMods | null;
}

/** Bloque que apareció (solo en desarrollo: `__tb_debug.spawns`, para comparar partidas de reto). */
interface SpawnLog {
  id: number;
  tick: number;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  red: boolean;
}
const SPAWN_LOG_MAX = 200;

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
  const spawns = useRef<SpawnLog[]>([]);
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
    if (__DEV__) {
      for (const ev of evs) {
        if (ev.type !== 'spawn' || spawns.current.length >= SPAWN_LOG_MAX) continue;
        const b = ev.block;
        spawns.current.push({ id: b.id, tick: s.tick, label: b.label, x: b.x, y: b.y, w: b.w, h: b.h, red: b.red });
      }
    }
    if (evs.length) h.current.onEvents(evs, s);
    if (!s.over && playingRef.current) h.current.onFrame?.(s);
    if (s.over && playingRef.current) {
      playingRef.current = false;
      cancelAnimationFrame(raf.current);
      setPlaying(false);
      h.current.onEnd({
        seed: s.config.seed,
        maxLives: s.config.maxLives,
        fieldW: s.config.fieldW,
        fieldH: s.config.fieldH,
        mods: s.config.mods ?? null,
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
    /** Empieza una partida con la configuración de POST /runs (o una semilla local si no hay API). */
    (cfg: StartConfig) => {
      cancelAnimationFrame(raf.current);
      gs.current = createGame({
        seed: cfg.seed ?? randomSeed(),
        maxLives: cfg.maxLives ?? BASE_LIVES,
        fieldW: cfg.fieldW,
        fieldH: cfg.fieldH,
        ...(cfg.mods ? { mods: cfg.mods } : {}),
      });
      inputs.current = [];
      spawns.current = [];
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
  // probar etapas avanzadas (p. ej. __tb_debug.state.played = 300), `inputs` los toques
  // registrados y `spawns` los bloques que aparecieron (posiciones lógicas: sirven para comparar
  // dos partidas de un mismo reto en pantallas distintas). No existe en producción.
  useEffect(() => {
    if (!__DEV__ || typeof window === 'undefined') return;
    const w = window as unknown as { __tb_debug?: Record<string, unknown> };
    const dbg = w.__tb_debug ?? {};
    Object.defineProperties(dbg, {
      state: { get: () => gs.current, configurable: true, enumerable: true },
      inputs: { get: () => inputs.current, configurable: true, enumerable: true },
      spawns: { get: () => spawns.current, configurable: true, enumerable: true },
    });
    w.__tb_debug = dbg;
    return () => {
      delete w.__tb_debug;
    };
  }, []);

  return { state: gs.current, playing, start, tapAt };
}
