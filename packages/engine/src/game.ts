import {
  ADD_START,
  BOMB_CHANCE,
  BOMB_MAX_AT_ONCE,
  BOMB_MIN_PLAYED,
  BOMB_PENALTY,
  type BlockKind,
  COLORS,
  DIV_CHANCE,
  DT,
  HEART_COMBO,
  HEART_LIFE,
  LIFE_MAX,
  LIFE_MIN,
  MAX_LIVES_CAP,
  MIX_WITH_ADD,
  MIX_WITH_MUL,
  MUL_START,
  OP_SYMBOL,
  OP_WIDTH_RATIO,
  REDDISH,
  SAFE,
  START_TIME,
  SUB_CHANCE,
  blockSizeFor,
  comboBonusFor,
  maxAddFor,
  maxConcFor,
  maxMulFor,
  maxNumFor,
  missMultAt,
  spawnCooldown,
  stageLifeFor,
} from './constants';
import { nextRandom } from './rng';

export interface Block {
  id: number;
  kind: BlockKind;
  /** Primer y segundo operando (en 'num', a = el número y b = 0). */
  a: number;
  b: number;
  /** Texto del bloque: "7", "2+3", "4−2", "2×3", "8÷2". */
  label: string;
  /** Resultado de la operación (puede ser 0 o negativo: entonces es trampa). */
  value: number;
  /** Toques necesarios para destruirlo (= value si es positivo). */
  total: number;
  /** Toques que faltan. */
  left: number;
  /** Trampa: cualquier toque castiga. Son trampa las rojas y las de resultado ≤ 0. */
  trap: boolean;
  /** Trampa roja: se ve igual que un bloque normal, pero con el texto rojo. */
  red: boolean;
  /** Corazón de recuperación: un toque recupera una vida; no es trampa ni suma tiempo. */
  heart: boolean;
  /** Segundos de vida restantes. */
  life: number;
  /** Vida inicial (para dibujar la barra). */
  max: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export type EndReason = 'tiempo' | 'vidas';

export type GameEvent =
  | { type: 'spawn'; block: Block }
  | { type: 'hit'; block: Block }
  | { type: 'kill'; block: Block; gain: number }
  | { type: 'trap'; block: Block; penalty: number }
  | { type: 'expire'; block: Block; penalty: number }
  | { type: 'trapGone'; block: Block }
  | { type: 'miss'; x: number; y: number }
  /** Se tocó el corazón: +1 vida. */
  | { type: 'heal'; block: Block }
  /** El corazón se escapó sin tocarlo (sin consecuencias). */
  | { type: 'heartGone'; block: Block }
  /** Se alcanzó un premio de combo: `streak` destruidos seguidos, +`bonus` s. */
  | { type: 'combo'; streak: number; bonus: number }
  /** Se cortó la racha; `earned` = segundos de combo ganados en ella. */
  | { type: 'comboBreak'; streak: number; earned: number }
  | { type: 'end'; reason: EndReason };

/**
 * Modificadores de una partida (retos con modificador, plan 5.1). Todos opcionales; sin ellos
 * (o con `mods` nulo) el motor se comporta exactamente como en una partida normal.
 */
export interface GameMods {
  /** La dificultad parte como si ya se hubieran jugado estos segundos (entero 0–600). */
  startAt?: number;
  /** Solo una familia de bloques: números, sumas y restas, o multiplicaciones y divisiones. */
  only?: 'num' | 'add' | 'mul';
  /** Vidas de la partida (entero 1–MAX_LIVES_CAP); reemplaza a `maxLives`. */
  lives?: number;
  /** Sin trampas rojas (las restas con resultado ≤ 0 siguen siendo trampa). */
  noRed?: boolean;
}

export interface GameConfig {
  seed: number;
  maxLives: number;
  fieldW: number;
  fieldH: number;
  /** Modificadores; ausente o null en las partidas normales. */
  mods?: GameMods | null;
}

export interface GameState {
  readonly config: GameConfig;
  rng: number;
  /** Pasos de simulación ejecutados. */
  tick: number;
  lives: number;
  timeLeft: number;
  /** Segundos jugados. */
  played: number;
  /** Mayor tiempo alcanzado (para la barra de tiempo). */
  barMax: number;
  killed: number;
  missed: number;
  /** Bloques destruidos seguidos sin errores. */
  streak: number;
  /** Mejor racha de la partida. */
  bestStreak: number;
  /** Segundos de combo ganados en la racha actual. */
  comboEarned: number;
  blocks: Block[];
  spawnCd: number;
  nextId: number;
  over: boolean;
  endReason: EndReason | null;
  /** Eventos pendientes de consumir por quien dibuja (sonidos, partículas…). */
  events: GameEvent[];
}

/** Tope de `mods.startAt` (s). */
export const MODS_START_AT_MAX = 600;
const MOD_KEYS: readonly string[] = ['startAt', 'only', 'lives', 'noRed'];
const MOD_FAMILIES: readonly string[] = ['num', 'add', 'mul'];

/**
 * Comprueba que los modificadores sean válidos (null/undefined también lo son: partida normal).
 * Lanza un Error si no. Rechaza claves desconocidas, para que el servidor nunca repita una
 * partida ignorando un modificador que el cliente sí usó.
 */
export function validateMods(mods: unknown): asserts mods is GameMods | null | undefined {
  if (mods === null || mods === undefined) return;
  if (typeof mods !== 'object' || Array.isArray(mods)) throw new Error('mods debe ser un objeto');
  const m = mods as Record<string, unknown>;
  for (const k of Object.keys(m)) if (!MOD_KEYS.includes(k)) throw new Error(`modificador desconocido: ${k}`);
  const int = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  if (m.startAt !== undefined && !int(m.startAt, 0, MODS_START_AT_MAX)) {
    throw new Error(`mods.startAt debe ser un entero entre 0 y ${MODS_START_AT_MAX}`);
  }
  if (m.lives !== undefined && !int(m.lives, 1, MAX_LIVES_CAP)) {
    throw new Error(`mods.lives debe ser un entero entre 1 y ${MAX_LIVES_CAP}`);
  }
  if (m.only !== undefined && !(typeof m.only === 'string' && MOD_FAMILIES.includes(m.only))) {
    throw new Error(`mods.only debe ser uno de: ${MOD_FAMILIES.join(', ')}`);
  }
  if (m.noRed !== undefined && typeof m.noRed !== 'boolean') throw new Error('mods.noRed debe ser true o false');
}

export function createGame(config: GameConfig): GameState {
  if (!(config.fieldW > 0 && config.fieldH > 0)) throw new Error('fieldW y fieldH deben ser positivos');
  if (!(config.maxLives >= 1)) throw new Error('maxLives debe ser ≥ 1');
  validateMods(config.mods);
  // con mods.lives, las vidas de la partida (y el tope del corazón de recuperación) son esas
  const cfg: GameConfig = config.mods
    ? { ...config, mods: { ...config.mods }, maxLives: config.mods.lives ?? config.maxLives }
    : { ...config };
  return {
    config: cfg,
    rng: config.seed | 0,
    tick: 0,
    lives: cfg.maxLives,
    timeLeft: START_TIME,
    played: 0,
    barMax: START_TIME,
    killed: 0,
    missed: 0,
    streak: 0,
    bestStreak: 0,
    comboEarned: 0,
    blocks: [],
    spawnCd: 0,
    nextId: 1,
    over: false,
    endReason: null,
    events: [],
  };
}

/**
 * Tiempo que usan las curvas de dificultad: los segundos jugados más `mods.startAt`. Sin
 * modificadores es exactamente `s.played` (x + 0 === x), así que las partidas normales no
 * cambian. `s.played` sigue siendo el tiempo real jugado.
 */
export function difficultyTime(s: GameState): number {
  return s.played + (s.config.mods?.startAt ?? 0);
}

function end(s: GameState, reason: EndReason) {
  if (s.over) return;
  s.over = true;
  s.endReason = reason;
  if (reason === 'tiempo') s.timeLeft = 0;
  s.blocks = [];
  s.events.push({ type: 'end', reason });
}

function removeBlock(s: GameState, b: Block) {
  const i = s.blocks.indexOf(b);
  if (i > -1) s.blocks.splice(i, 1);
}

/** Cualquier error (escape, trampa, toque fuera) corta la racha. Los premios ya ganados se mantienen. */
function breakCombo(s: GameState) {
  if (s.streak > 0) s.events.push({ type: 'comboBreak', streak: s.streak, earned: s.comboEarned });
  s.streak = 0;
  s.comboEarned = 0;
}

function findSpot(s: GameState, w: number, h: number): { x: number; y: number } | null {
  const W = s.config.fieldW;
  const H = s.config.fieldH;
  const pad = 6;
  const gap = 8;
  for (let t = 0; t < 40; t++) {
    const x = pad + nextRandom(s) * (W - w - pad * 2);
    const y = pad + nextRandom(s) * (H - h - pad * 2);
    let ok = true;
    for (const b of s.blocks) {
      if (x < b.x + b.w + gap && b.x < x + w + gap && y < b.y + b.h + gap && b.y < y + h + gap) {
        ok = false;
        break;
      }
    }
    if (ok) return { x, y };
  }
  return null;
}

const randInt = (s: GameState, min: number, max: number) => min + Math.floor(nextRandom(s) * (max - min + 1));

interface Shape {
  kind: BlockKind;
  a: number;
  b: number;
  value: number;
  label: string;
}

/** Elige el tipo y los números del bloque según la etapa del juego. */
function makeShape(s: GameState, allowNonPositive: boolean): Shape {
  const t = difficultyTime(s);
  const only = s.config.mods?.only;
  let addMax = maxAddFor(t);
  let mulMax = maxMulFor(t);
  let family: 'num' | 'add' | 'mul' = 'num';
  if (only) {
    // familia forzada (mods.only); si la curva todavía no la habilita, parte en su valor
    // inicial ("1+1", "2×2") y después sigue la curva
    family = only;
    if (addMax === 0) addMax = maxAddFor(ADD_START);
    if (mulMax === 0) mulMax = maxMulFor(MUL_START);
  } else if (mulMax > 0) {
    const r = nextRandom(s);
    family = r < MIX_WITH_MUL.num ? 'num' : r < MIX_WITH_MUL.num + MIX_WITH_MUL.add ? 'add' : 'mul';
  } else if (addMax > 0) {
    family = nextRandom(s) < MIX_WITH_ADD.num ? 'num' : 'add';
  }

  if (family === 'add') {
    let a = randInt(s, 1, addMax);
    let b = randInt(s, 1, addMax);
    if (nextRandom(s) < SUB_CHANCE) {
      if (a - b <= 0 && !allowNonPositive) {
        // no puede haber otra trampa ahora: se da vuelta (o se vuelve suma si son iguales)
        if (a === b) return { kind: 'add', a, b, value: a + b, label: `${a}${OP_SYMBOL.add}${b}` };
        [a, b] = [b, a];
      }
      return { kind: 'sub', a, b, value: a - b, label: `${a}${OP_SYMBOL.sub}${b}` };
    }
    return { kind: 'add', a, b, value: a + b, label: `${a}${OP_SYMBOL.add}${b}` };
  }

  if (family === 'mul') {
    if (nextRandom(s) < DIV_CHANCE) {
      // solo divisiones exactas: dividendo = cociente × divisor
      const d = randInt(s, 2, mulMax);
      const q = randInt(s, 1, mulMax);
      return { kind: 'div', a: q * d, b: d, value: q, label: `${q * d}${OP_SYMBOL.div}${d}` };
    }
    const a = randInt(s, 1, mulMax);
    const b = randInt(s, 1, mulMax);
    return { kind: 'mul', a, b, value: a * b, label: `${a}${OP_SYMBOL.mul}${b}` };
  }

  const n = randInt(s, 1, maxNumFor(t));
  return { kind: 'num', a: n, b: 0, value: n, label: String(n) };
}

function spawn(s: GameState): boolean {
  const t = difficultyTime(s);
  let trapCount = 0;
  for (const b of s.blocks) if (b.trap) trapCount++;
  const canTrap = t > BOMB_MIN_PLAYED && trapCount < BOMB_MAX_AT_ONCE;
  // de vez en cuando aparece una trampa roja (máx. 2 trampas a la vez, no al comienzo).
  // Con mods.noRed no hay rojas; sin él se consumen los mismos números aleatorios que siempre.
  const red = !s.config.mods?.noRed && canTrap && nextRandom(s) < BOMB_CHANCE;
  const shape = makeShape(s, canTrap && !red);
  const h = blockSizeFor(s.config.fieldW, s.config.fieldH);
  const w = shape.kind === 'num' ? h : Math.min(h * OP_WIDTH_RATIO, s.config.fieldW - 12);
  const spot = findSpot(s, w, h);
  if (!spot) return false;
  // vida del bloque: aleatoria (o fija en la etapa final), nunca depende de su número
  const stage = stageLifeFor(t);
  const life = stage ?? LIFE_MIN + nextRandom(s) * (LIFE_MAX - LIFE_MIN);
  let color: string =
    shape.kind === 'num' ? COLORS[(shape.value - 1) % COLORS.length] : COLORS[Math.floor(nextRandom(s) * COLORS.length)];
  // la trampa roja usa los mismos colores; si el suyo es rojizo (el texto rojo no se vería), usa otro
  if (red && REDDISH.includes(color)) color = SAFE[Math.floor(nextRandom(s) * SAFE.length)];
  const trap = red || shape.value <= 0;
  const total = Math.max(shape.value, 0);
  const block: Block = {
    id: s.nextId++,
    ...shape,
    total,
    left: total,
    trap,
    red,
    heart: false,
    life,
    max: life,
    x: spot.x,
    y: spot.y,
    w,
    h,
    color,
  };
  s.blocks.push(block);
  s.events.push({ type: 'spawn', block });
  return true;
}

/** Corazón de recuperación: aparece aparte de los bloques normales (no cuenta para el máximo). */
function spawnHeart(s: GameState) {
  const h = blockSizeFor(s.config.fieldW, s.config.fieldH);
  const spot = findSpot(s, h, h);
  if (!spot) return; // sin espacio: no aparece
  const block: Block = {
    id: s.nextId++,
    kind: 'num',
    a: 1,
    b: 0,
    label: '♥',
    value: 1,
    total: 1,
    left: 1,
    trap: false,
    red: false,
    heart: true,
    life: HEART_LIFE,
    max: HEART_LIFE,
    x: spot.x,
    y: spot.y,
    w: h,
    h,
    color: '#ff4d8d',
  };
  s.blocks.push(block);
  s.events.push({ type: 'spawn', block });
}

function hitBlock(s: GameState, b: Block) {
  if (b.heart) {
    // recupera una vida; no suma tiempo ni cuenta para la racha (tampoco la corta)
    removeBlock(s, b);
    if (s.lives < s.config.maxLives) s.lives++;
    s.events.push({ type: 'heal', block: b });
    return;
  }
  if (b.trap) {
    // tocar una trampa: −BOMB_PENALTY segundos de inmediato
    s.timeLeft -= BOMB_PENALTY;
    removeBlock(s, b);
    s.events.push({ type: 'trap', block: b, penalty: BOMB_PENALTY });
    breakCombo(s);
    if (s.timeLeft <= 0) end(s, 'tiempo');
    return;
  }
  b.left--;
  s.events.push({ type: 'hit', block: b });
  if (b.left <= 0) {
    s.killed++;
    s.timeLeft += b.total; // suma tantos segundos como su resultado
    removeBlock(s, b);
    s.events.push({ type: 'kill', block: b, gain: b.total });
    s.streak++;
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    const bonus = comboBonusFor(s.streak);
    if (bonus > 0) {
      s.timeLeft += bonus;
      s.comboEarned += bonus;
      s.events.push({ type: 'combo', streak: s.streak, bonus });
    }
    if (s.streak % HEART_COMBO === 0 && s.lives < s.config.maxLives) spawnHeart(s);
  }
}

function expire(s: GameState, b: Block) {
  removeBlock(s, b);
  if (b.heart) {
    // el corazón que se escapa no cuesta nada
    s.events.push({ type: 'heartGone', block: b });
    return;
  }
  if (b.trap) {
    // la trampa se esfuma sin consecuencias
    s.events.push({ type: 'trapGone', block: b });
    return;
  }
  // bloque no completado: resta su resultado ORIGINAL × multiplicador de la etapa (aunque tenga toques)
  s.missed++;
  const penalty = b.total * missMultAt(difficultyTime(s));
  s.timeLeft -= penalty;
  s.events.push({ type: 'expire', block: b, penalty });
  breakCombo(s);
}

/** Bloque bajo el punto (x, y) en coordenadas del campo, o null. El más reciente queda encima. */
export function blockAt(s: GameState, x: number, y: number): Block | null {
  for (let i = s.blocks.length - 1; i >= 0; i--) {
    const b = s.blocks[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/**
 * Un toque en (x, y). Si cae en un bloque lo golpea; si no (incluido donde había un bloque
 * que ya desapareció), quita una vida.
 */
export function tap(s: GameState, x: number, y: number): void {
  if (s.over) return;
  const b = blockAt(s, x, y);
  if (b) {
    hitBlock(s, b);
    return;
  }
  s.lives--;
  s.events.push({ type: 'miss', x, y });
  breakCombo(s);
  if (s.lives <= 0) end(s, 'vidas');
}

/** Avanza la simulación un paso fijo de DT segundos. */
export function step(s: GameState): void {
  if (s.over) return;
  s.tick++;
  s.timeLeft -= DT;
  s.played += DT;

  const t = difficultyTime(s);
  const maxConc = maxConcFor(t);
  s.spawnCd -= DT;
  let normal = 0;
  for (const b of s.blocks) if (!b.heart) normal++;
  if (s.spawnCd <= 0 && normal < maxConc) {
    if (spawn(s)) s.spawnCd = spawnCooldown(t, nextRandom(s));
    else s.spawnCd = 0.2;
  }
  for (let i = s.blocks.length - 1; i >= 0; i--) {
    const b = s.blocks[i];
    b.life -= DT;
    if (b.life <= 0) expire(s, b);
  }

  if (s.timeLeft > s.barMax) s.barMax = s.timeLeft;
  if (s.timeLeft <= 0) end(s, 'tiempo');
}

/** Saca y devuelve los eventos pendientes. */
export function drainEvents(s: GameState): GameEvent[] {
  const ev = s.events;
  s.events = [];
  return ev;
}
