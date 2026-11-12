import { MILESTONES, type Milestone, TICKS_PER_SECOND, milestoneIndexAt } from '@tb/engine';
import { config } from '@/config';

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
