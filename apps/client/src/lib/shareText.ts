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

export const SITE_URL = config.siteUrl;
