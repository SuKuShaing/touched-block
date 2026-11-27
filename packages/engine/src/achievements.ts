// Logros de siete niveles (plan de jugabilidad, fase 5.3). Cada logro tiene los mismos siete
// materiales y se calcula desde las estadísticas del jugador: nada se guarda como "ganado".
// Umbrales provisorios.

/** Materiales de los niveles 1 a 7 (el nivel 0 es "todavía nada"). */
export const ACHIEVEMENT_MATERIALS = ['Papel', 'Cartón', 'Madera', 'Bronce', 'Plata', 'Oro', 'Diamante'] as const;
export type AchievementMaterial = (typeof ACHIEVEMENT_MATERIALS)[number];

/**
 * - `racha`: máximo combo (la mejor racha en una partida).
 * - `partidas`: partidas jugadas en total.
 * - `diasReto`: mejor racha de días seguidos jugando el reto diario.
 * - `mejorReto`: mejor "mejor que el X %" en un reto diario (null si nunca participó;
 *   participar ya da Papel, con cualquier porcentaje, incluso 0).
 */
export type AchievementId = 'racha' | 'partidas' | 'diasReto' | 'mejorReto';

export interface Achievement {
  id: AchievementId;
  /** "Máximo combo", "Partidas jugadas"… */
  name: string;
  /** Umbral de cada material, de Papel a Diamante (el valor debe ser ≥ al umbral). */
  thresholds: readonly [number, number, number, number, number, number, number];
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'racha', name: 'Máximo combo', thresholds: [10, 25, 50, 100, 200, 300, 500] },
  { id: 'partidas', name: 'Partidas jugadas', thresholds: [10, 50, 150, 500, 1500, 3000, 6000] },
  { id: 'diasReto', name: 'Días seguidos de reto diario', thresholds: [3, 7, 14, 30, 100, 200, 365] },
  { id: 'mejorReto', name: 'Mejor resultado en un reto diario', thresholds: [0, 25, 50, 75, 90, 95, 99] },
];

export function achievementById(id: AchievementId): Achievement {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`logro desconocido: ${String(id)}`);
  return a;
}

const valid = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Nivel alcanzado: 0 (nada) … 7 (Diamante). */
export function achievementLevel(id: AchievementId, value: number | null | undefined): number {
  if (!valid(value)) return 0;
  let level = 0;
  for (const t of achievementById(id).thresholds) if (value >= t) level++;
  return level;
}

/** Siguiente umbral por alcanzar, o null si ya tiene Diamante. */
export function achievementNext(id: AchievementId, value: number | null | undefined): number | null {
  const level = achievementLevel(id, value);
  const th = achievementById(id).thresholds;
  return level < th.length ? th[level] : null;
}

/** Material de un nivel (1–7), o null para el nivel 0. */
export function achievementMaterial(level: number): AchievementMaterial | null {
  return level >= 1 && level <= ACHIEVEMENT_MATERIALS.length ? ACHIEVEMENT_MATERIALS[level - 1] : null;
}

/** 2000 → "2.000" (separador de miles en español, sin depender de Intl). */
function fmt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Requisito del nivel (1–7) en palabras: "Racha de 25", "Mejor que el 75 % en un reto diario"… */
export function achievementGoal(id: AchievementId, level: number): string {
  const th = achievementById(id).thresholds;
  if (!Number.isInteger(level) || level < 1 || level > th.length) throw new Error(`nivel inválido: ${level}`);
  const t = th[level - 1];
  switch (id) {
    case 'racha':
      return `Racha de ${fmt(t)}`;
    case 'partidas':
      return `Juega ${fmt(t)} partidas`;
    case 'diasReto':
      return `Juega el reto ${fmt(t)} días seguidos`;
    case 'mejorReto':
      return level === 1 ? 'Participa en un reto diario' : `Mejor que el ${t} % en un reto diario`;
  }
}
