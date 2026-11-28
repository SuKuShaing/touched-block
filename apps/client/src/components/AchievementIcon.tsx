import { memo } from 'react';
import { View } from 'react-native';
import { type AchievementId, achievementById, achievementMaterial } from '@tb/engine';
import { AchievementImage } from './AchievementImage';
import { BADGE_PX, type BadgeSize } from './TierBadge';

/**
 * Icono de un logro: medalla hexagonal con su símbolo (`cosmetics/achievementIcon.ts`), igual en la
 * web y en la app. `level` es el material alcanzado (1 = Papel … 7 = Diamante; 0 = vacío). Tamaños:
 * los de `TierBadge` (`md` en la Colección, `lg` en la celebración) o un número de píxeles.
 */
export const AchievementIcon = memo(function AchievementIcon({
  id,
  level,
  size = 'md',
  label,
}: {
  id: AchievementId;
  level: number;
  size?: BadgeSize | number;
  /** Otra etiqueta accesible (por defecto "<logro>, <material>"). */
  label?: string;
}) {
  const px = typeof size === 'number' ? size : BADGE_PX[size];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? `${achievementById(id).name}, ${achievementMaterial(level) ?? 'sin material'}`}
      style={{ width: px, height: px }}
    >
      <AchievementImage id={id} level={level} size={px} />
    </View>
  );
});
