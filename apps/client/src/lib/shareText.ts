import {
  MILESTONES,
  type Milestone,
  TICKS_PER_SECOND,
  TIERS,
  achievementById,
  achievementGoal,
  achievementLevel,
  achievementMaterial,
  achievementNext,
  milestoneIndexAt,
} from '@tb/engine';
import type { PrizeRef } from '@/components/PrizeModal';
import { config } from '@/config';
import { type CatalogStats, type CosmeticType, findItem, fmtCount, fmtSeconds, tierGoal } from '@/cosmetics/catalog';
import { MATERIAL_COLOR, tierColor } from '@/cosmetics/tiers';
import type { Celebration } from '@/game/celebrations';
import { achievementValues } from '@/lib/achievementValues';
import type { PrizeShareItem } from '@/platform/share.types';
import { C } from '@/theme';

/** Texto para invitar amigos con mi usuario (lo ponen en "¿Quién te invitó?"). */
export const inviteText = (username: string) =>
  `¡Juega Touched Block! Al registrarte, en '¿Quién te invitó?' pon mi usuario: @${username}`;

/** Texto que acompaña la tarjeta del resultado. */
export function resultText(killed: number, worldRank?: number | null) {
  const b = killed === 1 ? 'bloque' : 'bloques';
  const rank = worldRank ? ` y voy #${worldRank} en el mundo` : '';
  return `¡Destruí ${killed} ${b} en Touched Block${rank}! ¿Me superas?`;
}

/** Último hito del camino de etapas que alcanzó una partida de `ticks` de duración (o null). */
export function stageReached(ticks: number | null | undefined): Milestone | null {
  if (!ticks || !(ticks > 0)) return null;
  const i = milestoneIndexAt(ticks / TICKS_PER_SECOND);
  return i > 0 ? MILESTONES[i - 1] : null;
}

/**
 * Etapa alcanzada para la tarjeta de compartir: "Llegué a las multiplicaciones y divisiones",
 * "Llegué al 7", "Llegué a los bloques de 2 s". null si no cruzó ningún hito (menos de 20 s).
 */
export function stageText(ticks: number | null | undefined): string | null {
  const m = stageReached(ticks);
  return m ? `Llegué a ${m.name}`.replace(/\ba el\b/, 'al') : null;
}

export const SITE_URL = config.siteUrl;

// ---------------------------------------------------------------- premios

/** Cómo se nombra cada tipo de premio del catálogo: en la frase ("la paleta") y en la tarjeta. */
const ITEM_WORDS: Record<CosmeticType, { phrase: string; label: string }> = {
  palette: { phrase: 'la paleta', label: 'Paleta' },
  sound: { phrase: 'el sonido', label: 'Sonido' },
  effect: { phrase: 'el efecto', label: 'Efecto' },
  background: { phrase: 'el fondo', label: 'Fondo' },
};

/** "Llegar a las sumas y restas" (motor) → la meta ya cumplida: "Llegué…" o "Llegaste…". */
const reached = (goal: string, verb: 'Llegué' | 'Llegaste') => goal.replace(/^Llegar\b/, verb);

export interface PrizeCardTexts {
  /** Rótulo chico ("Insignia", "Logro", "Paleta"). */
  kicker: string;
  /** Nombre grande ("Plata", "Máximo combo · Oro", "Neón"). */
  title: string;
  sub: string;
  /** Color del rótulo (el del material; en los premios del catálogo, el de acento). */
  color: string;
}

/** Textos de la tarjeta (imagen) de un premio, o null si la referencia no existe. */
export function prizeCardTexts(p: PrizeShareItem): PrizeCardTexts | null {
  switch (p.kind) {
    case 'tier': {
      const t = TIERS[p.index];
      return t ? { kicker: 'Insignia', title: t.name, sub: reached(t.goal, 'Llegué'), color: tierColor(t) } : null;
    }
    case 'achievement': {
      const material = achievementMaterial(p.level);
      if (!material) return null;
      return {
        kicker: 'Logro',
        title: `${achievementById(p.id).name} · ${material}`,
        sub: achievementGoal(p.id, p.level),
        color: MATERIAL_COLOR[material],
      };
    }
    case 'item': {
      const item = findItem(p.type, p.id);
      return item ? { kicker: ITEM_WORDS[p.type].label, title: item.name, sub: 'Premio desbloqueado', color: C.accent } : null;
    }
  }
}

/** Texto que acompaña la tarjeta de un premio. */
export function prizeShareText(p: PrizeShareItem): string {
  const t = prizeCardTexts(p);
  if (!t) return '¡Juega Touched Block! ¿Me superas?';
  switch (p.kind) {
    case 'tier':
      return `¡Conseguí la insignia ${t.title} en Touched Block! ¿Me superas?`;
    case 'achievement':
      return `¡Logro ${t.title} en Touched Block!`;
    case 'item':
      return `¡Desbloqueé ${ITEM_WORDS[p.type].phrase} ${t.title} en Touched Block! ¿Me superas?`;
  }
}

/** Lo que se comparte de una celebración (el reto del día y las misiones no se comparten). */
export function shareItemOf(c: Celebration): PrizeShareItem | null {
  switch (c.kind) {
    case 'tier':
      return { kind: 'tier', index: c.tier.index };
    case 'achievement':
      return { kind: 'achievement', id: c.id, level: c.level };
    case 'item':
      return { kind: 'item', type: c.item.type, id: c.item.id };
    case 'feature':
      return null;
  }
}

/** Contenido de la ventana de una insignia o un logro en grande (`components/PrizeModal.tsx`). */
export interface PrizeDetail {
  kicker: 'Insignia' | 'Logro';
  title: string;
  /** Material del logro que se mira (null en las insignias y en el logro vacío). */
  material: string | null;
  /** "Todavía no lo tienes" en el estado vacío. */
  status: string | null;
  /** La meta: cumplida o, en el estado vacío, la primera por cumplir. */
  goal: string;
  /** Lo que lleva el jugador ("Tu partida más larga: 4 min 40 s"). */
  progress: string | null;
  /** Logros: avance del jugador hacia su siguiente material (0 a 1). */
  ratio: number | null;
  /** Logros: el siguiente material y su meta, o que ya tiene el más alto. */
  next: string | null;
  /** Color del premio (borde, barra y material); null en el estado vacío. */
  color: string | null;
  /** null = no se puede compartir (todavía no lo tiene). */
  share: PrizeShareItem | null;
}

const NOT_YET = 'Todavía no lo tienes';

export function prizeDetail(prize: PrizeRef, stats: CatalogStats): PrizeDetail {
  if (prize.kind === 'tier') {
    const t = TIERS[prize.index] ?? null;
    const best = stats.bestTicks / TICKS_PER_SECOND;
    return {
      kicker: 'Insignia',
      title: t ? t.name : 'Sin insignia',
      material: null,
      status: t ? null : NOT_YET,
      goal: t ? `${reached(t.goal, 'Llegaste')}.` : `${tierGoal(TIERS[0])} para ganar ${TIERS[0].name}.`,
      progress: best > 0 ? `Tu partida más larga: ${fmtSeconds(best)}` : null,
      ratio: null,
      next: null,
      color: t ? tierColor(t) : null,
      share: t ? { kind: 'tier', index: t.index } : null,
    };
  }
  const { id, level } = prize;
  const material = achievementMaterial(level);
  const value = achievementValues(stats)[id];
  const v = value ?? 0;
  // el avance es el del jugador, aunque se mire un material anterior
  const have = achievementLevel(id, value);
  const next = achievementNext(id, value);
  const prev = have > 0 ? achievementById(id).thresholds[have - 1] : 0;
  const ratio = next === null ? 1 : Math.max(0, Math.min(1, (v - prev) / Math.max(1, next - prev)));
  const progress = {
    racha: `Tu máximo combo: ${fmtCount(v)}`,
    partidas: `Partidas jugadas: ${fmtCount(v)}`,
    diasReto: `Tu mejor racha en el reto: ${fmtCount(v)} ${v === 1 ? 'día' : 'días'}`,
    mejorReto: value === null ? 'Aún no participas en un reto diario' : `Tu mejor resultado: mejor que el ${v} %`,
  }[id];
  let nextText: string | null = null;
  if (material) {
    nextText = next === null ? '¡Tienes el material más alto!' : `Siguiente: ${achievementMaterial(have + 1)} · ${achievementGoal(id, have + 1)}`;
  }
  return {
    kicker: 'Logro',
    title: achievementById(id).name,
    material,
    status: material ? null : NOT_YET,
    goal: `${achievementGoal(id, material ? level : 1)}.`,
    progress,
    ratio,
    next: nextText,
    color: material ? MATERIAL_COLOR[material] : null,
    share: material ? { kind: 'achievement', id, level } : null,
  };
}
