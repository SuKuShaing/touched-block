import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PersonIcon, PlayIcon, PodiumIcon } from '@/components/TabIcons';
import { features } from '@/config';
import { usePlaying } from '@/lib/playing';
import { C } from '@/theme';

/**
 * Pestañas de abajo: Jugar / Rankings / Perfil (solo con cuentas; sin API el juego se ve como
 * antes, sin barra). La barra flota sobre las pantallas (position: absolute) para que
 * esconderla durante la partida no cambie el tamaño del campo; cada pantalla deja su espacio
 * con useTabBarSpace().
 */
export default function TabsLayout() {
  const playing = usePlaying();
  const hidden = !features.accounts || playing;
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: [
          {
            position: 'absolute',
            backgroundColor: C.panel,
            borderTopColor: C.panelBorder,
            borderTopWidth: 1,
            height: 68 + insets.bottom,
            paddingTop: 4,
            paddingBottom: 4 + insets.bottom,
          },
          hidden && { display: 'none' },
        ],
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Touched Block', tabBarLabel: 'Jugar', tabBarIcon: ({ color }) => <PlayIcon color={String(color)} /> }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Rankings · Touched Block',
          tabBarLabel: 'Rankings',
          href: features.accounts ? undefined : null,
          tabBarIcon: ({ color }) => <PodiumIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil · Touched Block', tabBarLabel: 'Perfil', tabBarIcon: ({ color }) => <PersonIcon color={String(color)} /> }}
      />
    </Tabs>
  );
}
