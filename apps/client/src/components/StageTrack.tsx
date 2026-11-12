import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { MILESTONES } from '@tb/engine';
import { fmtTime } from '@/lib/format';
import { milestonePos, nextMilestonePhrase, stagePhrase, ticksToSeconds, trackPos } from '@/lib/stagePath';
import { C } from '@/theme';

const KNOB = 12;
const ICON_W = 30;

/** Duración jugada "m:ss", hacia abajo (fmtTime redondea hacia arriba porque es una cuenta regresiva). */
const fmtPlayed = (s: number) => fmtTime(Math.floor(s));

/**
 * Camino de etapas de la pantalla final: los hitos de la partida (cada uno con el mismo ancho),
 * hasta dónde llegó hoy y su mejor partida anterior, con una frase debajo ("Te faltaron 28 s
 * para las sumas y restas"). Con movimiento reducido, sin animación de llenado.
 *
 * Variante de reto (`challenge`, duel y daily): esas partidas no cuentan para la insignia (D6),
 * así que no hay marca "tu mejor" ni "¡Llegaste a…!"; solo hasta dónde llegó y cuánto faltó para
 * el siguiente hito. Con `startAt` (segundos, modificador del reto diario) el camino usa la
 * dificultad alcanzada: el llenado parte en ese punto y llega a `startAt` + lo jugado.
 */
export function StageTrack({
  todayTicks,
  prevBestTicks = 0,
  challenge = false,
  startAt = 0,
}: {
  todayTicks: number;
  prevBestTicks?: number;
  challenge?: boolean;
  startAt?: number;
}) {
  const reduced = useReducedMotion();
  const today = ticksToSeconds(todayTicks);
  const prev = challenge ? 0 : ticksToSeconds(prevBestTicks);
  const reached = startAt + today;
  const startP = trackPos(startAt);
  const todayP = trackPos(reached);
  const bestP = prev > 0 ? trackPos(prev) : null;
  const phrase = challenge ? nextMilestonePhrase(reached) : stagePhrase(todayTicks, prevBestTicks);
  const reachedNew = !challenge && phrase.startsWith('¡');

  const p = useSharedValue(reduced ? todayP : startP);
  useEffect(() => {
    if (reduced) {
      p.value = todayP;
      return;
    }
    p.value = startP;
    p.value = withDelay(120, withTiming(todayP, { duration: 750, easing: Easing.out(Easing.cubic) }));
  }, [p, startP, todayP, reduced]);
  const fillStyle = useAnimatedStyle(() => ({ left: `${startP * 100}%`, width: `${Math.max(0, p.value - startP) * 100}%` }));
  const knobStyle = useAnimatedStyle(() => ({ left: `${p.value * 100}%` }));

  const bestLabel = bestP === null ? null : today > prev ? 'Tu mejor anterior' : 'Tu mejor';

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Camino de etapas. Hoy: ${fmtPlayed(today)}.${bestLabel ? ` ${bestLabel}: ${fmtPlayed(prev)}.` : ''} ${phrase}`}
    >
      <View style={styles.trackBox}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
          {MILESTONES.slice(0, -1).map((m, i) => (
            <View key={m.at} style={[styles.sep, { left: `${milestonePos(i) * 100}%` }]} />
          ))}
        </View>
        {bestP !== null ? <View style={[styles.best, { left: `${bestP * 100}%` }]} /> : null}
        <Animated.View style={[styles.knob, knobStyle]} />
        {MILESTONES.map((m, i) => {
          const pos = milestonePos(i);
          return (
            <Text
              key={m.at}
              style={[styles.icon, { left: `${pos * 100}%` }, pos <= todayP + 1e-9 && styles.iconOn]}
              selectable={false}
              numberOfLines={1}
            >
              {m.icon}
            </Text>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.dotToday} />
          <Text style={styles.legendT} selectable={false}>
            Hoy {fmtPlayed(today)}
          </Text>
        </View>
        {bestLabel ? (
          <View style={styles.legendItem}>
            <View style={styles.dotBest} />
            <Text style={styles.legendT} selectable={false}>
              {bestLabel} {fmtPlayed(prev)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.phrase, reachedNew && styles.phraseNew]} selectable={false}>
        {phrase}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 340, gap: 6, alignItems: 'center' },
  trackBox: { alignSelf: 'stretch', marginHorizontal: ICON_W / 2 + 2, height: 32 },
  track: { position: 'absolute', left: 0, right: 0, top: 3, height: 8, borderRadius: 4, backgroundColor: C.barBg, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, backgroundColor: C.accent },
  sep: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: C.bg, opacity: 0.85 },
  best: { position: 'absolute', top: 0, width: 4, height: 14, marginLeft: -2, borderRadius: 2, backgroundColor: C.gold },
  knob: {
    position: 'absolute',
    top: 7 - KNOB / 2,
    width: KNOB,
    height: KNOB,
    marginLeft: -KNOB / 2,
    borderRadius: KNOB / 2,
    backgroundColor: C.accent,
    borderWidth: 2,
    borderColor: C.bg,
  },
  icon: {
    position: 'absolute',
    top: 17,
    width: ICON_W,
    marginLeft: -ICON_W / 2,
    textAlign: 'center',
    color: C.text,
    opacity: 0.35,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  iconOn: { opacity: 0.9 },
  legend: { flexDirection: 'row', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotToday: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
  dotBest: { width: 4, height: 12, borderRadius: 2, backgroundColor: C.gold },
  legendT: { color: C.text, opacity: 0.75, fontSize: 13, fontVariant: ['tabular-nums'] },
  phrase: { color: C.text, opacity: 0.9, fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
  phraseNew: { color: C.gold, opacity: 1 },
});
