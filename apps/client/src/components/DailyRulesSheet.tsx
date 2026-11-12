import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DAILY_ATTEMPTS_ACCOUNT, DAILY_ATTEMPTS_GUEST, DAILY_LIVES, type GameMods } from '@tb/engine';
import { todayLine } from '@/lib/daily';
import { C } from '@/theme';

const intentos = (n: number) => (n === 1 ? '1 intento' : `${n} intentos`);

/** Reglas del reto diario en frases (los números salen de las constantes del motor). */
export function dailyRulesLines(loggedIn: boolean, mods: GameMods | null | undefined): string[] {
  const lives = mods?.lives ?? DAILY_LIVES;
  return [
    'La misma partida para todos: los mismos bloques, en el mismo orden.',
    loggedIn
      ? `Tienes ${intentos(DAILY_ATTEMPTS_ACCOUNT)} por día y cuenta el mejor.`
      : `Como invitado tienes ${intentos(DAILY_ATTEMPTS_GUEST)}; con una cuenta, ${intentos(DAILY_ATTEMPTS_ACCOUNT)} y cuenta el mejor.`,
    'El intento se gasta al empezar, aunque no termines la partida.',
    'Si se corta la conexión a mitad de partida, el intento se pierde.',
    `Juegas con ${lives} vidas. Tiene su propio ranking del día: no cuenta para tu récord ni para el ranking general.`,
  ];
}

/**
 * Hoja con las reglas del reto diario. Se abre la primera vez que se toca la tarjeta del reto;
 * "Empezar" la cierra y empieza la partida (quien la abre marca las reglas como vistas).
 */
export function DailyRulesSheet({
  visible,
  number,
  title,
  mods,
  loggedIn,
  onStart,
  onClose,
}: {
  visible: boolean;
  /** Número del reto ("Reto de hoy #42"). */
  number: number;
  /** Modificador del día en palabras ("Directo a las sumas"). */
  title: string;
  mods: GameMods | null | undefined;
  loggedIn: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} accessibilityViewIsModal>
          <Text style={styles.cap}>Reto de hoy #{number}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {todayLine(title)}
          </Text>
          <View style={styles.list}>
            {dailyRulesLines(loggedIn, mods).map((line) => (
              <View key={line} style={styles.item}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.line}>{line}</Text>
              </View>
            ))}
          </View>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]}>
              <Text style={styles.cancelT}>Ahora no</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onStart} style={({ pressed }) => [styles.btn, styles.ok, pressed && styles.pressed]}>
              <Text style={styles.okT}>Empezar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: C.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: C.panelBorder,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  cap: { color: C.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9 },
  title: { color: C.text, fontSize: 21, fontWeight: '800', marginTop: -4 },
  list: { gap: 8 },
  item: { flexDirection: 'row', gap: 8 },
  bullet: { color: C.accent, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  line: { flex: 1, color: C.text, opacity: 0.85, fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancel: { backgroundColor: C.barBg },
  cancelT: { color: C.text, fontWeight: '700', fontSize: 15 },
  ok: { backgroundColor: C.accent },
  okT: { color: C.bg, fontWeight: '800', fontSize: 15 },
  pressed: { opacity: 0.7 },
});
