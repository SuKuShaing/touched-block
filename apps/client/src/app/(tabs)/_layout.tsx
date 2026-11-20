import { usePathname } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useViewer } from '@/api/hooks';
import { BlurScreen, TabBarBackground } from '@/components/TabBarBlur';
import { PersonIcon, PlayIcon, PodiumIcon, TrophyIcon } from '@/components/TabIcons';
import { features } from '@/config';
import { useActiveCosmetics } from '@/cosmetics/active';
import { tierRefForTicks } from '@tb/engine';
import { fx } from '@/platform/fx';
import { useCollectionNews } from '@/lib/collectionNews';
import { usePlaying } from '@/lib/playing';
import { TAB_BAR_GAP, TAB_BAR_H, TAB_BAR_RADIUS } from '@/lib/tabBar';
import { APP_FONT } from '@/components/appFont';
import { C } from '@/theme';

/**
 * Pestañas de abajo: Jugar / Rankings / Colección / Perfil (solo con cuentas; sin API el juego se
 * ve como antes, sin barra, y la Colección se abre desde el Perfil). La barra flota sobre las
 * pantallas (position: absolute, redondeada y separada de los bordes) para que esconderla durante
 * la partida no cambie el tamaño del campo; cada pantalla deja su espacio con useTabBarSpace().
 */
export default function TabsLayout() {
  const playing = usePlaying();
  const hidden = !features.accounts || playing;
  const insets = useSafeAreaInsets();
  const news = useCollectionNews();
  const tier = useMyTier();
  // La barra dibuja dos copias de cada ícono (activa e inactiva) y solo cambia cuál se ve: con el
  // "focused" que entrega, ninguna copia cambia de estado y no habría animación. Por eso el estado
  // sale de la ruta: las dos copias lo reciben igual y la que se ve anima el cambio.
  const path = usePathname();
  const on = (name: string) => (name === 'index' ? path === '/' : path === '/' + name);
  const tap = { tabPress: () => fx.buzz(10) };
  return (
    <Tabs
      backBehavior="history"
      screenLayout={({ route, children }) => <BlurScreen active={on(route.name)}>{children}</BlurScreen>}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: [
          {
            position: 'absolute',
            left: TAB_BAR_GAP,
            right: TAB_BAR_GAP,
            bottom: TAB_BAR_GAP + insets.bottom,
            height: TAB_BAR_H,
            paddingTop: 6,
            paddingBottom: 6,
            // fondo transparente: lo pone TabBarBackground (desenfoque + velo)
            backgroundColor: 'transparent',
            borderRadius: TAB_BAR_RADIUS,
            borderWidth: 1,
            borderTopWidth: 1,
            borderColor: 'rgba(255,255,255,0.09)',
            borderTopColor: 'rgba(255,255,255,0.09)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          },
          hidden && { display: 'none' },
        ],
        tabBarBackground: () => <TabBarBackground off={hidden} radius={TAB_BAR_RADIUS} />,
        tabBarItemStyle: { borderRadius: 18 },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarLabelStyle: { ...APP_FONT, fontSize: 12, lineHeight: 16, fontWeight: '700' },
        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={tap}
        options={{
          title: 'Touched Block',
          tabBarLabel: 'Jugar',
          tabBarIcon: ({ color }) => <PlayIcon color={String(color)} focused={on('index')} />,
        }}
      />
      <Tabs.Screen
        name="rankings"
        listeners={tap}
        options={{
          title: 'Rankings · Touched Block',
          tabBarLabel: 'Rankings',
          href: features.accounts ? undefined : null,
          tabBarIcon: ({ color }) => <PodiumIcon color={String(color)} focused={on('rankings')} />,
        }}
      />
      <Tabs.Screen
        name="coleccion"
        listeners={tap}
        options={{
          title: 'Colección · Touched Block',
          tabBarLabel: 'Colección',
          tabBarAccessibilityLabel: news ? 'Colección, hay novedades' : 'Colección',
          tabBarIcon: ({ color }) => <TrophyIcon color={String(color)} focused={on('coleccion')} dot={news && !on('coleccion')} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        listeners={tap}
        options={{
          title: 'Perfil · Touched Block',
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => <PersonIcon color={String(color)} focused={on('perfil')} tier={tier} />,
        }}
      />
    </Tabs>
  );
}

/** Insignia actual (la de la cuenta con sesión; la local como invitado), para el pecho del ícono de Perfil. */
function useMyTier() {
  const viewer = useViewer();
  const { stats } = useActiveCosmetics();
  if (viewer.user) return viewer.user.tier ?? null;
  return stats.runs > 0 ? tierRefForTicks(stats.bestTicks) : null;
}
