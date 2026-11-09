import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, type HostInstance, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { loginGoogle } from '@/api/endpoints';
import type { LoginResponse } from '@/api/types';
import { config } from '@/config';
import { auth } from '@/platform/auth';
import { C } from '@/theme';
import { Hint, SmallButton, TextField } from './form';

/** Botón oficial de Google (GIS) dibujado dentro de un View. */
function GoogleButton({ onCredential, onError }: { onCredential: (t: string) => void; onError: (m: string) => void }) {
  const host = useRef<HostInstance>(null);
  const cb = useRef({ onCredential, onError });
  cb.current = { onCredential, onError };
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current as unknown as HTMLElement | null;
    const stop = auth.renderGoogleButton(
      el,
      { width: 280 },
      (t) => cb.current.onCredential(t),
      (m) => cb.current.onError(m),
    );
    // El botón aparece cuando GIS termina de cargar; mientras, un indicador.
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
      if (el && el.childElementCount > 0) {
        setReady(true);
        if (timer) clearInterval(timer);
        timer = null;
      }
    }, 150);
    return () => {
      if (timer) clearInterval(timer);
      stop();
    };
  }, []);

  return (
    <View style={styles.gWrap}>
      {!ready ? <ActivityIndicator style={StyleSheet.absoluteFill} color={C.text} /> : null}
      <View ref={host} style={styles.gHost} />
    </View>
  );
}

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/** Solo desarrollo (EXPO_PUBLIC_AUTH_DEV_FAKE=1): login con un nombre, sin Google. */
function DevLogin({ onToken, busy }: { onToken: (t: string) => void; busy: boolean }) {
  const [name, setName] = useState('');
  const s = slug(name);
  const submit = () => {
    if (s) onToken(`dev:u-${s}:${name.trim().slice(0, 60)}`);
  };
  return (
    <View style={styles.dev}>
      <View style={styles.devRow}>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="Nombre (dev)"
          autoCapitalize="words"
          onSubmitEditing={submit}
          accessibilityLabel="Nombre para entrar (dev)"
          maxLength={60}
        />
        <SmallButton title="Entrar (dev)" kind="ghost" onPress={submit} disabled={!s} busy={busy} />
      </View>
    </View>
  );
}

/**
 * Opciones para iniciar sesión: el botón de Google y, en desarrollo, "Entrar (dev)".
 * Llama `onLoggedIn` cuando la sesión quedó guardada.
 */
export function LoginOptions({ onLoggedIn }: { onLoggedIn?: (r: LoginResponse) => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const login = async (idToken: string) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await loginGoogle(idToken);
      await onLoggedIn?.(r);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      {auth.googleAvailable ? <GoogleButton onCredential={login} onError={setErr} /> : null}
      {config.authDevFake ? <DevLogin onToken={login} busy={busy} /> : null}
      {busy ? <Text style={styles.busy}>Iniciando sesión…</Text> : null}
      {err ? <Hint tone="bad">{err}</Hint> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 10, width: '100%' },
  gWrap: { minHeight: 44, minWidth: 200, alignItems: 'center', justifyContent: 'center' },
  gHost: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dev: { width: '100%', maxWidth: 320 },
  devRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  busy: { color: C.text, opacity: 0.7, fontSize: 14 },
});
