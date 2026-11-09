import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ApiError, warmSession } from '@/api/client';
import { ToastHost } from '@/components/Toast';
import { features } from '@/config';
import { C } from '@/theme';

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

export default function RootLayout() {
  const [qc] = useState(makeQueryClient);

  // Con sesión guardada, se renueva el access token al abrir (en segundo plano).
  useEffect(() => {
    if (features.accounts) warmSession();
  }, []);

  return (
    <QueryClientProvider client={qc}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="como-jugar" options={{ title: 'Cómo se juega · Touched Block' }} />
          <Stack.Screen name="u/[username]" options={{ title: 'Perfil · Touched Block' }} />
        </Stack>
        <ToastHost bottom={features.accounts ? 64 : 0} />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
