import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { type DateKey, addDays } from '@tb/engine';
import type { DailyYesterday } from '@/api/daily';
import { useDailyStatus } from '@/api/dailyHooks';
import { useViewer } from '@/api/hooks';
import {
  attemptDots,
  attemptsText,
  countdownWords,
  fmtCountdown,
  loadDailyLocal,
  markRulesSeen,
  markYesterdaySeen,
  shouldShowYesterday,
  streakText,
  todayLine,
  useDailyLocal,
  useMsToMidnight,
  yesterdayText,
} from '@/lib/daily';
import { C } from '@/theme';
import { DailyRulesSheet } from './DailyRulesSheet';

/** "Nuevo reto en 5:12:33" (se actualiza cada segundo, sin volver a dibujar la tarjeta). */
function Countdown({ prefix }: { prefix: string }) {
  const ms = useMsToMidnight();
  return (
    <Text style={styles.small} accessibilityLabel={`${prefix} ${countdownWords(ms)}`}>
      {prefix} <Text style={styles.mono}>{fmtCountdown(ms)}</Text>
    </Text>
  );
}

/**
 * "Ayer quedaste 12.º de 80. Ganó @jose con 91." Se muestra una sola vez por fecha: la primera
 * vez que llega el resumen de ayer queda marcado como visto, pero sigue visible mientras la
 * tarjeta esté montada.
 */
function useYesterdayOnce(date: DateKey, yesterday: DailyYesterday | null | undefined): DailyYesterday | null {
  const [shown, setShown] = useState<DailyYesterday | null>(null);
  useEffect(() => {
    if (!yesterday || yesterday.date !== addDays(date, -1)) return;
    if (shown?.date === yesterday.date) return;
    if (!shouldShowYesterday(loadDailyLocal(), yesterday)) return;
    setShown(yesterday);
    markYesterdaySeen(yesterday.date);
  }, [date, yesterday, shown]);
  return shown && shown.date === addDays(date, -1) ? shown : null;
}

export interface DailyCardProps {
  /** Fecha local de hoy (`useToday()` de `lib/daily.ts`). */
  date: DateKey;
  /** Empieza la partida del reto de esa fecha (la conecta GameScreen). */
  onStart: (date: DateKey) => void;
  /** Se está preparando la partida ("Preparando…"). */
  busy?: boolean;
  /** Por qué no se pudo empezar la última vez ("El reto necesita conexión."). */
  error?: string | null;
  /**
   * Abre la hoja de reglas aunque ya se haya visto (enlace `?diario=1`); la tarjeta avisa con
   * `onRulesOpened` para que quien la usa lo apague. El intento solo se gasta con "Empezar".
   */
  openRules?: boolean;
  onRulesOpened?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Tarjeta del reto de hoy en el inicio: número, modificador del día, intentos (●●○), cuenta
 * regresiva al siguiente, racha de días y, una vez por fecha, el resumen de ayer. La primera vez
 * que se toca abre las reglas; después empieza directo. Sin intentos muestra el mejor del día y
 * "Vuelve mañana".
 */
export function DailyCard({ date, onStart, busy, error, openRules, onRulesOpened, style }: DailyCardProps) {
  const viewer = useViewer();
  const local = useDailyLocal();
  const { status, overview, loading } = useDailyStatus(date);
  const yesterday = useYesterdayOnce(date, overview?.yesterday);
  const [rules, setRules] = useState(false);

  // La pantalla pide abrir las reglas (enlace ?diario=1). Con sesión se espera a saber los
  // intentos (GET /daily): sin intentos no se abren, la tarjeta ya dice "Vuelve mañana".
  const canPlayRef = useRef(status.canPlay);
  canPlayRef.current = status.canPlay;
  const openedRef = useRef(onRulesOpened);
  openedRef.current = onRulesOpened;
  useEffect(() => {
    if (!openRules || loading) return;
    if (canPlayRef.current) setRules(true);
    openedRef.current?.();
  }, [openRules, loading]);

  const streak = streakText(status.streak.current);
  const canPress = status.canPlay && !busy;

  const press = () => {
    if (!canPress) return;
    if (!local.rulesSeen) setRules(true);
    else onStart(date);
  };
  const startFromRules = () => {
    markRulesSeen();
    setRules(false);
    onStart(date);
  };

  const a11y = [
    `Reto de hoy número ${status.number}`,
    todayLine(status.title),
    status.attemptsKnown ? attemptsText(status.attemptsLeft) : null,
    streak,
    status.canPlay ? 'Toca para jugar el reto' : 'Vuelve mañana',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ disabled: !canPress, busy: !!busy }}
        disabled={!canPress}
        onPress={press}
        style={({ pressed }) => [styles.card, !status.canPlay && styles.cardDone, pressed && styles.pressed, style]}
      >
        <View style={styles.head}>
          <Text style={styles.cap}>Reto de hoy #{status.number}</Text>
          {streak ? <Text style={styles.streak}>{streak}</Text> : null}
        </View>
        <Text style={styles.title}>{todayLine(status.title)}</Text>

        {status.canPlay ? (
          <>
            {status.attemptsKnown ? (
              <View style={styles.row}>
                <Text style={styles.dots} accessible={false}>
                  {attemptDots(status.attemptsLeft, status.attemptsMax)}
                </Text>
                <Text style={styles.body}>{attemptsText(status.attemptsLeft)}</Text>
              </View>
            ) : null}
            <Countdown prefix="Nuevo reto en" />
          </>
        ) : (
          <>
            <Text style={styles.body}>
              {status.best ? (
                <>
                  Tu mejor de hoy: <Text style={styles.strong}>{status.best.killed}</Text> {status.best.killed === 1 ? 'bloque' : 'bloques'}
                </>
              ) : (
                'Ya usaste tus intentos de hoy.'
              )}
            </Text>
            <Countdown prefix="Vuelve mañana · nuevo reto en" />
          </>
        )}

        {yesterday ? <Text style={styles.yesterday}>{yesterdayText(yesterday)}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {status.canPlay ? (
          <View style={styles.cta}>
            {busy ? <ActivityIndicator size="small" color={C.accent} /> : null}
            <Text style={styles.ctaT} selectable={false}>
              {busy ? 'Preparando…' : 'Jugar el reto ›'}
            </Text>
          </View>
        ) : null}
      </Pressable>
      <DailyRulesSheet
        visible={rules}
        number={status.number}
        title={status.title}
        mods={status.mods}
        loggedIn={viewer.loggedIn}
        onStart={startFromRules}
        onClose={() => setRules(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  cardDone: { borderColor: C.panelBorder },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cap: { color: C.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9 },
  streak: { color: C.gold, fontSize: 13, fontWeight: '800' },
  title: { color: C.text, fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dots: { color: C.accent, fontSize: 15, letterSpacing: 2 },
  body: { color: C.text, opacity: 0.85, fontSize: 14, lineHeight: 19 },
  strong: { fontWeight: '800', color: C.accent },
  small: { color: C.text, opacity: 0.6, fontSize: 13 },
  mono: { fontVariant: ['tabular-nums'] },
  yesterday: { color: C.text, opacity: 0.85, fontSize: 13, lineHeight: 18, backgroundColor: C.barBg, borderRadius: 10, padding: 8 },
  error: { color: C.bad, fontSize: 13, lineHeight: 18 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 2 },
  ctaT: { color: C.accent, fontSize: 15, fontWeight: '800' },
});
