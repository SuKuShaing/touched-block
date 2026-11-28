import { SvgXml } from 'react-native-svg';
import type { AchievementId } from '@tb/engine';
import { achievementIconSvg } from '@/cosmetics/achievementIcon';

/** Icono de logro en la app: el mismo texto SVG que usa la web, dibujado con react-native-svg. */
export function AchievementImage({ id, level, size }: { id: AchievementId; level: number; size: number }) {
  return <SvgXml xml={achievementIconSvg(id, level, size)} width={size} height={size} />;
}
