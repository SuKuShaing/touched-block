import { useContext } from 'react';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { features } from '@/config';

/** Alto de la barra flotante de pestañas. */
export const TAB_BAR_H = 70;
/** Separación entre la barra y el borde de abajo (más el área segura) y los costados. */
export const TAB_BAR_GAP = 10;
/** Radio de las esquinas de la barra. */
export const TAB_BAR_RADIUS = 22;

/**
 * Espacio que hay que dejar abajo para que nada quede tapado por la barra de pestañas, que flota
 * sobre la pantalla: su alto, el margen inferior y el área segura.
 */
export function useTabBarSpace(): number {
  const h = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  return features.accounts && h ? h + TAB_BAR_GAP + insets.bottom : 0;
}
