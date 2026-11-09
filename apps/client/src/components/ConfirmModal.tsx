import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '@/theme';

/** Confirmación dentro de la app (en vez de window.confirm). */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  danger,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} accessibilityLabel="Cerrar" />
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.msg}>{message}</Text>
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]}
            >
              <Text style={styles.cancelT}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              disabled={busy}
              style={({ pressed }) => [styles.btn, danger ? styles.danger : styles.ok, (pressed || busy) && styles.pressed]}
            >
              <Text style={[styles.okT, danger && styles.dangerT]}>{busy ? 'Un momento…' : confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, backgroundColor: C.panel, borderRadius: 18, padding: 20, gap: 12, borderWidth: 1, borderColor: C.panelBorder },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  msg: { color: C.text, opacity: 0.8, fontSize: 15, lineHeight: 22 },
  err: { color: C.bad, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancel: { backgroundColor: C.barBg },
  cancelT: { color: C.text, fontWeight: '700', fontSize: 15 },
  ok: { backgroundColor: C.accent },
  okT: { color: C.bg, fontWeight: '800', fontSize: 15 },
  danger: { backgroundColor: C.danger },
  dangerT: { color: C.text },
  pressed: { opacity: 0.7 },
});
