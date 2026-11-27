import type { ReactNode } from 'react';
import { Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import { COLORS } from '@tb/engine';
import { swatchPaint } from '@/cosmetics/palettes';

/** Android dibuja sombras interiores (`boxShadow inset`) desde la API 29 (Android 10). */
export const INSET_SHADOWS = !(Platform.OS === 'android' && Number(Platform.Version) < 29);

/**
 * Muestra de un color de una paleta, dibujada con su estilo (el brillo de Diamante incluido).
 * `index` es la posición del color en el orden de `COLORS` del motor (0–8). `children` queda
 * centrado dentro.
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
  const paint = swatchPaint(paletteId, COLORS[index % COLORS.length], size, INSET_SHADOWS);
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius ?? size * 0.25, alignItems: 'center', justifyContent: 'center' },
        paint,
        style,
      ]}
    >
      {children}
    </View>
  );
}
