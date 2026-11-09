/**
 * PRNG mulberry32: determinista y con solo operaciones enteras, así que da la misma
 * secuencia en cualquier motor de JavaScript (navegador, Hermes, Node).
 */
export function nextRandom(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Semilla aleatoria de 32 bits sin signo (no determinista; solo para crear partidas). */
export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
