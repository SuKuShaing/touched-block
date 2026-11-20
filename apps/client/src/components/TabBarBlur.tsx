import { BlurTargetView, BlurView } from 'expo-blur';
import { type ComponentRef, type ReactNode, type RefObject, useEffect, useRef, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/**
 * Fondo translúcido con desenfoque de la barra de pestañas (expo-blur).
 *
 * En la web y en iOS el BlurView desenfoca lo que tiene detrás sin más. En Android necesita saber
 * qué desenfocar: cada pantalla de las pestañas va dentro de un BlurTargetView (`BlurScreen`) y la
 * que está a la vista se registra aquí como objetivo del BlurView de la barra.
 */

type Node = ComponentRef<typeof View>;
type Target = RefObject<Node | null>;
let current: Target | null = null;
const listeners = new Set<() => void>();
const setTarget = (t: Target | null) => {
  if (current === t) return;
  current = t;
  listeners.forEach((l) => l());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const get = () => current;

/** Envuelve una pantalla de las pestañas para que la barra pueda desenfocarla (Android). */
export function BlurScreen({ active, children }: { active: boolean; children: ReactNode }) {
  const ref = useRef<Node | null>(null);
  useEffect(() => {
    if (active) setTarget(ref);
  }, [active]);
  useEffect(() => () => void (current === ref && setTarget(null)), []);
  return (
    <BlurTargetView ref={ref} style={styles.fill}>
      {children}
    </BlurTargetView>
  );
}

/**
 * Capa del velo encima del desenfoque. En la web, el color del panel translúcido. En Android el
 * desenfoque nativo ya suma un tinte gris que dejaba la barra bastante más clara que el fondo, así
 * que el velo usa el color del fondo para que se vea igual que en la web.
 */
const VEIL = Platform.OS === 'android' ? 'rgba(18,18,26,0.6)' : 'rgba(28,28,40,0.55)';

/**
 * Fondo de la barra: desenfoque + velo. Con `off` (barra escondida durante la partida) no se
 * dibuja el desenfoque, para no gastar nada mientras se juega.
 */
export function TabBarBackground({ off, radius }: { off: boolean; radius: number }) {
  const target = useSyncExternalStore(subscribe, get, get);
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
      {off ? null : (
        <BlurView
          intensity={40}
          tint="dark"
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={target ?? undefined}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: VEIL }]} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
