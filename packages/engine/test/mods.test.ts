import { describe, expect, it } from 'vitest';
import {
  ADD_MAX,
  ADD_START,
  ADD_STEP,
  BASE_LIVES,
  BOMB_MIN_PLAYED,
  type Block,
  DAILY_CALENDAR,
  type GameConfig,
  type GameMods,
  type GameState,
  HEART_COMBO,
  LIFE_MAX,
  LIFE_MIN,
  LIFE_STAGE_START,
  MAX_LIVES_CAP,
  MISS_MULT_ADD_STAGE,
  MISS_MULT_MUL_STAGE,
  MODS_START_AT_MAX,
  MUL_START,
  MUL_STEP,
  NUM_MAX,
  TICKS_PER_SECOND,
  type TapInput,
  createGame,
  difficultyTime,
  drainEvents,
  maxConcFor,
  replay,
  step,
  tap,
  validateMods,
} from '../src';

const FIELD = { fieldW: 390, fieldH: 640 };
const cfg = (mods?: GameMods | null, seed = 42, maxLives = BASE_LIVES): GameConfig => ({ seed, maxLives, ...FIELD, mods });
const center = (b: Block) => [b.x + b.w / 2, b.y + b.h / 2] as const;

/** Juega `seconds` sin perder (tiempo infinito, sin tocar) y junta los bloques generados con su segundo real. */
function spawns(mods: GameMods | null, seconds: number, seed = 42): { at: number; b: Block }[] {
  const s = createGame(cfg(mods, seed));
  s.timeLeft = 1e9;
  const out: { at: number; b: Block }[] = [];
  for (let i = 0; i < seconds * TICKS_PER_SECOND; i++) {
    step(s);
    for (const e of drainEvents(s)) if (e.type === 'spawn') out.push({ at: s.played, b: e.block });
  }
  return out;
}
const isAdd = (b: Block) => b.kind === 'add' || b.kind === 'sub';
const isMul = (b: Block) => b.kind === 'mul' || b.kind === 'div';

/** Bot simple (10 toques por segundo, evita trampas) que juega hasta el final; devuelve sus toques. */
function playBot(s: GameState, maxTicks = 20 * 60 * TICKS_PER_SECOND): TapInput[] {
  const inputs: TapInput[] = [];
  let cooldown = 0;
  while (!s.over && s.tick < maxTicks) {
    if (cooldown <= 0) {
      const target = s.blocks.find((b) => !b.trap && b.life > 0.3);
      if (target) {
        const [x, y] = center(target);
        inputs.push([s.tick, x, y]);
        tap(s, x, y);
        cooldown = 6;
      }
    }
    cooldown--;
    if (!s.over) step(s);
  }
  return inputs;
}

describe('validación de modificadores', () => {
  it('acepta modificadores válidos y la ausencia de ellos', () => {
    const ok: (GameMods | null | undefined)[] = [
      undefined,
      null,
      {},
      { startAt: 0 },
      { startAt: MODS_START_AT_MAX },
      { lives: 1 },
      { lives: MAX_LIVES_CAP },
      { only: 'num' },
      { only: 'add' },
      { only: 'mul' },
      { noRed: true },
      { noRed: false },
      { startAt: ADD_START, only: 'mul', lives: 3, noRed: true },
    ];
    for (const mods of ok) expect(() => createGame(cfg(mods))).not.toThrow();
  });

  it('rechaza valores fuera de rango, tipos incorrectos y claves desconocidas', () => {
    const bad: unknown[] = [
      { startAt: -1 },
      { startAt: MODS_START_AT_MAX + 1 },
      { startAt: 1.5 },
      { startAt: '140' },
      { startAt: Number.NaN },
      { lives: 0 },
      { lives: MAX_LIVES_CAP + 1 },
      { lives: 2.5 },
      { only: 'sub' },
      { only: 'div' },
      { only: 1 },
      { noRed: 'si' },
      { noRed: 1 },
      { velocidad: 2 },
      [],
      'mods',
      7,
    ];
    for (const mods of bad) {
      expect(() => validateMods(mods), JSON.stringify(mods)).toThrow();
      expect(() => createGame(cfg(mods as GameMods))).toThrow();
      expect(() => replay(cfg(mods as GameMods), [])).toThrow();
    }
  });

  it('copia los modificadores: cambiarlos por fuera no altera la partida', () => {
    const mods: GameMods = { startAt: ADD_START };
    const s = createGame(cfg(mods));
    mods.startAt = 0;
    expect(s.config.mods).toEqual({ startAt: ADD_START });
  });
});

describe('sin modificadores la partida no cambia', () => {
  function trace(mods: GameMods | null | undefined, maxLives = BASE_LIVES) {
    const s = createGame(cfg(mods, 77, maxLives));
    const inputs = playBot(s);
    return { inputs, result: { killed: s.killed, missed: s.missed, best: s.bestStreak, tick: s.tick, end: s.endReason } };
  }

  it('mods ausente, null, {} o con valores neutros dan exactamente la misma partida', () => {
    const base = trace(undefined);
    expect(base.result.tick).toBeGreaterThan(60 * TICKS_PER_SECOND);
    for (const mods of [null, {}, { startAt: 0 }, { noRed: false }, { lives: BASE_LIVES }, { startAt: 0, noRed: false }]) {
      expect(trace(mods)).toEqual(base);
    }
  });

  it('difficultyTime es exactamente el tiempo jugado', () => {
    const s = createGame(cfg(null));
    for (let i = 0; i < 1000; i++) {
      step(s);
      expect(difficultyTime(s)).toBe(s.played);
    }
  });
});

describe('modificador lives', () => {
  it('reemplaza a maxLives', () => {
    const s = createGame(cfg({ lives: 3 }, 1, 8));
    expect(s.lives).toBe(3);
    expect(s.config.maxLives).toBe(3);
    tap(s, 1, 1);
    tap(s, 1, 1);
    expect(s.over).toBe(false);
    tap(s, 1, 1);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('vidas');
  });

  it('el corazón de recuperación respeta ese tope', () => {
    const heartAfterStreak = (lives: number) => {
      const s = createGame(cfg({ lives: 3 }, 7, 8));
      s.lives = lives;
      s.streak = HEART_COMBO - 1;
      s.blocks = [];
      s.spawnCd = 999;
      const b: Block = { id: 9999, kind: 'num', a: 1, b: 0, label: '1', value: 1, total: 1, left: 1, trap: false, red: false, heart: false, life: 99, max: 99, x: 100, y: 100, w: 80, h: 80, color: '#0091ff' };
      s.blocks.push(b);
      tap(s, ...center(b));
      return s;
    };
    // con 3 de 3 vidas no aparece (aunque maxLives de la config fuera 8)
    expect(heartAfterStreak(3).blocks.some((b) => b.heart)).toBe(false);
    // con 2 de 3 aparece, y tocarlo sube a 3, no más
    const s = heartAfterStreak(2);
    const h = s.blocks.find((b) => b.heart)!;
    expect(h).toBeTruthy();
    tap(s, ...center(h));
    expect(s.lives).toBe(3);
  });

  it('replay usa esas vidas', () => {
    const inputs: TapInput[] = [
      [0, 1, 1],
      [1, 1, 1],
      [2, 1, 1],
    ];
    expect(replay(cfg({ lives: 3 }), inputs).endReason).toBe('vidas');
    expect(replay(cfg(null), inputs, 10).over).toBe(false);
  });
});

describe('modificador startAt', () => {
  it('la dificultad parte como si ya se hubieran jugado N segundos; played sigue siendo real', () => {
    const s = createGame(cfg({ startAt: ADD_START }));
    for (let i = 0; i < 60; i++) step(s);
    expect(s.played).toBeCloseTo(1);
    expect(difficultyTime(s)).toBeCloseTo(ADD_START + 1);
  });

  it(`directo a las sumas: hay operaciones desde el comienzo, sin multiplicaciones`, () => {
    const all = spawns({ startAt: ADD_START }, 60);
    expect(all.some(({ b }) => isAdd(b))).toBe(true);
    expect(all.filter(({ at }) => at < 5).some(({ b }) => isAdd(b))).toBe(true);
    expect(all.some(({ b }) => isMul(b))).toBe(false);
    // los números ya llegan hasta 10
    expect(Math.max(...all.filter(({ b }) => b.kind === 'num').map(({ b }) => b.value))).toBe(NUM_MAX);
    // hasta ADD_STEP s reales, las sumas son "1+1" / "1−1"
    for (const { at, b } of all) if (at < ADD_STEP - 0.1 && isAdd(b)) expect([b.a, b.b]).toEqual([1, 1]);
  });

  it('directo a las multiplicaciones: aparecen de inmediato', () => {
    const all = spawns({ startAt: MUL_START }, 20);
    expect(all.filter(({ at }) => at < 10).some(({ b }) => isMul(b))).toBe(true);
  });

  it('en la etapa final, la vida de los bloques es fija desde el comienzo', () => {
    const all = spawns({ startAt: LIFE_STAGE_START }, 20);
    expect(all.length).toBeGreaterThan(5);
    for (const { b } of all) if (!b.heart) expect(b.max).toBe(4);
  });

  it('sin startAt, la vida es aleatoria entre LIFE_MIN y LIFE_MAX', () => {
    for (const { b } of spawns(null, 20)) {
      expect(b.max).toBeGreaterThanOrEqual(LIFE_MIN);
      expect(b.max).toBeLessThanOrEqual(LIFE_MAX);
    }
  });

  it('más bloques simultáneos y trampas desde el comienzo', () => {
    const s = createGame(cfg({ startAt: 180 }));
    s.timeLeft = 1e9;
    let maxBlocks = 0;
    let firstTrapAt = Infinity;
    for (let i = 0; i < 8 * TICKS_PER_SECOND; i++) {
      step(s);
      maxBlocks = Math.max(maxBlocks, s.blocks.length);
      for (const e of drainEvents(s)) if (e.type === 'spawn' && e.block.trap) firstTrapAt = Math.min(firstTrapAt, s.played);
    }
    expect(maxBlocks).toBeGreaterThan(maxConcFor(0));
    expect(firstTrapAt).toBeLessThan(BOMB_MIN_PLAYED);
  });

  it('el castigo por escapar usa la etapa del tiempo de dificultad', () => {
    for (const [startAt, mult] of [
      [ADD_START, MISS_MULT_ADD_STAGE],
      [MUL_START, MISS_MULT_MUL_STAGE],
    ] as const) {
      const s = createGame(cfg({ startAt }));
      s.spawnCd = 999;
      s.timeLeft = 500;
      s.blocks.push({ id: 9999, kind: 'num', a: 4, b: 0, label: '4', value: 4, total: 4, left: 4, trap: false, red: false, heart: false, life: 0.01, max: 4, x: 100, y: 100, w: 80, h: 80, color: '#0091ff' });
      step(s);
      expect(s.timeLeft).toBeCloseTo(500 - 1 / 60 - 4 * mult);
    }
  });
});

describe('modificador only', () => {
  it("'num': nunca hay operaciones, y los números llegan a 10", () => {
    const all = spawns({ only: 'num' }, 400);
    for (const { b } of all) expect(b.kind).toBe('num');
    expect(all.some(({ b }) => b.value === NUM_MAX)).toBe(true);
  });

  it("'add': solo sumas y restas; parten en \"1+1\" y después siguen la curva", () => {
    const all = spawns({ only: 'add' }, 300);
    for (const { b } of all) if (!b.heart) expect(isAdd(b)).toBe(true);
    for (const { at, b } of all) if (at < ADD_START + ADD_STEP - 0.1) expect([b.a, b.b]).toEqual([1, 1]);
    expect(Math.max(...all.map(({ b }) => Math.max(b.a, b.b)))).toBe(ADD_MAX);
  });

  it("'mul': solo multiplicaciones y divisiones; factores hasta 2 y después siguen la curva", () => {
    const all = spawns({ only: 'mul' }, 480);
    for (const { b } of all) expect(isMul(b)).toBe(true);
    const factors = (b: Block) => (b.kind === 'mul' ? [b.a, b.b] : [b.value, b.b]);
    for (const { at, b } of all) if (at < MUL_START + MUL_STEP - 0.1) expect(Math.max(...factors(b))).toBeLessThanOrEqual(2);
    expect(all.some(({ b }) => b.kind === 'mul' && b.value === 25)).toBe(true);
    expect(all.some(({ b }) => b.kind === 'div')).toBe(true);
  });

  it('se combina con startAt', () => {
    const all = spawns({ only: 'add', startAt: ADD_START + 3 * ADD_STEP }, 5);
    expect(all.length).toBeGreaterThan(0);
    for (const { b } of all) expect(isAdd(b)).toBe(true);
    expect(Math.max(...all.map(({ b }) => Math.max(b.a, b.b)))).toBeLessThanOrEqual(4);
  });
});

describe('modificador noRed', () => {
  it('sin trampas rojas; las restas ≤ 0 siguen siendo trampa', () => {
    const withRed = spawns(null, 300).filter(({ b }) => b.red);
    expect(withRed.length).toBeGreaterThan(0);
    const all = spawns({ noRed: true }, 300);
    expect(all.some(({ b }) => b.red)).toBe(false);
    const traps = all.filter(({ b }) => b.trap);
    expect(traps.length).toBeGreaterThan(0);
    for (const { b } of traps) expect(b.value).toBeLessThanOrEqual(0);
  });
});

describe('repetición (replay) con cada modificador', () => {
  const all: GameMods[] = [
    { startAt: ADD_START },
    { startAt: MUL_START },
    { startAt: LIFE_STAGE_START },
    { only: 'num' },
    { only: 'add' },
    { only: 'mul' },
    { lives: 3 },
    { lives: MAX_LIVES_CAP },
    { noRed: true },
    { startAt: ADD_START, only: 'mul', lives: 2, noRed: true },
    ...DAILY_CALENDAR.flatMap((d) => (d.mods ? [d.mods] : [])),
  ];
  const cases = all.filter((m, i) => all.findIndex((x) => JSON.stringify(x) === JSON.stringify(m)) === i);

  for (const mods of cases) {
    it(JSON.stringify(mods), () => {
      const config = cfg(mods, 2024);
      const s = createGame(config);
      const inputs = playBot(s);
      expect(s.over).toBe(true);
      expect(s.killed).toBeGreaterThan(0);
      const res = replay(config, inputs);
      expect(res).toEqual({
        killed: s.killed,
        missed: s.missed,
        bestStreak: s.bestStreak,
        ticks: s.tick,
        over: true,
        endReason: s.endReason,
        unusedInputs: 0,
      });
      // el modificador importa: repetir los mismos toques sin él da otra partida (las vidas no
      // cambian los bloques y este bot nunca toca fuera; eso se prueba aparte)
      if (mods.lives !== undefined && Object.keys(mods).length === 1) return;
      const plain = replay(cfg(null, 2024), inputs);
      expect([plain.killed, plain.ticks, plain.endReason]).not.toEqual([res.killed, res.ticks, res.endReason]);
    });
  }
});
