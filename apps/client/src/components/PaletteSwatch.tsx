import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { getPalette } from '@/cosmetics/palettes';

/**
 * Muestra de un color de una paleta, dibujada con su estilo. `index` es la posición del color en
 * el orden de `COLORS` del motor (0–8). Provisorio: por ahora solo el color liso.
 */
export function PaletteSwatch({
  paletteId,
  index,
  size,
  radius,
  children,
  style,
}: {
  paletteId: string;
  index: number;
  /** Lado en px. */
  size: number;
  radius?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = getPalette(paletteId);
  return (
    <View style={[{ width: size, height: size, borderRadius: radius ?? size * 0.25, backgroundColor: colors[index % colors.length] }, style]}>
      {children}
    </View>
  );
}
