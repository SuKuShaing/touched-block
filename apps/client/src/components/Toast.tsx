import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/theme';

/** Avisos breves ("Copiado al portapapeles"). Sin alert(): un cartel abajo que se va solo. */
let current: { id: number; text: string } | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string) {
  current = { id: ++seq, text };
  emit();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const get = () => current;

export function ToastHost({ bottom = 0 }: { bottom?: number }) {
  const t = useSyncExternalStore(subscribe, get, get);
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!t) return;
    setShown(t.id);
    const timer = setTimeout(() => setShown((s) => (s === t.id ? null : s)), 2600);
    return () => clearTimeout(timer);
  }, [t]);

  if (!t || shown !== t.id) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: bottom + insets.bottom + 16 }]}>
      <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={styles.t}>{t.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  toast: {
    backgroundColor: '#2a2a3d',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    maxWidth: 360,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  t: { color: C.text, fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
