// Determinismo entre dispositivos (plan de jugabilidad, fase 3): la misma semilla y el mismo
// campo generan exactamente los mismos bloques, en cualquier celular. Es lo que permite que un
// reto (a un amigo o diario) sea la misma partida para todos.
import { describe, expect, it } from 'vitest';
import {
  BASE_LIVES,
  type Block,
  type GameConfig,
  type GameMods,
  TICKS_PER_SECOND,
  type TapInput,
  createGame,
  drainEvents,
  step,
  tap,
} from '../src';

/** Bloques generados en una partida sin tocar nada (tiempo infinito), en orden. */
function blocksOf(config: GameConfig, seconds: number): Block[] {
  const s = createGame(config);
  s.timeLeft = 1e9;
  const out: Block[] = [];
  for (let i = 0; i < seconds * TICKS_PER_SECOND; i++) {
    step(s);
    for (const e of drainEvents(s)) if (e.type === 'spawn') out.push({ ...e.block });
  }
  return out;
}

/** Juega con los mismos toques y devuelve todos los eventos (copiados) y el resultado. */
function playWith(config: GameConfig, inputs: readonly TapInput[], ticks: number) {
  const s = createGame(config);
  const events: string[] = [];
  let i = 0;
  for (;;) {
    while (!s.over && i < inputs.length && inputs[i][0] === s.tick) {
      tap(s, inputs[i][1], inputs[i][2]);
      i++;
    }
    const done = s.over || s.tick >= ticks;
    if (!done) step(s);
    for (const e of drainEvents(s)) events.push(JSON.stringify(e));
    if (done) break;
  }
  return { events, killed: s.killed, missed: s.missed, tick: s.tick };
}

const cfg = (seed: number, fieldW: number, fieldH: number, mods?: GameMods | null): GameConfig => ({
  seed,
  maxLives: BASE_LIVES,
  fieldW,
  fieldH,
  mods,
});

describe('determinismo entre dispositivos', () => {
  it('misma semilla y mismo campo: exactamente los mismos bloques', () => {
    for (const seed of [1, 42, 2147483647, 4294967295]) {
      for (const [w, h] of [
        [360, 540],
        [412, 732],
      ]) {
        const a = blocksOf(cfg(seed, w, h), 400);
        const b = blocksOf(cfg(seed, w, h), 400);
        expect(a.length).toBeGreaterThan(100);
        expect(b).toEqual(a);
      }
    }
  });

  it('también con modificadores', () => {
    const mods: GameMods = { startAt: 140, only: 'mul', noRed: true, lives: 3 };
    expect(blocksOf(cfg(9, 360, 540, mods), 120)).toEqual(blocksOf(cfg(9, 360, 540, { ...mods }), 120));
  });

  it('con los mismos toques, la misma secuencia de eventos', () => {
    // un "dispositivo" juega (toca bloques y, de vez en cuando, fuera); el otro recibe sus toques
    const config = cfg(5, 360, 540);
    const s = createGame(config);
    const inputs: TapInput[] = [];
    const events: string[] = [];
    while (!s.over && s.tick < 90 * TICKS_PER_SECOND) {
      const target = s.blocks.find((b) => !b.trap);
      if (s.tick % 900 === 450) {
        inputs.push([s.tick, 0.5, 0.5]);
        tap(s, 0.5, 0.5);
      } else if (target && s.tick % 6 === 0) {
        const [x, y] = [target.x + target.w / 2, target.y + target.h / 2];
        inputs.push([s.tick, x, y]);
        tap(s, x, y);
      }
      if (!s.over) step(s);
      for (const e of drainEvents(s)) events.push(JSON.stringify(e));
    }
    const a = playWith(config, inputs, s.tick);
    const b = playWith(cfg(5, 360, 540), inputs, s.tick);
    expect(a.events.length).toBeGreaterThan(100);
    expect(a.events.some((e) => e.includes('"miss"'))).toBe(true);
    expect(a.events).toEqual(events);
    expect(b).toEqual(a);
  });

  it('con otro campo, en general no (por eso los retos usan un campo común)', () => {
    for (const seed of [1, 42, 777]) {
      const a = blocksOf(cfg(seed, 360, 540), 60);
      const b = blocksOf(cfg(seed, 412, 732), 60);
      const pos = (x: Block[]) => x.map((k) => [k.x, k.y, k.w]);
      expect(pos(b)).not.toEqual(pos(a));
    }
    // un campo apenas distinto también cambia las posiciones
    expect(blocksOf(cfg(1, 360, 540), 30).map((k) => k.x)).not.toEqual(blocksOf(cfg(1, 361, 540), 30).map((k) => k.x));
  });
});
