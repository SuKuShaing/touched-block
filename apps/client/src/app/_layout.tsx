import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ApiError, warmSession } from '@/api/client';
import { ShareCardHost } from '@/components/ShareCardHost';
import { ToastHost } from '@/components/Toast';
import { startVisitTracking } from '@/lib/onboarding';
import { features } from '@/config';
import { C } from '@/theme';
import '@/platform/webFont';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // solo se reintentan los errores de red, una vez
        retry: (count, e) => e instanceof ApiError && e.status === 0 && e.code !== 'no_api' && count < 1,
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Web: el script de mudanza de public/index.html está llevando al jugador a la web vieja para traer
 * sus datos (ida y vuelta, una sola vez). La app no arranca para no escribir nada mientras tanto.
 */
const LEAVING = typeof window !== 'undefined' && (window as { __tbMudanza?: boolean }).__tbMudanza === true;

export default function RootLayout() {
  return LEAVING ? null : <App />;
}

function App() {
  const [qc] = useState(makeQueryClient);

  // Con sesión guardada, se renueva el access token al abrir (en segundo plano).
  useEffect(() => {
    if (features.accounts) warmSession();
  }, []);

  // Cuenta las visitas de este dispositivo (deciden cuándo se abre cada tutorial).
  useEffect(() => startVisitTracking(), []);

  return (
    <QueryClientProvider client={qc}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="como-jugar" options={{ title: 'Cómo se juega · Touched Block' }} />
          <Stack.Screen name="u/[username]" options={{ title: 'Perfil · Touched Block' }} />
        </Stack>
        {/* solo en nativo: dibuja y captura la tarjeta de compartir (en la web no hace nada) */}
        <ShareCardHost />
        <ToastHost bottom={features.accounts ? 64 : 0} />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
