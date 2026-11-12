import { memo } from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { MissionView } from '@/api/daily';
import { doneCount, progressLabel } from '@/lib/missions';
import { C } from '@/theme';

/**
 * Misiones del día.
 * - `home` (por defecto): las tres, compactas, con su avance. Va bajo la tarjeta del reto.
 * - `end`: solo las que se le pasan (las recién cumplidas en la partida), con su premio. Sin
 *   misiones no dibuja nada.
 */
export const MissionList = memo(function MissionList({
  missions,
  variant = 'home',
  style,
}: {
  missions: readonly MissionView[];
  variant?: 'home' | 'end';
  style?: StyleProp<ViewStyle>;
}) {
  if (missions.length === 0) return null;

  if (variant === 'end') {
    return (
      <View style={[styles.box, styles.endBox, style]} accessibilityLiveRegion="polite">
        <Text style={[styles.cap, styles.good]}>{missions.length === 1 ? '¡Misión cumplida!' : '¡Misiones cumplidas!'}</Text>
        {missions.map((m) => (
          <View key={m.id} style={styles.row} accessible accessibilityLabel={`Misión cumplida: ${m.title}. Ganaste ${m.reward} bloques para tu nivel`}>
            <View style={[styles.mark, styles.markDone]}>
              <Text style={styles.markT}>✓</Text>
            </View>
            <Text style={[styles.title, styles.flex1]}>{m.title}</Text>
            <Text style={styles.reward}>+{m.reward}</Text>
          </View>
        ))}
        <Text style={styles.foot}>Bloques extra para tu nivel.</Text>
      </View>
    );
  }

  const done = doneCount(missions);
  return (
    <View style={[styles.box, style]} accessibilityLabel={`Misiones de hoy: ${done} de ${missions.length} cumplidas`}>
      <View style={styles.head}>
        <Text style={styles.cap}>Misiones de hoy</Text>
        <Text style={[styles.cap, done === missions.length && styles.good]}>
          {done}/{missions.length}
        </Text>
      </View>
      {missions.map((m) => (
        <View
          key={m.id}
          style={styles.row}
          accessible
          accessibilityLabel={`${m.title}: ${m.done ? 'cumplida' : `${m.value} de ${m.target}`}. Premio: ${m.reward} bloques`}
        >
          <View style={[styles.mark, m.done && styles.markDone]}>{m.done ? <Text style={styles.markT}>✓</Text> : null}</View>
          <Text style={[styles.title, styles.flex1, m.done && styles.titleDone]} numberOfLines={1}>
            {m.title}
          </Text>
          <Text style={[styles.progress, m.done && styles.good]}>{progressLabel(m)}</Text>
          <Text style={styles.reward}>+{m.reward}</Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelBorder,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  endBox: { borderColor: C.good },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cap: { color: C.text, opacity: 0.6, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  good: { color: C.good, opacity: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex1: { flex: 1 },
  mark: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.panelBorder, alignItems: 'center', justifyContent: 'center' },
  markDone: { backgroundColor: C.good, borderColor: C.good },
  markT: { color: C.bg, fontSize: 11, fontWeight: '900', lineHeight: 13 },
  title: { color: C.text, fontSize: 14, fontWeight: '600' },
  titleDone: { opacity: 0.6 },
  progress: { color: C.text, opacity: 0.7, fontSize: 13, fontVariant: ['tabular-nums'] },
  reward: { color: C.gold, fontSize: 12, fontWeight: '800', minWidth: 30, textAlign: 'right', fontVariant: ['tabular-nums'] },
  foot: { color: C.text, opacity: 0.55, fontSize: 12 },
});
