import { describe, expect, it } from 'vitest';
import {
  BOMB_MAX_AT_ONCE,
  BOMB_MIN_PLAYED,
  BOMB_PENALTY,
  HEART_COMBO,
  HEART_LIFE,
  BASE_LIVES,
  type Block,
  type GameState,
  LIFE_MAX,
  LIFE_MIN,
  MISS_MULT_NUM_STAGE,
  MISS_MULT_ADD_STAGE,
  MISS_MULT_MUL_STAGE,
  START_TIME,
  TICKS_PER_SECOND,
  type TapInput,
  ADD_START,
  ADD_STEP,
  LIFE_STAGE_START,
  LIFE_STAGE_STEP,
  MUL_START,
  REDDISH,
  comboBonusFor,
  createGame,
  drainEvents,
  livesFor,
  replay,
  step,
  tap,
} from '../src';

const FIELD = { fieldW: 390, fieldH: 640 };
const newGame = (seed = 42, maxLives = BASE_LIVES) => createGame({ seed, maxLives, ...FIELD });
const center = (b: Block) => [b.x + b.w / 2, b.y + b.h / 2] as const;

/** Avanza hasta que haya al menos un bloque en pantalla. */
function stepUntilBlock(s: GameState, pred: (b: Block) => boolean = () => true): Block {
  for (let i = 0; i < 100000 && !s.over; i++) {
    const b = s.blocks.find(pred);
    if (b) return b;
    step(s);
  }
  throw new Error('no apareció un bloque');
}

/** Coloca un bloque controlado en el campo (para probar reglas puntuales). */
function putBlock(s: GameState, over: Partial<Block> = {}): Block {
  const b: Block = { id: 9999, kind: 'num', a: 3, b: 0, label: '3', value: 3, total: 3, left: 3, trap: false, red: false, heart: false, life: 4, max: 4, x: 100, y: 100, w: 80, h: 80, color: '#0091ff', ...over };
  s.blocks.push(b);
  return b;
}

/** Bot simple que destruye bloques normales y evita trampas; devuelve los toques registrados. */
function playBot(s: GameState, maxTicks = 60 * TICKS_PER_SECOND): TapInput[] {
  const inputs: TapInput[] = [];
  let cooldown = 0;
  while (!s.over && s.tick < maxTicks) {
    if (cooldown <= 0) {
      const target = s.blocks.find((b) => !b.trap && !b.heart && b.life > 0.3);
      if (target) {
        const [x, y] = center(target);
        inputs.push([s.tick, x, y]);
        tap(s, x, y);
        cooldown = 6; // ~10 toques por segundo
      }
    }
    cooldown--;
    if (!s.over) step(s);
  }
  return inputs;
}

describe('estado inicial', () => {
  it('parte con el tiempo y las vidas de base', () => {
    const s = newGame();
    expect(s.timeLeft).toBe(START_TIME);
    expect(s.lives).toBe(BASE_LIVES);
    expect(s.blocks).toHaveLength(0);
  });

  it('las vidas suben 1 por invitado hasta 8', () => {
    expect(livesFor(0)).toBe(5);
    expect(livesFor(1)).toBe(6);
    expect(livesFor(3)).toBe(8);
    expect(livesFor(20)).toBe(8);
  });
});

describe('reglas', () => {
  it('un bloque de N toques se destruye con N toques y suma N segundos', () => {
    const s = newGame();
    const b = putBlock(s, { total: 4, left: 4 });
    const t0 = s.timeLeft;
    const [x, y] = center(b);
    for (let i = 0; i < 3; i++) tap(s, x, y);
    expect(s.blocks).toContain(b);
    expect(b.left).toBe(1);
    tap(s, x, y);
    expect(s.blocks).not.toContain(b);
    expect(s.killed).toBe(1);
    expect(s.timeLeft).toBeCloseTo(t0 + 4);
  });

  it('un bloque escapado resta su número ORIGINAL × MISS_MULT aunque tenga toques', () => {
    const s = newGame();
    s.spawnCd = 999; // sin bloques nuevos
    s.timeLeft = 100;
    const b = putBlock(s, { total: 6, left: 6, life: 0.01 });
    const [x, y] = center(b);
    tap(s, x, y);
    tap(s, x, y); // le quedan 4, pero el castigo usa 6
    const t0 = s.timeLeft;
    step(s);
    expect(s.missed).toBe(1);
    expect(s.blocks).not.toContain(b);
    expect(s.timeLeft).toBeCloseTo(t0 - 1 / 60 - 6 * MISS_MULT_NUM_STAGE);
  });

  it('tocar una trampa quita BOMB_PENALTY segundos de inmediato', () => {
    const s = newGame();
    s.timeLeft = 100;
    const b = putBlock(s, { trap: true, total: 5, left: 5 });
    const [x, y] = center(b);
    tap(s, x, y);
    expect(s.timeLeft).toBe(100 - BOMB_PENALTY);
    expect(s.blocks).not.toContain(b);
    expect(s.lives).toBe(BASE_LIVES);
  });

  it('una trampa que tocas con poco tiempo termina la partida', () => {
    const s = newGame();
    const b = putBlock(s, { trap: true });
    tap(s, ...center(b));
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('tiempo');
  });

  it('una trampa que expira no castiga', () => {
    const s = newGame();
    s.spawnCd = 999;
    putBlock(s, { trap: true, life: 0.01 });
    const t0 = s.timeLeft;
    step(s);
    expect(s.missed).toBe(0);
    expect(s.timeLeft).toBeCloseTo(t0 - 1 / 60);
    expect(drainEvents(s).some((e) => e.type === 'trapGone')).toBe(true);
  });

  it('tocar fuera de un bloque quita una vida y con 0 vidas termina', () => {
    const s = newGame(1, 2);
    tap(s, 1, 1);
    expect(s.lives).toBe(1);
    expect(s.over).toBe(false);
    tap(s, 1, 1);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('vidas');
  });

  it('tocar donde había un bloque que ya expiró cuenta como fallo', () => {
    const s = newGame();
    s.spawnCd = 999;
    s.timeLeft = 100;
    const b = putBlock(s, { life: 0.01 });
    step(s);
    tap(s, ...center(b));
    expect(s.lives).toBe(BASE_LIVES - 1);
  });

  it('sin tocar nada, el tiempo se acaba y termina por tiempo', () => {
    const s = newGame();
    while (!s.over) step(s);
    expect(s.endReason).toBe('tiempo');
    expect(s.timeLeft).toBe(0);
    expect(s.blocks).toHaveLength(0);
  });

  it('después de terminar, los toques y pasos se ignoran', () => {
    const s = newGame(1, 1);
    tap(s, 1, 1);
    const snapshot = { tick: s.tick, lives: s.lives };
    tap(s, 1, 1);
    step(s);
    expect({ tick: s.tick, lives: s.lives }).toEqual(snapshot);
  });
});

describe('generación de bloques', () => {
  it('la vida de un bloque está entre LIFE_MIN y LIFE_MAX y no depende del número', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = newGame(seed);
      s.timeLeft = 1e6;
      for (let i = 0; i < 2000; i++) {
        step(s);
        for (const e of drainEvents(s)) {
          if (e.type === 'spawn') {
            expect(e.block.max).toBeGreaterThanOrEqual(LIFE_MIN);
            expect(e.block.max).toBeLessThanOrEqual(LIFE_MAX);
          }
        }
      }
    }
  });

  it(`no hay trampas antes de ${BOMB_MIN_PLAYED} s ni más de ${BOMB_MAX_AT_ONCE} a la vez`, () => {
    let sawTrap = false;
    for (let seed = 0; seed < 40; seed++) {
      const s = newGame(seed);
      s.timeLeft = 1e6; // que no termine
      for (let i = 0; i < 120 * TICKS_PER_SECOND; i++) {
        step(s);
        const traps = s.blocks.filter((b) => b.trap).length;
        expect(traps).toBeLessThanOrEqual(BOMB_MAX_AT_ONCE);
        for (const e of drainEvents(s)) {
          if (e.type === 'spawn' && e.block.trap) {
            sawTrap = true;
            expect(s.played).toBeGreaterThan(BOMB_MIN_PLAYED);
          }
        }
      }
    }
    expect(sawTrap).toBe(true);
  });

  it('los bloques no se solapan y caben en el campo', () => {
    const s = newGame(7);
    s.timeLeft = 1e6;
    for (let i = 0; i < 200 * TICKS_PER_SECOND; i++) {
      step(s);
      for (const a of s.blocks) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x + a.w).toBeLessThanOrEqual(FIELD.fieldW);
        expect(a.y + a.h).toBeLessThanOrEqual(FIELD.fieldH);
        for (const b of s.blocks) {
          if (a === b) continue;
          const apart = a.x >= b.x + b.w + 8 || b.x >= a.x + a.w + 8 || a.y >= b.y + b.h + 8 || b.y >= a.y + a.h + 8;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it('los números parten en 1–3 y llegan hasta 10', () => {
    const s = newGame(3);
    s.timeLeft = 1e6;
    let maxEarly = 0;
    let maxLate = 0;
    for (let i = 0; i < 200 * TICKS_PER_SECOND; i++) {
      step(s);
      for (const e of drainEvents(s)) {
        if (e.type !== 'spawn' || e.block.kind !== 'num') continue;
        if (s.played < 20) maxEarly = Math.max(maxEarly, e.block.total);
        else maxLate = Math.max(maxLate, e.block.total);
      }
    }
    expect(maxEarly).toBeLessThanOrEqual(3);
    expect(maxLate).toBe(10);
  });
});

/** Juega un rato largo sin perder y junta todos los bloques generados con el segundo en que aparecieron. */
function spawnsOverTime(seed: number, seconds: number): { at: number; b: Block }[] {
  const s = newGame(seed);
  s.timeLeft = 1e9;
  const out: { at: number; b: Block }[] = [];
  for (let i = 0; i < seconds * TICKS_PER_SECOND; i++) {
    step(s);
    for (const e of drainEvents(s)) if (e.type === 'spawn') out.push({ at: s.played, b: e.block });
  }
  return out;
}

describe('operaciones', () => {
  const all = [1, 2, 3].flatMap((seed) => spawnsOverTime(seed, 480));

  it('no hay operaciones antes de que los números lleguen a 10', () => {
    for (const { at, b } of all) if (at < ADD_START) expect(b.kind).toBe('num');
  });

  it(`las sumas/restas aparecen a los ${ADD_START} s y las multiplicaciones/divisiones a los ${MUL_START} s`, () => {
    const firstAdd = all.find((x) => x.b.kind === 'add' || x.b.kind === 'sub')!;
    const firstMul = all.find((x) => x.b.kind === 'mul' || x.b.kind === 'div')!;
    expect(firstAdd.at).toBeGreaterThanOrEqual(ADD_START);
    expect(firstAdd.at).toBeLessThan(ADD_START + 10);
    expect(firstMul.at).toBeGreaterThanOrEqual(MUL_START);
    expect(firstMul.at).toBeLessThan(MUL_START + 10);
  });

  it('en cada etapa siguen apareciendo los tipos anteriores', () => {
    const kinds = (from: number, to: number) => new Set(all.filter(({ at }) => at >= from && at < to).map(({ b }) => b.kind));
    const addStage = kinds(ADD_START, MUL_START);
    expect([...addStage].sort()).toEqual(['add', 'num', 'sub']);
    const mulStage = kinds(MUL_START, 480);
    expect([...mulStage].sort()).toEqual(['add', 'div', 'mul', 'num', 'sub']);
  });

  it('las operaciones parten pequeñas ("1+1") y llegan a "10+10" y "5×5"', () => {
    const early = all.filter((x) => x.at < ADD_START + ADD_STEP && (x.b.kind === 'add' || x.b.kind === 'sub'));
    expect(early.length).toBeGreaterThan(0);
    for (const { b } of early) expect([b.a, b.b]).toEqual([1, 1]);
    const ops = all.map((x) => x.b);
    expect(ops.some((b) => b.label === '10+10')).toBe(true);
    for (const b of ops) {
      if (b.kind === 'add' || b.kind === 'sub') expect(Math.max(b.a, b.b)).toBeLessThanOrEqual(10);
      if (b.kind === 'mul') expect(Math.max(b.a, b.b)).toBeLessThanOrEqual(5);
    }
    expect(ops.some((b) => b.kind === 'mul' && b.value === 25)).toBe(true);
  });

  it('cada bloque muestra su operación y su resultado es correcto', () => {
    for (const { b } of all) {
      if (b.kind === 'num') expect(b.label).toBe(String(b.value));
      if (b.kind === 'add') expect([b.label, b.value]).toEqual([`${b.a}+${b.b}`, b.a + b.b]);
      if (b.kind === 'sub') expect([b.label, b.value]).toEqual([`${b.a}−${b.b}`, b.a - b.b]);
      if (b.kind === 'mul') expect([b.label, b.value]).toEqual([`${b.a}×${b.b}`, b.a * b.b]);
      if (b.kind === 'div') {
        expect(b.label).toBe(`${b.a}÷${b.b}`);
        expect(b.a % b.b).toBe(0); // solo divisiones exactas
        expect(b.value).toBe(b.a / b.b);
        expect(b.b).toBeGreaterThanOrEqual(2);
      }
      expect(b.total).toBe(Math.max(0, b.value));
    }
  });

  it('las restas con resultado 0 o negativo son trampas; hay trampas rojas de todos los tipos', () => {
    const nonPos = all.filter((x) => x.b.value <= 0);
    expect(nonPos.length).toBeGreaterThan(0);
    for (const { b } of nonPos) {
      expect(b.kind).toBe('sub');
      expect(b.trap).toBe(true);
    }
    const redKinds = new Set(all.filter((x) => x.b.red).map((x) => x.b.kind));
    expect([...redKinds].sort()).toEqual(['add', 'div', 'mul', 'num', 'sub']);
    for (const { b } of all) if (b.red) expect(REDDISH).not.toContain(b.color);
  });

  it('los bloques con operación son rectangulares', () => {
    for (const { b } of all) {
      if (b.kind === 'num') expect(b.w).toBe(b.h);
      else expect(b.w).toBeGreaterThan(b.h);
    }
  });

  it('nunca hay más de 2 trampas a la vez (rojas + resultados ≤ 0)', () => {
    const s = newGame(11);
    s.timeLeft = 1e9;
    for (let i = 0; i < 400 * TICKS_PER_SECOND; i++) {
      step(s);
      expect(s.blocks.filter((b) => b.trap).length).toBeLessThanOrEqual(BOMB_MAX_AT_ONCE);
    }
  });

  it('una resta negativa que escapa no castiga; tocarla quita 30 s', () => {
    const s = newGame();
    s.spawnCd = 999;
    s.timeLeft = 100;
    putBlock(s, { kind: 'sub', a: 3, b: 4, label: '3−4', value: -1, total: 0, left: 0, trap: true, life: 0.01, w: 136 });
    step(s);
    expect(s.missed).toBe(0);
    expect(s.timeLeft).toBeCloseTo(100 - 1 / 60);
    const b = putBlock(s, { kind: 'sub', a: 3, b: 3, label: '3−3', value: 0, total: 0, left: 0, trap: true, w: 136 });
    tap(s, ...center(b));
    expect(s.timeLeft).toBeCloseTo(100 - 1 / 60 - BOMB_PENALTY);
  });

  it('una operación se destruye con tantos toques como su resultado y suma esos segundos', () => {
    const s = newGame();
    s.timeLeft = 50;
    const b = putBlock(s, { kind: 'add', a: 2, b: 3, label: '2+3', value: 5, total: 5, left: 5, w: 136 });
    for (let i = 0; i < 5; i++) tap(s, ...center(b));
    expect(s.killed).toBe(1);
    expect(s.timeLeft).toBeCloseTo(55);
  });

  it('castigo al escapar: ×5 en la etapa de números, ×6 desde las sumas y ×7 desde las multiplicaciones, para cualquier tipo', () => {
    const blocks: Partial<Block>[] = [
      { kind: 'num', value: 4, total: 4, left: 4 },
      { kind: 'add', a: 2, b: 3, value: 5, total: 5, left: 5 },
      { kind: 'sub', a: 7, b: 2, value: 5, total: 5, left: 5 },
      { kind: 'mul', a: 2, b: 3, value: 6, total: 6, left: 6 },
      { kind: 'div', a: 8, b: 2, value: 4, total: 4, left: 1 },
    ];
    const stages: [number, number][] = [
      [0, MISS_MULT_NUM_STAGE],
      [ADD_START - 1, MISS_MULT_NUM_STAGE],
      [ADD_START + 1, MISS_MULT_ADD_STAGE],
      [MUL_START - 1, MISS_MULT_ADD_STAGE],
      [MUL_START + 1, MISS_MULT_MUL_STAGE],
      [LIFE_STAGE_START + 200, MISS_MULT_MUL_STAGE],
    ];
    for (const [played, mult] of stages) {
      for (const over of blocks) {
        const s = newGame();
        s.played = played;
        s.spawnCd = 999;
        s.timeLeft = 500;
        putBlock(s, { ...over, life: 0.01 });
        step(s);
        expect(s.timeLeft).toBeCloseTo(500 - 1 / 60 - over.total! * mult);
      }
    }
  });

  it('la vida de los bloques baja a 4, 3, 2 y 1 s en la etapa final', () => {
    const lives = spawnsOverTime(4, LIFE_STAGE_START + 4 * LIFE_STAGE_STEP);
    for (const { at, b } of lives) {
      if (at < LIFE_STAGE_START) {
        expect(b.max).toBeGreaterThanOrEqual(LIFE_MIN);
        expect(b.max).toBeLessThanOrEqual(LIFE_MAX);
      } else {
        const expected = Math.max(1, 4 - Math.floor((at - LIFE_STAGE_START) / LIFE_STAGE_STEP));
        expect(b.max).toBe(expected);
      }
    }
    expect(lives.some(({ b }) => b.max === 1)).toBe(true);
  });
});

describe('combos', () => {
  /** Destruye `n` bloques de 1 toque seguidos y devuelve el tiempo ganado por combo. */
  function killOnes(s: GameState, n: number): number {
    let bonus = 0;
    for (let i = 0; i < n; i++) {
      const b = putBlock(s, { id: 1000 + i, value: 1, total: 1, left: 1, label: '1' });
      tap(s, ...center(b));
      for (const e of drainEvents(s)) if (e.type === 'combo') bonus += e.bonus;
    }
    return bonus;
  }

  it('3 seguidos +1 s, 5 +2 s, 10 +3 s, 15 +4 s, 20 +5 s y luego el ciclo se repite', () => {
    expect(comboBonusFor(3)).toBe(1);
    expect(comboBonusFor(5)).toBe(2);
    expect(comboBonusFor(10)).toBe(3);
    expect(comboBonusFor(15)).toBe(4);
    expect(comboBonusFor(20)).toBe(5);
    expect(comboBonusFor(23)).toBe(1);
    expect(comboBonusFor(40)).toBe(5);
    expect(comboBonusFor(4)).toBe(0);
    const s = newGame();
    s.timeLeft = 1000;
    expect(killOnes(s, 20)).toBe(1 + 2 + 3 + 4 + 5);
    expect(s.timeLeft).toBeCloseTo(1000 + 20 + 15);
    expect(killOnes(s, 3)).toBe(1);
    expect(s.bestStreak).toBe(23);
  });

  it('un error corta la racha, pero se conservan los premios ya ganados (18 seguidos → hasta el de 15)', () => {
    const s = newGame();
    s.timeLeft = 1000;
    expect(killOnes(s, 18)).toBe(1 + 2 + 3 + 4);
    tap(s, 1, 1); // toque fuera
    const ev = drainEvents(s);
    expect(ev).toContainEqual({ type: 'comboBreak', streak: 18, earned: 10 });
    expect(s.streak).toBe(0);
    expect(killOnes(s, 2)).toBe(0); // la racha parte de cero
  });

  it('cortan la racha: escape, trampa y toque fuera; una trampa que expira no la corta', () => {
    const errors: ((s: GameState) => void)[] = [
      (s) => {
        putBlock(s, { id: 1, life: 0.01 });
        step(s);
      },
      (s) => tap(s, ...center(putBlock(s, { id: 2, trap: true, red: true }))),
      (s) => tap(s, 1, 1),
    ];
    for (const err of errors) {
      const s = newGame();
      s.spawnCd = 999;
      s.timeLeft = 1000;
      killOnes(s, 4);
      err(s);
      expect(s.streak).toBe(0);
    }
    const s = newGame();
    s.spawnCd = 999;
    s.timeLeft = 1000;
    killOnes(s, 4);
    putBlock(s, { id: 3, trap: true, red: true, life: 0.01 });
    step(s);
    expect(s.streak).toBe(4);
  });
});

describe('fin de partida', () => {
  it('un bot rápido y perfecto también termina perdiendo (la dificultad nunca se estanca)', () => {
    const s = newGame(5);
    playBot(s, 30 * 60 * TICKS_PER_SECOND);
    expect(s.over).toBe(true);
    // con vida de 1 s ya no alcanza para bloques grandes: pierde unos minutos después
    expect(s.played).toBeGreaterThan(LIFE_STAGE_START);
    expect(s.played).toBeLessThan(15 * 60);
  });
});

describe('determinismo y replay', () => {
  it('misma semilla y mismos toques dan el mismo resultado', () => {
    const a = newGame(123);
    const b = newGame(123);
    const inputs = playBot(a);
    // el bot puede cortar antes de que termine: se repite hasta el mismo tick
    const res = replay({ seed: 123, maxLives: BASE_LIVES, ...FIELD }, inputs, a.over ? undefined : a.tick);
    for (const [t, x, y] of inputs) {
      while (b.tick < t) step(b);
      tap(b, x, y);
    }
    while (!b.over && b.tick < a.tick) step(b);
    expect(b.killed).toBe(a.killed);
    expect(res.killed).toBe(a.killed);
    expect(res.missed).toBe(a.missed);
    expect(res.endReason).toBe(a.endReason);
    expect(res.unusedInputs).toBe(0);
  });

  it('el bot destruye bloques (la partida no es trivial)', () => {
    const s = newGame(5);
    playBot(s);
    expect(s.killed).toBeGreaterThan(3);
  });

  it('semillas distintas generan partidas distintas', () => {
    const a = newGame(1);
    const b = newGame(2);
    for (let i = 0; i < 60; i++) {
      step(a);
      step(b);
    }
    expect(a.blocks.map((x) => [x.x, x.total])).not.toEqual(b.blocks.map((x) => [x.x, x.total]));
  });

  it('un puntaje inflado no coincide con el replay', () => {
    const s = newGame(99);
    const inputs = playBot(s);
    const res = replay({ seed: 99, maxLives: BASE_LIVES, ...FIELD }, inputs, s.over ? undefined : s.tick);
    expect(res.killed).toBe(s.killed);
    expect(res.killed).not.toBe(s.killed + 10);
  });

  it('cambiar las vidas cambia el resultado posible, no la secuencia de bloques', () => {
    const a = createGame({ seed: 8, maxLives: 5, ...FIELD });
    const b = createGame({ seed: 8, maxLives: 8, ...FIELD });
    for (let i = 0; i < 300; i++) {
      step(a);
      step(b);
    }
    expect(a.blocks).toEqual(b.blocks);
  });

  it('rechaza toques desordenados o mal formados', () => {
    const cfg = { seed: 1, maxLives: 5, ...FIELD };
    expect(() => replay(cfg, [[5, 1, 1], [3, 1, 1]])).toThrow();
    expect(() => replay(cfg, [[1.5, 1, 1]])).toThrow();
    expect(() => replay(cfg, [[1, Number.NaN, 1]])).toThrow();
  });

  it('cuenta los toques posteriores al fin de la partida', () => {
    const cfg = { seed: 1, maxLives: 1, ...FIELD };
    const res = replay(cfg, [[0, 1, 1], [0, 2, 2], [10, 1, 1]]);
    expect(res.endReason).toBe('vidas');
    expect(res.unusedInputs).toBe(2);
  });
});

describe('corazón de recuperación', () => {
  /** Deja la racha en HEART_COMBO − 1 con un bloque de 1 toque listo para completarla. */
  function almost(lives: number) {
    const s = newGame(7);
    s.lives = lives;
    s.streak = HEART_COMBO - 1;
    s.blocks = [];
    const b = putBlock(s, { total: 1, left: 1, value: 1, label: '1', life: 99, max: 99 });
    return { s, b };
  }
  const heartOf = (s: GameState) => s.blocks.find((x) => x.heart);

  it('aparece al llegar a la racha de 25 si falta una vida, y dura 1 s', () => {
    const { s, b } = almost(BASE_LIVES - 1);
    tap(s, ...center(b));
    const h = heartOf(s)!;
    expect(h).toBeTruthy();
    expect(h.life).toBe(HEART_LIFE);
    expect(h.trap).toBe(false);
  });

  it('no aparece si las vidas están completas', () => {
    const { s, b } = almost(BASE_LIVES);
    tap(s, ...center(b));
    expect(heartOf(s)).toBeUndefined();
  });

  it('tocarlo recupera una vida sin tocar tiempo ni racha', () => {
    const { s, b } = almost(BASE_LIVES - 2);
    tap(s, ...center(b));
    const h = heartOf(s)!;
    const time = s.timeLeft;
    const streak = s.streak;
    tap(s, ...center(h));
    expect(s.lives).toBe(BASE_LIVES - 1);
    expect(s.timeLeft).toBe(time);
    expect(s.streak).toBe(streak);
    expect(heartOf(s)).toBeUndefined();
    expect(drainEvents(s).some((e) => e.type === 'heal')).toBe(true);
  });

  it('si se escapa no resta tiempo, ni vida, ni corta la racha', () => {
    const { s, b } = almost(BASE_LIVES - 1);
    tap(s, ...center(b));
    s.blocks = s.blocks.filter((x) => x.heart);
    const time = s.timeLeft;
    const streak = s.streak;
    for (let i = 0; i < 70; i++) step(s); // > 1 s
    expect(heartOf(s)).toBeUndefined();
    expect(s.lives).toBe(BASE_LIVES - 1);
    expect(s.streak).toBe(streak);
    expect(s.timeLeft).toBeGreaterThan(time - 1.3);
    expect(s.missed).toBe(0);
  });
});
