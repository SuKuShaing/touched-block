import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DateKey } from '@tb/engine';
import { weekStrip } from '@/lib/daily';
import { C } from '@/theme';

/**
 * Tira de la semana del reto diario (L M M J V S D): los días jugados llevan ✓, hoy va
 * marcado aunque todavía no se juegue, los días pasados sin jugar se ven apagados y los que
 * vienen, casi invisibles.
 */
export const WeekStrip = memo(function WeekStrip({ today, played }: { today: DateKey; played: readonly string[] }) {
  const days = useMemo(() => weekStrip(today, played), [today, played]);
  const count = days.filter((d) => d.played).length;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Esta semana jugaste el reto ${count === 1 ? '1 día' : `${count} días`}`}
    >
      {days.map((d) => (
        <View key={d.date} style={styles.day}>
          <Text style={[styles.label, d.today && styles.labelToday]} selectable={false}>
            {d.label}
          </Text>
          <View style={[styles.dot, d.played ? styles.dotPlayed : d.today ? styles.dotToday : d.future ? styles.dotFuture : styles.dotMissed]}>
            {d.played ? (
              <Text style={styles.check} selectable={false}>
                ✓
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  day: { alignItems: 'center', gap: 4 },
  label: { color: C.text, opacity: 0.55, fontSize: 11, fontWeight: '700' },
  labelToday: { color: C.accent, opacity: 1 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  dotPlayed: { backgroundColor: C.accent, borderColor: C.accent },
  dotToday: { borderColor: C.accent, backgroundColor: C.accentSoft },
  dotMissed: { borderColor: C.panelBorder, backgroundColor: C.barBg },
  dotFuture: { borderColor: C.panelBorder, borderStyle: 'dashed', opacity: 0.5 },
  check: { color: C.bg, fontSize: 14, fontWeight: '900', lineHeight: 16 },
});
