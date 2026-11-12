/// <reference types="node" />
// Prueba dorada: red de seguridad de la regla "una partida normal de hoy debe dar exactamente
// el mismo resultado después de cada cambio" (docs/plan-jugabilidad.md, paso 1.1).
//
// Juega 20 semillas fijas × 2 tamaños de campo con un bot determinista y compara el resultado
// (killed, missed, bestStreak, ticks, endReason) y una huella de TODOS los bloques generados
// contra test/golden.json. Además repite cada partida con replay() y exige lo mismo.
//
// Los valores de golden.json se generaron con el motor de las reglas v5 (RULES_VERSION = 5).
// NO se regeneran para "arreglar" un fallo: si esta prueba falla, el cambio alteró las partidas
// normales. Solo se regeneran con un cambio de reglas aprobado expresamente por el usuario
// (que además sube RULES_VERSION), así:
//
//   GOLDEN_WRITE=1 pnpm --filter @tb/engine test golden
//
// (en PowerShell: $env:GOLDEN_WRITE='1'; pnpm --filter @tb/engine test golden)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BASE_LIVES,
  type Block,
  type EndReason,
  type GameConfig,
  type GameState,
  TICKS_PER_SECOND,
  type TapInput,
  blockAt,
  createGame,
  drainEvents,
  replay,
  step,
  tap,
} from '../src';

const GOLDEN_FILE = join(__dirname, 'golden.json');
const WRITE = process.env.GOLDEN_WRITE === '1';

/** Semillas fijas (incluye 0 y valores ≥ 2^31, que el motor convierte con `| 0`). */
const SEEDS = [
  1, 2, 3, 7, 42, 99, 123, 256, 1000, 2024, 31337, 65535, 99991, 123456, 777777, 1000003, 2147483647, 3000000000,
  4294967295, 0,
];
const FIELDS: readonly [number, number][] = [
  [360, 540],
  [412, 732],
];
/** Tope de seguridad: la dificultad nunca se estanca, así que toda partida termina mucho antes. */
const MAX_TICKS = 40 * 60 * TICKS_PER_SECOND;

export interface GoldenEntry {
  killed: number;
  missed: number;
  bestStreak: number;
  ticks: number;
  endReason: EndReason | null;
  /** Bloques generados (incluye corazones). */
  spawns: number;
  /** FNV-1a de 32 bits sobre tick, id, label, x, y, w, h, color, life, red y heart de cada bloque. */
  blocksHash: string;
}

// ---- Utilidades deterministas del bot (sin Math.random) ----

/** PRNG mulberry32 propio del bot, independiente del motor. */
function botRandom(st: { r: number }): number {
  let t = (st.r = (st.r + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const FNV_OFFSET = 0x811c9dc5;
function fnv1a(h: number, str: string): number {
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Habilidad del bot, de 0 (torpe) a 1 (muy bueno). Varía con la semilla para que haya partidas
 * que mueren pronto y otras largas (varias pasan de 140 s y alguna de 275 s).
 */
interface Skill {
  /** Ticks entre toques (6 = 10 toques por segundo). */
  gap: number;
  /** Ticks que tarda en "ver" un bloque nuevo. */
  notice: number;
  /** Probabilidad de que un toque caiga fuera de todo bloque. */
  missP: number;
  /** Probabilidad de no reconocer una trampa (la trata como un bloque normal). */
  blindP: number;
  /** Probabilidad de ir por el corazón cuando le falta una vida. */
  heartP: number;
  /** Elige el bloque más urgente (true) o el más antiguo (false). */
  urgent: boolean;
}

function skillFor(k: number): Skill {
  const bad = 1 - k;
  return {
    gap: Math.round(16 - 10 * k),
    notice: Math.round(36 - 28 * k),
    missP: 0.002 + 0.03 * bad * bad,
    blindP: 0.004 + 0.35 * bad * bad,
    heartP: k,
    urgent: k >= 0.35,
  };
}

const center = (b: Block): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];

/** Juega una partida completa con el bot y devuelve el resultado, la huella y los toques. */
function playGolden(config: GameConfig, k: number): { entry: GoldenEntry; inputs: TapInput[]; state: GameState } {
  const s = createGame(config);
  const sk = skillFor(k);
  const rnd = { r: (config.seed ^ 0x5bd1e995) | 0 };
  const blind = new Map<number, boolean>();
  const inputs: TapInput[] = [];
  let targetId = -1;
  let cd = 0;
  let hash = FNV_OFFSET;
  let spawns = 0;

  const doTap = (x: number, y: number) => {
    inputs.push([s.tick, x, y]);
    tap(s, x, y);
    cd = sk.gap;
  };
  const isBlind = (b: Block) => {
    let v = blind.get(b.id);
    if (v === undefined) {
      v = botRandom(rnd) < sk.blindP;
      blind.set(b.id, v);
    }
    return v;
  };
  const canFinish = (b: Block) => (b.left * sk.gap) / TICKS_PER_SECOND <= b.life - 0.05;

  while (!s.over && s.tick < MAX_TICKS) {
    if (cd <= 0) {
      // ¿a qué bloque quiere tocar? (corazón si le falta una vida, si no el bloque elegido)
      let target: Block | undefined;
      const heart = s.blocks.find((b) => b.heart);
      if (heart && s.lives < s.config.maxLives && botRandom(rnd) < sk.heartP) {
        target = heart;
      } else {
        const seen = s.blocks.filter(
          (b) => !b.heart && (b.max - b.life) * TICKS_PER_SECOND >= sk.notice && (!b.trap || isBlind(b)),
        );
        target = seen.find((b) => b.id === targetId && canFinish(b));
        if (!target) {
          const feasible = seen.filter(canFinish);
          if (feasible.length > 0) {
            target = sk.urgent ? feasible.reduce((a, b) => (b.life < a.life ? b : a)) : feasible[0];
          }
        }
        if (target) targetId = target.id;
      }
      if (target) {
        if (botRandom(rnd) < sk.missP) {
          // toque torpe: cae fuera de los bloques (si encuentra un hueco)
          for (let t = 0; t < 20; t++) {
            const x = botRandom(rnd) * config.fieldW;
            const y = botRandom(rnd) * config.fieldH;
            if (!blockAt(s, x, y)) {
              doTap(x, y);
              break;
            }
          }
        } else {
          doTap(...center(target));
        }
      }
    }
    cd--;
    if (!s.over) step(s);
    for (const e of drainEvents(s)) {
      if (e.type !== 'spawn') continue;
      const b = e.block;
      spawns++;
      hash = fnv1a(hash, `${s.tick}|${b.id}|${b.label}|${b.x}|${b.y}|${b.w}|${b.h}|${b.color}|${b.life}|${b.red}|${b.heart};`);
    }
  }
  return {
    entry: {
      killed: s.killed,
      missed: s.missed,
      bestStreak: s.bestStreak,
      ticks: s.tick,
      endReason: s.endReason,
      spawns,
      blocksHash: hash.toString(16).padStart(8, '0'),
    },
    inputs,
    state: s,
  };
}

const CASES = FIELDS.flatMap(([fieldW, fieldH]) =>
  SEEDS.map((seed, i) => ({ key: `${seed}@${fieldW}x${fieldH}`, seed, fieldW, fieldH, k: i / (SEEDS.length - 1) })),
);

function loadGolden(): Record<string, GoldenEntry> {
  try {
    return JSON.parse(readFileSync(GOLDEN_FILE, 'utf8')) as Record<string, GoldenEntry>;
  } catch {
    return {};
  }
}

describe('prueba dorada: las partidas normales no cambian', () => {
  const golden = WRITE ? {} : loadGolden();
  const written: Record<string, GoldenEntry> = {};

  afterAll(() => {
    if (!WRITE) return;
    const sorted: Record<string, GoldenEntry> = {};
    for (const c of CASES) sorted[c.key] = written[c.key];
    writeFileSync(GOLDEN_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  });

  for (const c of CASES) {
    it(`semilla ${c.seed}, campo ${c.fieldW}×${c.fieldH}`, () => {
      const config: GameConfig = { seed: c.seed, maxLives: BASE_LIVES, fieldW: c.fieldW, fieldH: c.fieldH };
      const { entry, inputs, state } = playGolden(config, c.k);
      expect(state.over).toBe(true);

      // repetir la partida con sus toques da exactamente lo mismo
      const rep = replay(config, inputs);
      expect({
        killed: rep.killed,
        missed: rep.missed,
        bestStreak: rep.bestStreak,
        ticks: rep.ticks,
        endReason: rep.endReason,
        unusedInputs: rep.unusedInputs,
      }).toEqual({
        killed: entry.killed,
        missed: entry.missed,
        bestStreak: entry.bestStreak,
        ticks: entry.ticks,
        endReason: entry.endReason,
        unusedInputs: 0,
      });

      if (WRITE) {
        written[c.key] = entry;
        return;
      }
      expect(golden[c.key], `falta ${c.key} en golden.json`).toBeDefined();
      expect(entry).toEqual(golden[c.key]);
    });
  }

  it.skipIf(WRITE)('los datos guardados cubren partidas cortas y largas', () => {
    const secs = Object.values(golden).map((g) => g.ticks / TICKS_PER_SECOND);
    expect(secs).toHaveLength(CASES.length);
    expect(secs.some((t) => t < 60)).toBe(true);
    expect(secs.filter((t) => t > 140).length).toBeGreaterThanOrEqual(4);
    expect(secs.some((t) => t > 275)).toBe(true);
  });
});
