import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage, isApiError } from '@/api/client';
import { follow, unfollow } from '@/api/endpoints';
import { useInvalidate, useProfile, useViewer } from '@/api/hooks';
import { SmallButton } from '@/components/form';
import { ProfileIcon } from '@/components/ProfileIcon';
import { toast } from '@/components/Toast';
import { countryName, flag } from '@/lib/countries';
import { C } from '@/theme';

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{value}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

/** Perfil público `/u/[username]`: récord, invitados, seguidores y botón para seguir. */
export function PublicProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username: raw } = useLocalSearchParams<{ username: string }>();
  const username = String(raw ?? '').replace(/^@/, '');
  const viewer = useViewer();
  const q = useProfile(username);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const toggleFollow = async () => {
    if (!q.data) return;
    setBusy(true);
    try {
      if (q.data.isFollowing) await unfollow(q.data.id);
      else await follow(q.data.id);
      invalidate('profile', 'following', 'lb', 'me', 'search');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (q.isPending) body = <ActivityIndicator color={C.text} style={styles.pad} />;
  else if (q.isError)
    body = (
      <View style={styles.center}>
        <Text style={styles.muted}>
          {isApiError(q.error) && q.error.code === 'user_not_found' ? `No existe el usuario @${username}.` : errorMessage(q.error)}
        </Text>
        {!(isApiError(q.error) && q.error.status === 404) ? <SmallButton title="Reintentar" kind="ghost" onPress={() => void q.refetch()} /> : null}
      </View>
    );
  else {
    const p = q.data;
    body = (
      <>
        <View style={styles.avatar}>
          <ProfileIcon size={34} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          @{p.username}
        </Text>
        {p.country ? (
          <Text style={styles.sub}>
            {flag(p.country)} {countryName(p.country)}
          </Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cap}>Récord histórico</Text>
          {p.best ? (
            <Text style={styles.best}>
              {p.best.killed} <Text style={styles.bestU}>bloques</Text>
            </Text>
          ) : (
            <Text style={styles.muted}>Todavía no tiene puntaje.</Text>
          )}
          <View style={styles.stats}>
            <Stat value={p.followersCount} label={p.followersCount === 1 ? 'seguidor' : 'seguidores'} />
            <Stat value={p.followingCount} label="siguiendo" />
            <Stat value={p.invitedCount} label={p.invitedCount === 1 ? 'invitado' : 'invitados'} />
          </View>
        </View>

        {p.isMe ? (
          <SmallButton title="Este eres tú · Ir a tu perfil" kind="ghost" onPress={() => router.navigate('/perfil')} />
        ) : viewer.loggedIn ? (
          <SmallButton
            title={p.isFollowing ? 'Siguiendo ✓' : 'Seguir'}
            kind={p.isFollowing ? 'ghost' : 'primary'}
            accessibilityLabel={p.isFollowing ? `Dejar de seguir a ${p.username}` : `Seguir a ${p.username}`}
            busy={busy}
            onPress={toggleFollow}
          />
        ) : (
          <Text style={styles.muted}>Inicia sesión en tu perfil para seguir a @{p.username}.</Text>
        )}
      </>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={10} onPress={back} style={styles.backBtn}>
          <Text style={styles.backT}>‹ Volver</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>{body}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { height: 52, justifyContent: 'center', paddingHorizontal: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 6 },
  backT: { color: C.accent, fontSize: 17, fontWeight: '600' },
  content: { alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  pad: { marginTop: 40 },
  center: { alignItems: 'center', gap: 12, marginTop: 40 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: C.text, fontSize: 26, fontWeight: '800' },
  sub: { color: C.text, opacity: 0.75, fontSize: 15 },
  muted: { color: C.text, opacity: 0.65, fontSize: 14, textAlign: 'center' },
  card: { width: '100%', maxWidth: 360, backgroundColor: C.panel, borderRadius: 16, padding: 16, gap: 10, alignItems: 'center' },
  cap: { color: C.text, opacity: 0.6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.9 },
  best: { color: C.gold, fontSize: 34, fontWeight: '800' },
  bestU: { fontSize: 16, fontWeight: '600' },
  stats: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 4 },
  stat: { alignItems: 'center' },
  statN: { color: C.text, fontSize: 20, fontWeight: '800' },
  statL: { color: C.text, opacity: 0.6, fontSize: 12 },
});
