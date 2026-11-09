import { StyleSheet, Text, View } from 'react-native';
import type { LoginResponse } from '@/api/types';
import { C } from '@/theme';
import { LoginOptions } from './LoginOptions';
import { GhostButton } from './ui';

/**
 * Pantalla final de un invitado con una partida válida del servidor: iniciar sesión para que
 * la partida entre al ranking (se reclama con POST /runs/:id/claim) o seguir como invitado.
 */
export function AccountPrompt({
  onLoggedIn,
  onGuest,
}: {
  onLoggedIn: (r: LoginResponse) => void | Promise<void>;
  onGuest: () => void;
}) {
  return (
    <View style={styles.box}>
      <Text style={styles.t} selectable={false}>
        Inicia sesión para dejar tu puntaje en el ranking
      </Text>
      <LoginOptions onLoggedIn={onLoggedIn} />
      <GhostButton small title="Seguir como invitado" onPress={onGuest} />
      <Text style={styles.note} selectable={false}>
        Las partidas como invitado no quedan guardadas en el ranking.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 16, padding: 16, width: '100%', maxWidth: 340 },
  t: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  note: { color: C.text, opacity: 0.6, fontSize: 12, textAlign: 'center' },
});
