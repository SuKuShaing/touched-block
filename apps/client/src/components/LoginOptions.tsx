import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, type HostInstance, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { loginApple, loginGoogle } from '@/api/endpoints';
import type { LoginResponse } from '@/api/types';
import { config } from '@/config';
import { appleNameForLogin, forgetAppleName } from '@/lib/appleName';
import { auth } from '@/platform/auth';
import { C } from '@/theme';
import { AppleSignInButton } from './AppleSignInButton';
import { Hint, SmallButton, TextField } from './form';
import { LegalConsent } from './LegalLinks';

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

/**
 * App: botón con el estilo del de Google en la web (píldora negra, logo G, "Iniciar sesión con
 * Google") que abre el selector de cuentas del sistema (auth.signInGoogle).
 */
function NativeGoogleButton({
  onCredential,
  onError,
  onStart,
  disabled,
}: {
  onCredential: (t: string) => void;
  onError: (m: string) => void;
  onStart: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const press = async () => {
    // mientras se inicia sesión con un token no se abre otro selector
    if (open || disabled || !auth.signInGoogle) return;
    onStart();
    setOpen(true);
    try {
      const r = await auth.signInGoogle();
      if (r.idToken) onCredential(r.idToken);
      else if (r.error) onError(r.error);
    } finally {
      setOpen(false);
    }
  };
  return (
    <Pressable
      onPress={press}
      disabled={open || disabled}
      accessibilityRole="button"
      accessibilityLabel="Iniciar sesión con Google"
      style={({ pressed }) => [styles.gNative, (pressed || open) && { opacity: 0.8 }]}
    >
      <View style={styles.gLogoBox}>
        <Image source={require('@/assets/google-g.png')} style={styles.gLogo} />
      </View>
      <Text style={styles.gText} numberOfLines={1}>
        Iniciar sesión con Google
      </Text>
    </Pressable>
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

/** true cuando hay Sign in with Apple: iOS (lo confirma el sistema) o web con Services ID. */
function useAppleAvailable() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    auth
      .appleAvailable()
      .then((v) => {
        if (alive) setOk(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return ok;
}

/**
 * Opciones para iniciar sesión: Sign in with Apple (iOS, y la web si hay Services ID; arriba, como
 * pide Apple), el botón de Google y, en desarrollo, "Entrar (dev)". Android: solo Google.
 * Llama `onLoggedIn` cuando la sesión quedó guardada.
 */
export function LoginOptions({ onLoggedIn }: { onLoggedIn?: (r: LoginResponse) => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apple = useAppleAvailable();
  // evita dos inicios de sesión a la vez aunque el estado aún no se haya actualizado
  const running = useRef(false);

  const run = async (go: () => Promise<LoginResponse | null>) => {
    if (busy || running.current) return;
    running.current = true;
    setBusy(true);
    setErr(null);
    try {
      const r = await go();
      if (r) await onLoggedIn?.(r);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const login = (idToken: string) => run(() => loginGoogle(idToken));

  const loginWithApple = () =>
    run(async () => {
      const r = await auth.signInApple?.();
      if (!r?.identityToken) {
        if (r?.error) setErr(r.error);
        return null;
      }
      // Apple da el nombre solo la 1.ª vez: si este intento falla, el siguiente lo manda desde memoria
      const fullName = appleNameForLogin(r.identityToken, r.fullName);
      const res = await loginApple({
        identityToken: r.identityToken,
        authorizationCode: r.authorizationCode,
        fullName,
        redirectUri: r.redirectUri,
      });
      forgetAppleName(r.identityToken);
      return res;
    });

  return (
    <View style={styles.box}>
      {apple && auth.signInApple ? <AppleSignInButton onPress={loginWithApple} disabled={busy} width={280} height={40} /> : null}
      {auth.googleAvailable ? (
        auth.signInGoogle ? (
          <NativeGoogleButton onCredential={login} onError={setErr} onStart={() => setErr(null)} disabled={busy} />
        ) : (
          <GoogleButton onCredential={login} onError={setErr} />
        )
      ) : null}
      {config.authDevFake ? <DevLogin onToken={login} busy={busy} /> : null}
      {busy ? <Text style={styles.busy}>Iniciando sesión…</Text> : null}
      {err ? <Hint tone="bad">{err}</Hint> : null}
      {auth.googleAvailable || apple || config.authDevFake ? <LegalConsent /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 10, width: '100%' },
  gWrap: { minHeight: 44, minWidth: 200, alignItems: 'center', justifyContent: 'center' },
  gHost: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  // como el botón de GIS: theme filled_black, size large, shape pill, ancho 280
  gNative: {
    width: 280,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#131314',
    borderWidth: 1,
    borderColor: '#8e918f',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 3,
    paddingRight: 12,
  },
  gLogoBox: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  gLogo: { width: 18, height: 18 },
  gText: { flex: 1, textAlign: 'center', color: '#e3e3e3', fontSize: 14, fontWeight: '500', marginRight: 22 },
  dev: { width: '100%', maxWidth: 320 },
  devRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  busy: { color: C.text, opacity: 0.7, fontSize: 14 },
});
