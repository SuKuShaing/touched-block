import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C } from '@/theme';

/** Control segmentado (pestañas) o, con `chips`, filtros pequeños. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  chips,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  chips?: boolean;
  label: string;
}) {
  return (
    <View style={[styles.wrap, chips && styles.wrapChips]} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              chips ? styles.chip : styles.seg,
              on && (chips ? styles.chipOn : styles.segOn),
              pressed && styles.pressed,
            ]}
          >
            <Text style={[chips ? styles.chipT : styles.segT, on && (chips ? styles.chipTOn : styles.segTOn)]} selectable={false}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 12, padding: 3, gap: 3 },
  wrapChips: { backgroundColor: 'transparent', padding: 0, gap: 6, justifyContent: 'center' },
  seg: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: C.accent },
  segT: { color: C.text, opacity: 0.75, fontWeight: '700', fontSize: 14 },
  segTOn: { color: C.bg, opacity: 1 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.panelBorder },
  chipOn: { backgroundColor: C.accentSoft, borderColor: C.accent },
  chipT: { color: C.text, opacity: 0.7, fontSize: 13, fontWeight: '600' },
  chipTOn: { color: C.accent, opacity: 1 },
  pressed: { opacity: 0.7 },
});
