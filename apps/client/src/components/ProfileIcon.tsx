import { StyleSheet, View } from 'react-native';
import { C } from '@/theme';

/** Ícono de perfil (cabeza + hombros) dibujado con Views, sin fuentes de íconos. */
export function ProfileIcon({ size = 20, color = C.text }: { size?: number; color?: string }) {
  const head = size * 0.42;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', opacity: 0.85 }}>
      <View style={{ width: head, height: head, borderRadius: head / 2, backgroundColor: color }} />
      <View
        style={[
          styles.body,
          { width: size * 0.82, height: size * 0.4, borderTopLeftRadius: size * 0.4, borderTopRightRadius: size * 0.4, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({ body: { position: 'absolute', bottom: 0 } });
