import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DAILY_FROM_RUNS, unlockHintText } from '@/lib/daily';
import { C } from '@/theme';

const UNLOCKED_TEXT = '¡Desbloqueaste el reto del día y las misiones!';

/**
 * Para un jugador nuevo, en el inicio y en la pantalla final: cuántas partidas le faltan para
 * desbloquear el reto del día y las misiones (●●○), para que sepa que jugar activa cosas.
 * Con `left` 0 celebra que se acaban de desbloquear (pantalla final de la partida que lo logró).
 */
export const UnlockHint = memo(function UnlockHint({ left }: { left: number }) {
  const unlocked = left <= 0;
  const done = Math.min(DAILY_FROM_RUNS, Math.max(0, DAILY_FROM_RUNS - left));
  const text = unlocked ? UNLOCKED_TEXT : unlockHintText(left);
  return (
    <View style={[styles.box, unlocked && styles.boxDone]} accessible accessibilityLabel={text} accessibilityLiveRegion="polite">
      <View style={styles.dots}>
        {Array.from({ length: DAILY_FROM_RUNS }, (_, i) => (
          <View key={i} style={[styles.dot, i < done && styles.dotOn]} />
        ))}
      </View>
      <Text style={[styles.text, unlocked && styles.textDone]}>{text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelBorder,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  boxDone: { borderColor: C.good },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.heartOff },
  dotOn: { backgroundColor: C.accent },
  text: { flex: 1, color: C.text, opacity: 0.8, fontSize: 13, lineHeight: 18 },
  textDone: { color: C.good, opacity: 1, fontWeight: '700' },
});
