import { memo } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import type { TierRef } from '@tb/engine';
import { SMALL_MEDAL_PX } from '@/cosmetics/medal';
import { tierStepOf } from '@/cosmetics/tiers';
import { MedalImage } from './MedalImage';

export type BadgeSize = 'sm' | 'md' | 'lg';

/** Lado de la caja de la medalla en cada tamaño (la medalla, con su sombra y adornos, la llena). */
export const BADGE_PX: Record<BadgeSize, number> = { sm: 22, md: 38, lg: 74 };

/**
 * Insignia (Papel, Cartón, Madera, Bronce, Plata, Oro o Diamante), dibujada en vectores
 * (`cosmetics/medal.ts`): igual en la web y en la app, y nítida en cualquier tamaño. Tamaños: `sm`
 * para filas de ranking, `md`, `lg`, o un número de píxeles (la tarjeta de compartir). Con `tier`
 * null o inválido no dibuja nada. Las medallas de los logros son otras (`AchievementIcon`).
 */
export const TierBadge = memo(function TierBadge({
  tier,
  size = 'md',
  style,
  label,
}: {
  tier: TierRef | null | undefined;
  size?: BadgeSize | number;
  style?: StyleProp<ViewStyle>;
  /** Otra etiqueta accesible (por defecto "Insignia Bronce"). */
  label?: string;
}) {
  const t = tierStepOf(tier);
  if (!t) return null;
  const px = typeof size === 'number' ? size : BADGE_PX[size];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label ?? `Insignia ${t.name}`} style={[{ width: px, height: px }, style]}>
      <MedalImage spec={{ tier: t.tier, step: t.step, small: px < SMALL_MEDAL_PX }} size={px} />
    </View>
  );
});
