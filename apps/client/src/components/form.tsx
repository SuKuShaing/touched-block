import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { C } from '@/theme';

/** Campo de texto oscuro. `prefix` muestra p. ej. "@" a la izquierda. */
export function TextField({ prefix, style, ...props }: TextInputProps & { prefix?: string }) {
  return (
    <View style={styles.field}>
      {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.35)"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        {...props}
        style={[styles.input, style]}
      />
    </View>
  );
}

/** Botón compacto para formularios y listas. */
export function SmallButton({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={!!off}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, styles[kind], off && styles.off, pressed && !off && styles.pressed]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={kind === 'primary' ? C.bg : C.text} />
      ) : (
        <Text style={[styles.btnT, kind === 'primary' ? styles.primaryT : kind === 'danger' ? styles.dangerT : styles.otherT]} selectable={false}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Texto de ayuda / error bajo un campo. */
export function Hint({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'bad' }) {
  return <Text style={[styles.hint, tone === 'ok' && styles.ok, tone === 'bad' && styles.bad]}>{children}</Text>;
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.panelBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    flex: 1,
  },
  prefix: { color: C.text, opacity: 0.5, fontSize: 16, marginRight: 2 },
  input: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 10, outlineStyle: 'none' } as object,
  btn: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  primary: { backgroundColor: C.accent },
  ghost: { backgroundColor: C.barBg },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.danger },
  off: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.96 }] },
  btnT: { fontSize: 15, fontWeight: '800' },
  primaryT: { color: C.bg },
  otherT: { color: C.text },
  dangerT: { color: C.bad },
  hint: { color: C.text, opacity: 0.6, fontSize: 13, lineHeight: 18, alignSelf: 'stretch' },
  ok: { color: C.good, opacity: 1 },
  bad: { color: C.bad, opacity: 1 },
});
