import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { fmtTime } from '@/lib/format';
import { C, LOW_TIME } from '@/theme';

export type PopKind = 'gain' | 'hurt';

/**
 * Reloj m:ss. Se agranda en verde al ganar tiempo y en rojo al perder (animaciones gain/hurt
 * de legacy); queda rojo con 5 s o menos.
 */
export function Clock({
  seconds,
  popKey = 0,
  popKind = 'gain',
  size = 38,
}: {
  seconds: number;
  popKey?: number;
  popKind?: PopKind;
  size?: number;
}) {
  const low = seconds <= LOW_TIME;
  const pop = useSharedValue(0);
  const first = useRef(popKey);
  useEffect(() => {
    if (popKey <= first.current) {
      first.current = popKey;
      return;
    }
    first.current = popKey;
    pop.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 350 }));
  }, [popKey, pop]);

  const base = low ? C.bad : C.text;
  const target = popKind === 'gain' ? C.good : C.bad;
  const style = useAnimatedStyle(
    () => ({
      color: interpolateColor(pop.value, [0, 1], [base, target]),
      transform: [{ scale: 1 + 0.25 * pop.value }],
    }),
    [base, target],
  );

  return (
    <Animated.Text style={[styles.clock, { fontSize: size, lineHeight: size * 1.1 }, style]} selectable={false}>
      {fmtTime(seconds)}
    </Animated.Text>
  );
}

/** Desde qué racha se muestra el indicador. */
export const STREAK_SHOW = 2;

/**
 * Indicador discreto de racha ("Racha 7"), visible desde STREAK_SHOW. Ocupa siempre su alto
 * para no mover el diseño. Da un salto verde cuando `popKey` cambia (premio de combo).
 */
export function Streak({ n, popKey = 0, size = 12 }: { n: number; popKey?: number; size?: number }) {
  const pop = useSharedValue(0);
  const first = useRef(popKey);
  useEffect(() => {
    if (popKey <= first.current) {
      first.current = popKey;
      return;
    }
    first.current = popKey;
    pop.value = withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 420 }));
  }, [popKey, pop]);
  const style = useAnimatedStyle(() => ({
    color: interpolateColor(pop.value, [0, 1], [C.gold, C.good]),
    transform: [{ scale: 1 + 0.3 * pop.value }],
  }));
  return (
    <Animated.Text
      style={[styles.streak, { fontSize: size, lineHeight: size * 1.2 }, style]}
      selectable={false}
      accessibilityLabel={n >= STREAK_SHOW ? `Racha de ${n}` : undefined}
    >
      {n >= STREAK_SHOW ? `Racha ${n}` : ' '}
    </Animated.Text>
  );
}

/** Corazones: tantos como vidas máximas (5–8), los perdidos en gris. */
export function Hearts({ lives, max, size = 20 }: { lives: number; max: number; size?: number }) {
  return (
    <Text style={[styles.hearts, { fontSize: size, lineHeight: size * 1.2 }]} selectable={false} accessibilityLabel={`${lives} de ${max} vidas`}>
      {Array.from({ length: max }, (_, i) => (
        <Text key={i} style={i < lives ? null : styles.off}>
          ♥
        </Text>
      ))}
    </Text>
  );
}

/** Barra de tiempo, relativa al mayor tiempo alcanzado. */
export function TimeBar({ ratio, low, style }: { ratio: number; low: boolean; style?: object }) {
  return (
    <View style={[styles.bar, style]}>
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: low ? C.danger : C.accent }]} />
    </View>
  );
}

/**
 * Línea fina que se llena hacia el próximo hito de la partida, con su ícono al final ("5",
 * "+ −", "× ÷", "4 s"). Sin ícono cuando ya se cruzaron todos. `dim` la atenúa (hay un aviso encima).
 */
export function MilestoneLine({ ratio, icon, dim }: { ratio: number; icon: string | null; dim?: boolean }) {
  return (
    <View style={[styles.mline, dim && styles.mlineDim]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.mtrack}>
        <View style={[styles.mfill, { width: `${Math.min(100, Math.max(0, ratio * 100))}%` }]} />
      </View>
      {icon ? (
        <Text style={styles.micon} selectable={false} numberOfLines={1}>
          {icon}
        </Text>
      ) : null}
    </View>
  );
}

/** Marcador de arriba: Destruidos / Tiempo / Vidas. */
export function Header({
  killed,
  seconds,
  lives,
  maxLives,
  popKey,
  popKind,
  streak = 0,
  streakPop = 0,
}: {
  killed: number;
  streak?: number;
  streakPop?: number;
  seconds: number;
  lives: number;
  maxLives: number;
  popKey: number;
  popKind: PopKind;
}) {
  return (
    <View style={styles.header}>
      <View style={[styles.box, styles.dim]}>
        <Text style={styles.label} selectable={false}>
          Destruidos
        </Text>
        <Text style={styles.value} selectable={false}>
          {killed}
        </Text>
        <Streak n={streak} popKey={streakPop} />
      </View>
      <View style={[styles.box, styles.mid]}>
        <Text style={styles.label} selectable={false}>
          Tiempo
        </Text>
        <Clock seconds={seconds} popKey={popKey} popKind={popKind} />
      </View>
      <View style={[styles.box, styles.dim, styles.right]}>
        <Text style={styles.label} selectable={false}>
          Vidas
        </Text>
        <Hearts lives={lives} max={maxLives} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clock: { color: C.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hearts: { color: C.bad, letterSpacing: 1 },
  streak: { color: C.gold, fontWeight: '800', fontVariant: ['tabular-nums'], transformOrigin: 'left' },
  off: { color: C.heartOff },
  bar: { height: 6, backgroundColor: C.barBg, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%' },
  mline: { flexDirection: 'row', alignItems: 'center', gap: 8, height: '100%' },
  mlineDim: { opacity: 0.2 },
  mtrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.barBg, overflow: 'hidden' },
  mfill: { height: '100%', backgroundColor: 'rgba(119,204,255,0.6)' },
  micon: { color: C.text, opacity: 0.6, fontSize: 11, fontWeight: '800', minWidth: 22, textAlign: 'right' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  box: { minWidth: 80, flexDirection: 'column' },
  dim: { opacity: 0.75 },
  mid: { alignItems: 'center' },
  right: { alignItems: 'flex-end' },
  label: { fontSize: 11, color: C.text, textTransform: 'uppercase', letterSpacing: 0.9 },
  value: { fontSize: 24, color: C.text, fontWeight: '700', lineHeight: 26.4 },
});
