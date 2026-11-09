import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { HIST_SHOW, type HistEntry } from '@/lib/history';
import { fmtDate } from '@/lib/format';
import { C } from '@/theme';

/** Logo: "TOUCHED" arriba y "Block" dentro de un bloque azul con un mini bloque "3". */
export function Logo({ scale = 1 }: { scale?: number }) {
  return (
    <View style={styles.logo} accessibilityRole="header" accessibilityLabel="Touched Block">
      <Text style={[styles.lg1, { fontSize: 22 * scale, letterSpacing: 6.6 * scale }]} selectable={false}>
        TOUCHED
      </Text>
      <View style={styles.lg2}>
        <Text style={[styles.lg2t, { fontSize: 44 * scale, lineHeight: 52 * scale }]} selectable={false}>
          Block
        </Text>
        <View style={styles.lg3}>
          <Text style={styles.lg3t} selectable={false}>
            3
          </Text>
        </View>
      </View>
    </View>
  );
}

export function MainButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
      <Text style={styles.mainT} selectable={false}>
        {title}
      </Text>
    </Pressable>
  );
}

export function GhostButton({ title, onPress, small }: { title: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.ghost, small && styles.ghostSmall, pressed && styles.pressed]}
    >
      <Text style={[styles.ghostT, small && styles.ghostTSmall]} selectable={false}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Pastilla dorada "Récord: N bloques". */
export function RecordPill({ best }: { best: number }) {
  if (best <= 0) return null;
  return (
    <View style={styles.pill}>
      <Text style={styles.pillT} selectable={false}>
        Récord: {best} bloques
      </Text>
    </View>
  );
}

/** "Tus partidas": últimas HIST_SHOW; si `current`, la primera es la que acaba de terminar. */
export function HistoryList({ hist, best, current }: { hist: HistEntry[]; best: number; current: boolean }) {
  const { height } = useWindowDimensions();
  if (!hist.length) return null;
  return (
    <View style={styles.hist}>
      <Text style={styles.histTitle} selectable={false}>
        Tus partidas
      </Text>
      <ScrollView style={[styles.histList, { maxHeight: Math.max(150, height * 0.28) }]} nestedScrollEnabled>
        {hist.slice(0, HIST_SHOW).map((g, i) => {
          const now = current && i === 0;
          const isBest = best > 0 && g.k === best;
          const last = i === Math.min(hist.length, HIST_SHOW) - 1;
          return (
            <View key={g.d + ':' + i} style={[styles.row, now && styles.rowNow, last && styles.rowLast]}>
              <Text style={[styles.rowDate, now && styles.rowDateNow]} selectable={false}>
                {now ? 'Ahora' : fmtDate(g.d)}
              </Text>
              <Text style={[styles.rowK, isBest && styles.rowBest]} selectable={false}>
                {isBest ? <Text style={styles.star}>★ </Text> : null}
                {g.k}
              </Text>
              <Text style={styles.rowM} selectable={false}>
                {g.m} esc.
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center' },
  lg1: { color: C.text, fontWeight: '600', opacity: 0.7, marginBottom: 6, marginRight: -6.6 },
  lg2: {
    backgroundColor: '#0091ff',
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 22,
    borderRadius: 16,
    boxShadow: '0 6px 0 rgba(0,0,0,0.35)',
    transform: [{ rotate: '-3deg' }],
  },
  lg2t: { color: C.text, fontWeight: '800' },
  lg3: {
    position: 'absolute',
    top: -12,
    right: -14,
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#30a46c',
    boxShadow: '0 3px 0 rgba(0,0,0,0.35)',
    transform: [{ rotate: '10deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg3t: { color: C.text, fontWeight: '800', fontSize: 16, lineHeight: 30 },
  main: {
    marginTop: 12,
    backgroundColor: C.accent,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  mainT: { color: C.bg, fontSize: 22, fontWeight: '800' },
  pressed: { transform: [{ scale: 0.96 }] },
  ghost: {
    borderWidth: 1,
    borderColor: C.panelBorder,
    backgroundColor: C.panel,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  ghostSmall: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'transparent', borderColor: 'transparent' },
  ghostT: { color: C.text, fontSize: 16, fontWeight: '600', opacity: 0.9 },
  ghostTSmall: { fontSize: 15, opacity: 0.7 },
  pill: {
    backgroundColor: 'rgba(255,209,102,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,209,102,0.25)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  pillT: { color: C.gold, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  hist: { width: '100%', maxWidth: 320 },
  histTitle: { fontSize: 11, color: C.text, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 6, textAlign: 'center' },
  histList: { borderRadius: 12, backgroundColor: C.panel, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.rowBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  rowNow: { backgroundColor: C.accentSoft },
  rowDate: { flex: 1, color: C.text, opacity: 0.7, fontSize: 14, fontVariant: ['tabular-nums'] },
  rowDateNow: { opacity: 1, color: C.accent, fontWeight: '700' },
  rowK: { color: C.text, fontSize: 18, fontWeight: '700', minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rowBest: { color: C.gold },
  star: { fontSize: 12 },
  rowM: { color: C.text, fontSize: 12, opacity: 0.5, minWidth: 48, textAlign: 'right' },
});
