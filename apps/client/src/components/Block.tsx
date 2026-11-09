import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { C } from '@/theme';

export interface BlockProps {
  /** Posición y tamaño en px de pantalla. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Lo que se escribe en el bloque: los toques que faltan, la operación ("2+3"), '' o '✕'. */
  label: string;
  color: string;
  /** Trampa roja: mismo bloque, pero con el texto rojo. */
  red?: boolean;
  /** Vida restante 0..1 (barra blanca de abajo). */
  life?: number;
  /** Cambia en cada toque: dispara la animación de golpe. */
  hitKey?: number;
  /** Bloque que se apaga (escapado o trampa que expira): gris, se encoge y gira. */
  gone?: boolean;
  /** Animación de aparición al montarse (por defecto sí). */
  spawn?: boolean;
}

/**
 * Tamaño de letra: la mitad del alto para números (como en legacy); las operaciones
 * ("10+10", "16÷4") se achican hasta caber en el ancho, con margen para los bordes.
 */
export function labelFontSize(label: string, w: number, h: number): number {
  const base = Math.min(w, h) * 0.5;
  if (label.length <= 2) return base;
  // ~0.62 em por carácter en negrita (dígitos y + − × ÷); se deja ~14 % de margen
  return Math.min(base, (w * 0.86) / (label.length * 0.62));
}

// Curvas de legacy/style.css
const SPAWN_EASE = Easing.bezier(0.2, 1.6, 0.4, 1);
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Bloque del juego. Lo usan la partida y las animaciones del onboarding. */
export const Block = memo(function Block({ x, y, w, h, label, color, red, life, hitKey = 0, gone, spawn = true }: BlockProps) {
  const scale = useSharedValue(gone ? 1 : spawn ? 0 : 1);
  const rot = useSharedValue(gone || !spawn ? 0 : -20);
  const opacity = useSharedValue(1);
  const firstHit = useRef(hitKey);

  useEffect(() => {
    if (gone) {
      scale.value = withTiming(0.2, { duration: 300, easing: CSS_EASE });
      rot.value = withTiming(25, { duration: 300, easing: CSS_EASE });
      opacity.value = withTiming(0, { duration: 300, easing: CSS_EASE });
    } else if (spawn) {
      scale.value = withTiming(1, { duration: 250, easing: SPAWN_EASE });
      rot.value = withTiming(0, { duration: 250, easing: SPAWN_EASE });
    }
    // solo al montarse
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hitKey === firstHit.current) return;
    firstHit.current = hitKey;
    rot.value = 0;
    scale.value = withSequence(
      withTiming(0.8, { duration: 0 }),
      withTiming(1.08, { duration: 72, easing: CSS_EASE }),
      withTiming(1, { duration: 48, easing: CSS_EASE }),
    );
  }, [hitKey, rot, scale]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rot.value}deg` }],
  }));

  const fontSize = labelFontSize(label, w, h);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.blk,
        { left: x, top: y, width: w, height: h, backgroundColor: gone ? C.gone : color },
        anim,
      ]}
    >
      <Animated.Text
        style={[styles.num, { fontSize, lineHeight: fontSize * 1.15 }, red && !gone ? styles.trap : null]}
        selectable={false}
      >
        {label}
      </Animated.Text>
      {life != null && !gone ? <View style={[styles.life, { width: `${Math.max(0, Math.min(1, life)) * 100}%` }]} /> : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  blk: {
    position: 'absolute',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 5px 0 rgba(0,0,0,0.35)',
  },
  num: {
    color: C.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  trap: {
    color: C.trapNumber,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  life: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});
