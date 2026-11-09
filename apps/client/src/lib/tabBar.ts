import { useContext } from 'react';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { features } from '@/config';

/** Alto de la barra de pestañas (flota sobre la pantalla): el espacio que hay que dejar abajo. */
export function useTabBarSpace(): number {
  const h = useContext(BottomTabBarHeightContext);
  return features.accounts && h ? h : 0;
}
