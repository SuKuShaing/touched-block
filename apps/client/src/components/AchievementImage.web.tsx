import type { AchievementId } from '@tb/engine';
import { achievementIconDataUri } from '@/cosmetics/achievementIcon';

/** Icono de logro en la web: el SVG como imagen (data URI), igual que `MedalImage.web.tsx`. */
export function AchievementImage({ id, level, size }: { id: AchievementId; level: number; size: number }) {
  return (
    <img
      src={achievementIconDataUri(id, level)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ display: 'block', width: size, height: size, pointerEvents: 'none', userSelect: 'none' }}
    />
  );
}
