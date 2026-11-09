import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/**
 * Indicador de dedo para las animaciones del onboarding: un círculo blanco que se hunde y
 * suelta una onda en cada toque (`tapKey` cambia). (x, y) = punto tocado.
 */
export function TapFinger({ x, y, tapKey, visible = true }: { x: number; y: number; tapKey: number; visible?: boolean }) {
  const press = useSharedValue(0);
  const ring = useSharedValue(1);
  const first = useRef(tapKey);

  useEffect(() => {
    if (tapKey <= first.current) {
      first.current = tapKey;
      return;
    }
    first.current = tapKey;
    press.value = withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 160 }));
    ring.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }));
  }, [tapKey, press, ring]);

  const dot = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.22 * press.value }] }));
  const wave = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - ring.value), transform: [{ scale: 0.6 + 1.1 * ring.value }] }));

  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { left: x - 22, top: y - 22 }]}>
      <Animated.View style={[styles.ring, wave]} />
      <Animated.View style={[styles.dot, dot]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  ring: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#ffffff' },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  },
});
