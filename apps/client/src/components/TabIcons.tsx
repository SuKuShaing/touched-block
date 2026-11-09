import { View } from 'react-native';
import { ProfileIcon } from './ProfileIcon';

// Íconos de la barra de pestañas dibujados con Views (sin fuentes de íconos).

export function PlayIcon({ color, size = 22 }: { color: string; size?: number }) {
  const h = size * 0.8;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: size * 0.12,
          borderTopWidth: h / 2,
          borderBottomWidth: h / 2,
          borderLeftWidth: h * 0.85,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
          borderRadius: 2,
        }}
      />
    </View>
  );
}

export function PodiumIcon({ color, size = 22 }: { color: string; size?: number }) {
  const w = size * 0.28;
  const bar = (h: number) => (
    <View style={{ width: w, height: size * h, backgroundColor: color, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
  );
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: size * 0.05 }}>
      {bar(0.55)}
      {bar(0.9)}
      {bar(0.4)}
    </View>
  );
}

export function PersonIcon({ color, size = 22 }: { color: string; size?: number }) {
  return <ProfileIcon size={size} color={color} />;
}
