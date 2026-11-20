import { type ReactNode, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { TierRef } from '@tb/engine';
import { TierBadge } from './TierBadge';
import { C } from '@/theme';

/**
 * Íconos de la barra de pestañas (vectores, iguales en la web y en la app). Inactivo: solo el
 * borde. Activo: el ícono se llena desde el centro y rebota, como un bloque al tocarlo.
 *
 * Cada ícono se dibuja dos veces en una caja de 24×24: el borde (siempre) y el relleno (encima,
 * escalado de 0 a 1 desde el centro al activarse).
 */

export const TAB_ICON_PX = 26;
const STROKE = 2;

type Layer = (paint: { fill: string; stroke: string }) => ReactNode;

function AnimatedIcon({
  focused,
  color,
  size = TAB_ICON_PX,
  outline,
  filled,
  over,
  dot,
}: {
  focused: boolean;
  color: string;
  size?: number;
  outline: Layer;
  filled: Layer;
  /** Algo que va encima de todo (la insignia del perfil). */
  over?: ReactNode;
  /** Punto de novedad arriba a la derecha. */
  dot?: boolean;
}) {
  const fill = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (focused) {
      fill.value = 0;
      fill.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      pop.value = withSequence(withTiming(1.18, { duration: 110 }), withSpring(1, { damping: 13, stiffness: 260 }));
    } else {
      fill.value = withTiming(0, { duration: 120 });
    }
  }, [focused, fill, pop]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, fill.value * 2), transform: [{ scale: fill.value }] }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, popStyle]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {outline({ fill: 'none', stroke: color })}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, fillStyle]} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {filled({ fill: color, stroke: color })}
        </Svg>
      </Animated.View>
      {over}
      {dot ? <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" /> : null}
    </Animated.View>
  );
}

const line = { strokeWidth: STROKE, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

// ---------------------------------------------------------------- Jugar

const PLAY = 'M7.5 4.8 L19 12 L7.5 19.2 Z';

export function PlayIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <AnimatedIcon
      focused={focused}
      color={color}
      outline={(p) => <Path d={PLAY} fill={p.fill} stroke={p.stroke} {...line} />}
      filled={(p) => <Path d={PLAY} fill={p.fill} stroke={p.stroke} {...line} />}
    />
  );
}

// ---------------------------------------------------------------- Rankings

const PODIUM = 'M3 20 V12 H9 V5 H15 V14.5 H21 V20 Z';

export function PodiumIcon({ color, focused }: { color: string; focused: boolean }) {
  return (
    <AnimatedIcon
      focused={focused}
      color={color}
      outline={(p) => (
        <>
          <Path d={PODIUM} fill={p.fill} stroke={p.stroke} {...line} />
          <Path d="M9 12 V20 M15 14.5 V20" stroke={p.stroke} {...line} />
        </>
      )}
      filled={(p) => (
        <>
          <Path d={PODIUM} fill={p.fill} stroke={p.stroke} {...line} />
          <Path d="M9 13 V20 M15 15.5 V20" stroke={C.panel} strokeWidth={1.4} />
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- Colección

const CUP = 'M7 4 H17 V9 A5 5 0 0 1 7 9 Z';
const HANDLES = 'M7 6 H4.5 A2.5 2.5 0 0 0 7 11.2 M17 6 H19.5 A2.5 2.5 0 0 1 17 11.2';

export function TrophyIcon({ color, focused, dot }: { color: string; focused: boolean; dot?: boolean }) {
  return (
    <AnimatedIcon
      focused={focused}
      color={color}
      dot={dot}
      outline={(p) => (
        <>
          <Path d={CUP} fill={p.fill} stroke={p.stroke} {...line} />
          <Path d={HANDLES} fill="none" stroke={p.stroke} {...line} />
          <Path d="M12 14 V17.5" stroke={p.stroke} {...line} />
          <Rect x={8} y={17.5} width={8} height={3} rx={1} fill={p.fill} stroke={p.stroke} {...line} />
        </>
      )}
      filled={(p) => (
        <>
          <Path d={CUP} fill={p.fill} stroke={p.stroke} {...line} />
          <Rect x={8} y={17.5} width={8} height={3} rx={1} fill={p.fill} stroke={p.stroke} {...line} />
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- Perfil

const BODY = 'M4.5 21 A7.5 7.5 0 0 1 19.5 21 Z';
/** Lado de la insignia en el pecho, en px (sobre un ícono de TAB_ICON_PX). */
const CHEST_BADGE = 11;

export function PersonIcon({ color, focused, tier }: { color: string; focused: boolean; tier?: TierRef | null }) {
  const s = TAB_ICON_PX / 24;
  return (
    <AnimatedIcon
      focused={focused}
      color={color}
      outline={(p) => (
        <>
          <Circle cx={12} cy={7.2} r={3.6} fill={p.fill} stroke={p.stroke} {...line} />
          <Path d={BODY} fill={p.fill} stroke={p.stroke} {...line} />
        </>
      )}
      filled={(p) => (
        <>
          <Circle cx={12} cy={7.2} r={3.6} fill={p.fill} stroke={p.stroke} {...line} />
          <Path d={BODY} fill={p.fill} stroke={p.stroke} {...line} />
        </>
      )}
      over={
        tier ? (
          <View pointerEvents="none" style={[styles.chest, { left: 12 * s - CHEST_BADGE / 2, top: 17.2 * s - CHEST_BADGE / 2 }]}>
            <TierBadge tier={tier} size={CHEST_BADGE} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: C.bad,
    borderWidth: 1.5,
    borderColor: C.panel,
  },
  chest: { position: 'absolute', width: CHEST_BADGE, height: CHEST_BADGE },
});
