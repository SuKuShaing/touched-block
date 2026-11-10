import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_LIVES, MAX_LIVES_CAP } from '@tb/engine';
import { errorMessage, isApiError } from '@/api/client';
import { checkUsername, deleteAccount, fetchMe, follow, logout, searchUsers, setInviter, unfollow, updateMe } from '@/api/endpoints';
import { useFollowing, useInvalidate, useMeRefresh, useViewer } from '@/api/hooks';
import type { CheckUsername, Me, SearchUser } from '@/api/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import { notifyShare } from '@/components/EndPanel';
import { Hint, SmallButton, TextField } from '@/components/form';
import { Hearts } from '@/components/Hud';
import { LegalLinks } from '@/components/LegalLinks';
import { LoginOptions } from '@/components/LoginOptions';
import { ProfileIcon } from '@/components/ProfileIcon';
import { toast } from '@/components/Toast';
import { GhostButton, RecordPill } from '@/components/ui';
import { features } from '@/config';
import { countryName, flag, sortedCountries } from '@/lib/countries';
import { loadBest, loadHist } from '@/lib/history';
import { replayView } from '@/lib/onboarding';
import { SITE_URL, inviteText } from '@/lib/shareText';
import { useTabBarSpace } from '@/lib/tabBar';
import { SEARCH_LIMIT, matchRange, searchKey } from '@/lib/userSearch';
import { share } from '@/platform/share';
import { C } from '@/theme';

/** Bloque con título dentro del perfil. */
export function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const normUsername = (v: string) => v.trim().replace(/^@/, '').toLowerCase();
const fmtDay = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
};

/** Debounce simple para búsquedas y verificaciones en vivo. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------- usuario

function UsernameEditor({ me }: { me: Me }) {
  const [value, setValue] = useState(me.username);
  const [check, setCheck] = useState<{ for: string; res: CheckUsername | null; err?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const norm = normUsername(value);
  const deb = useDebounced(norm, 400);
  const changed = norm !== me.username;

  useEffect(() => setValue(me.username), [me.username]);

  useEffect(() => {
    if (!deb || deb === me.username) {
      setCheck(null);
      return;
    }
    const ctrl = new AbortController();
    checkUsername(deb, ctrl.signal).then(
      (res) => setCheck({ for: deb, res }),
      (e: unknown) => {
        if (!ctrl.signal.aborted) setCheck({ for: deb, res: null, err: errorMessage(e) });
      },
    );
    return () => ctrl.abort();
  }, [deb, me.username]);

  const current = check && check.for === norm ? check : null;
  const ok = !!current?.res?.valid && !!current.res.available;
  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await updateMe({ username: norm });
      toast('Nombre de usuario actualizado');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  let status: ReactNode = null;
  if (changed && norm) {
    if (!current) status = <Hint>Verificando…</Hint>;
    else if (current.err) status = <Hint tone="bad">{current.err}</Hint>;
    else if (ok) status = <Hint tone="ok">@{current.res!.username} está disponible.</Hint>;
    else status = <Hint tone="bad">{current.res?.message ?? 'Ese nombre no está disponible.'}</Hint>;
  }

  return (
    <View style={styles.stack}>
      <View style={styles.inline}>
        <TextField
          prefix="@"
          value={value}
          onChangeText={(t) => {
            setValue(t);
            setErr(null);
          }}
          maxLength={21}
          accessibilityLabel="Nombre de usuario"
          onSubmitEditing={() => ok && void save()}
        />
        <SmallButton title="Guardar" onPress={save} disabled={!changed || !ok} busy={saving} />
      </View>
      {status}
      {err ? <Hint tone="bad">{err}</Hint> : null}
      <Hint>Entre 3 y 20 caracteres: minúsculas, números, punto y guion bajo. No puede empezar ni terminar con punto. Es lo que aparece en los rankings.</Hint>
    </View>
  );
}

// ---------------------------------------------------------------- país

function CountryPicker({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const all = useMemo(sortedCountries, []);
  const f = filter
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  const list = f
    ? all.filter(
        (c) =>
          c.code.toLowerCase() === f ||
          c.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .includes(f),
      )
    : all;
  const lockedUntil = me.nextCountryChangeAt && Date.parse(me.nextCountryChangeAt) > Date.now() ? me.nextCountryChangeAt : null;

  const pick = async (code: string) => {
    setOpen(false);
    if (code === me.country) return;
    setSaving(true);
    setErr(null);
    try {
      await updateMe({ country: code });
      toast(`País: ${countryName(code)}`);
    } catch (e) {
      const next = isApiError(e) && typeof e.body.nextCountryChangeAt === 'string' ? e.body.nextCountryChangeAt : null;
      setErr(errorMessage(e) + (next ? ` Podrás cambiarlo el ${fmtDay(next)}.` : ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.inline}>
        <Text style={[styles.value, styles.flex1]}>{me.country ? `${flag(me.country)} ${countryName(me.country)}` : 'Sin país'}</Text>
        <SmallButton title="Cambiar" kind="ghost" onPress={() => setOpen(true)} disabled={!!lockedUntil} busy={saving} />
      </View>
      {err ? <Hint tone="bad">{err}</Hint> : null}
      <Hint>
        {lockedUntil
          ? `Podrás cambiarlo de nuevo el ${fmtDay(lockedUntil)}.`
          : 'Define en qué ranking de país apareces. Puedes cambiarlo una vez cada 30 días.'}
      </Hint>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Cerrar" />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Elige tu país</Text>
            <View style={styles.inline}>
              <TextField value={filter} onChangeText={setFilter} placeholder="Buscar país" accessibilityLabel="Buscar país" autoFocus />
            </View>
            <FlatList
              data={list}
              keyExtractor={(c) => c.code}
              style={styles.sheetList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void pick(item.code)}
                  style={({ pressed }) => [styles.countryRow, item.code === me.country && styles.countryOn, pressed && styles.pressed]}
                >
                  <Text style={styles.countryT}>
                    {flag(item.code)} {item.name}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>No hay países con ese nombre.</Text>}
            />
            <SmallButton title="Cancelar" kind="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------- quién te invitó

/** "@usuario" con la parte que calza con la búsqueda resaltada. */
function MatchedName({ username, query }: { username: string; query: string }) {
  const r = matchRange(username, query);
  if (!r) return <>@{username}</>;
  return (
    <>
      @{username.slice(0, r[0])}
      <Text style={styles.match}>{username.slice(r[0], r[1])}</Text>
      {username.slice(r[1])}
    </>
  );
}

/**
 * Búsqueda en vivo (con debounce) contra GET /users/search: el texto puede calzar en
 * cualquier parte del usuario y la API pone primero los que empiezan con él.
 * `results` es null mientras no hay nada escrito.
 */
function useUserSearch(text: string, excludeId: string) {
  const key = searchKey(text);
  const deb = useDebounced(key, 250);
  const [state, setState] = useState<{ key: string; users: SearchUser[]; full: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!deb) {
      setState(null);
      setErr(null);
      return;
    }
    const ctrl = new AbortController();
    searchUsers(deb, ctrl.signal).then(
      (r) => {
        setState({ key: deb, users: r.users.filter((u) => u.id !== excludeId), full: r.users.length >= SEARCH_LIMIT });
        setErr(null);
      },
      (e: unknown) => !ctrl.signal.aborted && setErr(errorMessage(e)),
    );
    return () => ctrl.abort();
  }, [deb, excludeId]);

  const results = key && state ? state.users : null;
  // buscando: lo escrito todavía no tiene respuesta
  const pending = !!key && !err && state?.key !== key;
  const setResults = (fn: (us: SearchUser[]) => SearchUser[]) => setState((s) => (s ? { ...s, users: fn(s.users) } : s));
  return { key, results, pending, err, setResults, more: !!state?.full };
}

function InviterEditor({ me }: { me: Me }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [picked, setPicked] = useState<SearchUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const invalidate = useInvalidate();
  const search = useUserSearch(value, me.id);

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await setInviter(picked.username);
      setDone(`¡Listo! +1 corazón para @${r.inviter.username}`);
      setPicked(null);
      await fetchMe().catch(() => {});
      invalidate('following', 'lb', 'profile');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (me.invitedBy) {
    return (
      <View style={styles.stack}>
        {done ? <Hint tone="ok">{done}</Hint> : null}
        <Text style={styles.value}>
          Te invitó{' '}
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/u/[username]', params: { username: me.invitedBy!.username } })}
          >
            @{me.invitedBy.username}
          </Text>
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      <Hint>
        Si alguien te invitó, empieza a escribir su nombre y elígelo de la lista: gana +1 corazón y quedan siguiéndose. Solo se
        puede indicar una vez.
      </Hint>
      <View style={styles.inline}>
        <TextField
          prefix="🔍"
          value={value}
          onChangeText={setValue}
          placeholder="Busca a quien te invitó"
          maxLength={40}
          accessibilityLabel="Buscar a quien te invitó"
        />
      </View>
      {search.err ? <Hint tone="bad">{search.err}</Hint> : null}
      {search.pending && !search.results ? <Hint>Buscando…</Hint> : null}
      {search.results ? (
        search.results.length ? (
          <>
            <View style={[styles.userList, search.pending && styles.stale]}>
              {search.results.map((u) => (
                <Pressable
                  key={u.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Elegir a ${u.username} como quien te invitó`}
                  onPress={() => {
                    setErr(null);
                    setPicked(u);
                  }}
                  style={({ pressed }) => [styles.userRow, pressed && styles.pressed]}
                >
                  <Text style={[styles.userT, styles.flex1]} numberOfLines={1}>
                    {flag(u.country)} <MatchedName username={u.username} query={search.key} />
                  </Text>
                  <Text style={styles.pickT}>Elegir</Text>
                </Pressable>
              ))}
            </View>
            {search.more ? <Hint>Hay más usuarios: escribe más letras para encontrarlo.</Hint> : null}
          </>
        ) : search.pending ? (
          <Hint>Buscando…</Hint>
        ) : (
          <Hint>No hemos encontrado usuarios con "{value.trim()}".</Hint>
        )
      ) : null}
      <ConfirmModal
        visible={!!picked}
        title={picked ? `¿Te invitó @${picked.username}?` : ''}
        message="Ganará +1 corazón y quedarán siguiéndose. Solo se puede indicar una vez y no se puede cambiar."
        confirmText="Sí, me invitó"
        busy={saving}
        error={err}
        onConfirm={() => void save()}
        onCancel={() => setPicked(null)}
      />
    </View>
  );
}

// ---------------------------------------------------------------- invitar

function InviteBox({ me }: { me: Me }) {
  const copy = async () => {
    const ok = await share.copyText('@' + me.username);
    toast(ok ? 'Usuario copiado' : 'No se pudo copiar');
  };
  const invite = async () => notifyShare(await share.shareText(inviteText(me.username), SITE_URL));
  return (
    <View style={styles.stack}>
      <View style={styles.heartsRow}>
        <Hearts lives={me.maxLives} max={MAX_LIVES_CAP} size={24} />
      </View>
      <Text style={[styles.value, styles.centerT]}>
        Juegas con {me.maxLives} corazones · {me.invitedCount === 1 ? '1 invitado' : `${me.invitedCount} invitados`}
      </Text>
      <Hint>
        Empiezas con {BASE_LIVES} corazones y ganas +1 por cada amigo que te ponga en "¿Quién te invitó?", hasta {MAX_LIVES_CAP}.
      </Hint>
      <View style={styles.inviteUser}>
        <Text style={styles.value}>
          Tu usuario para invitar: <Text style={styles.strong}>@{me.username}</Text>
        </Text>
      </View>
      <View style={styles.inlineCenter}>
        <SmallButton title="Copiar usuario" kind="ghost" onPress={copy} />
        <SmallButton title="Invitar amigos" onPress={invite} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- seguir

function UserRow({
  user,
  query = '',
  following,
  onToggle,
  busy,
}: {
  user: { id: string; username: string; country: string | null };
  query?: string;
  following: boolean;
  onToggle: () => void;
  busy: boolean;
}) {
  const router = useRouter();
  return (
    <View style={styles.userRow}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Ver perfil de ${user.username}`}
        style={styles.flex1}
        onPress={() => router.push({ pathname: '/u/[username]', params: { username: user.username } })}
      >
        <Text style={styles.userT} numberOfLines={1}>
          {flag(user.country)} <MatchedName username={user.username} query={query} />
        </Text>
      </Pressable>
      <SmallButton
        title={following ? 'Siguiendo ✓' : 'Seguir'}
        kind={following ? 'ghost' : 'primary'}
        accessibilityLabel={following ? `Dejar de seguir a ${user.username}` : `Seguir a ${user.username}`}
        onPress={onToggle}
        busy={busy}
      />
    </View>
  );
}

function Follows({ me }: { me: Me }) {
  const [q, setQ] = useState('');
  const search = useUserSearch(q, me.id);
  const results = search.results;
  const [busyId, setBusyId] = useState<string | null>(null);
  const following = useFollowing();
  const invalidate = useInvalidate();
  const followingIds = new Set(following.data?.users.map((u) => u.id) ?? []);

  const toggle = async (u: { id: string }, isF: boolean) => {
    setBusyId(u.id);
    try {
      if (isF) await unfollow(u.id);
      else await follow(u.id);
      search.setResults((rs) => rs.map((r) => (r.id === u.id ? { ...r, isFollowing: !isF } : r)));
      invalidate('following', 'lb', 'profile', 'me');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.inline}>
        <TextField prefix="🔍" value={q} onChangeText={setQ} placeholder="Buscar usuario" accessibilityLabel="Buscar usuario" maxLength={40} />
      </View>
      {search.err ? <Hint tone="bad">{search.err}</Hint> : null}
      {search.pending && !results ? <Hint>Buscando…</Hint> : null}
      {results ? (
        results.length ? (
          <View style={[styles.userList, search.pending && styles.stale]}>
            {results.map((u) => {
              const isF = u.isFollowing ?? followingIds.has(u.id);
              return (
                <UserRow
                  key={u.id}
                  user={u}
                  query={search.key}
                  following={isF}
                  busy={busyId === u.id}
                  onToggle={() => void toggle(u, isF)}
                />
              );
            })}
          </View>
        ) : (
          search.pending ? (
            <Hint>Buscando…</Hint>
          ) : (
            <Hint>No hemos encontrado usuarios con "{q.trim()}".</Hint>
          )
        )
      ) : null}

      <Text style={styles.subTitle}>Siguiendo{following.data ? ` (${following.data.users.length})` : ''}</Text>
      {following.isPending ? (
        <ActivityIndicator color={C.text} />
      ) : following.isError ? (
        <Hint tone="bad">{errorMessage(following.error)}</Hint>
      ) : following.data.users.length === 0 ? (
        <Hint>Todavía no sigues a nadie. Busca a tus amigos para verlos en el ranking de Amigos.</Hint>
      ) : (
        <View style={styles.userList}>
          {following.data.users.map((u) => (
            <UserRow key={u.id} user={u} following busy={busyId === u.id} onToggle={() => void toggle(u, true)} />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- pantalla

/**
 * Perfil. Para invitados: login y datos locales. Con sesión: usuario, país, "¿Quién te
 * invitó?", corazones, invitar, seguir, cerrar sesión y eliminar cuenta. "Ver tutorial de
 * nuevo" está siempre.
 */
export function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const viewer = useViewer();
  const qc = useQueryClient();
  useMeRefresh();
  const best = loadBest();
  const games = loadHist().length;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const me = viewer.user;

  const doLogout = async () => {
    await logout();
    qc.clear();
    toast('Sesión cerrada');
  };
  const doDelete = async () => {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deleteAccount();
      qc.clear();
      setConfirmDelete(false);
      toast('Tu cuenta fue eliminada');
    } catch (e) {
      setDeleteErr(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {features.accounts ? null : (
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={10} onPress={back} style={styles.backBtn}>
            <Text style={styles.backT}>‹ Volver</Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom + tabSpace, paddingTop: features.accounts ? 24 : 8 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatar}>
          <ProfileIcon size={34} />
        </View>
        {features.accounts && viewer.loggedIn ? (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {me ? '@' + me.username : 'Perfil'}
            </Text>
            {me?.country ? (
              <Text style={styles.sub}>
                {flag(me.country)} {countryName(me.country)}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.title} accessibilityRole="header">
            Perfil
          </Text>
        )}

        {!features.accounts ? (
          <Text style={styles.muted}>Estás jugando como invitado.</Text>
        ) : !viewer.loggedIn ? (
          <ProfileSection title="Cuenta">
            <Text style={styles.muted}>
              Estás jugando como invitado. Inicia sesión para dejar tus puntajes en el ranking, elegir tu nombre de usuario, seguir
              a tus amigos y ganar corazones invitándolos.
            </Text>
            <LoginOptions />
          </ProfileSection>
        ) : !me ? (
          <ActivityIndicator color={C.text} />
        ) : (
          <>
            <ProfileSection title="Nombre de usuario">
              <UsernameEditor me={me} />
            </ProfileSection>
            <ProfileSection title="País">
              <CountryPicker me={me} />
            </ProfileSection>
            <ProfileSection title="¿Quién te invitó?">
              <InviterEditor me={me} />
            </ProfileSection>
            <ProfileSection title="Invita amigos">
              <InviteBox me={me} />
            </ProfileSection>
            <ProfileSection title="Seguir">
              <Follows me={me} />
            </ProfileSection>
          </>
        )}

        <ProfileSection title="En este dispositivo">
          <View style={styles.stats}>
            <RecordPill best={best} />
            <Text style={styles.muted}>
              {games === 0 ? 'Todavía no hay partidas.' : games === 1 ? '1 partida guardada' : `${games} partidas guardadas`}
            </Text>
          </View>
        </ProfileSection>

        <ProfileSection title="Ayuda">
          {/* si ya vio los dos tutoriales, repasa el completo (básico y luego avanzado); si no, el básico */}
          <GhostButton title="Ver tutorial de nuevo" onPress={() => router.push({ pathname: '/como-jugar', params: { nivel: replayView() } })} />
        </ProfileSection>

        {features.accounts && viewer.loggedIn ? (
          <ProfileSection title="Sesión">
            <View style={styles.inlineCenter}>
              <SmallButton title="Cerrar sesión" kind="ghost" onPress={() => void doLogout()} />
              <SmallButton title="Eliminar cuenta" kind="danger" onPress={() => setConfirmDelete(true)} />
            </View>
          </ProfileSection>
        ) : null}

        <LegalLinks />
      </ScrollView>

      <ConfirmModal
        visible={confirmDelete}
        title="¿Eliminar tu cuenta?"
        message="Se borran tu usuario, tus partidas, tus puntajes en los rankings y a quién sigues. No se puede deshacer. Tu historial en este dispositivo se mantiene."
        confirmText="Eliminar"
        danger
        busy={deleting}
        error={deleteErr}
        onConfirm={() => void doDelete()}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteErr(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { height: 52, justifyContent: 'center', paddingHorizontal: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 6 },
  backT: { color: C.accent, fontSize: 17, fontWeight: '600' },
  content: { alignItems: 'center', gap: 16, paddingHorizontal: 20 },
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
  title: { color: C.text, fontSize: 28, fontWeight: '800' },
  sub: { color: C.text, opacity: 0.75, fontSize: 15, marginTop: -8 },
  muted: { color: C.text, opacity: 0.65, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  section: { width: '100%', maxWidth: 360, backgroundColor: C.panel, borderRadius: 16, padding: 16, gap: 12, alignItems: 'center' },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: C.text,
    opacity: 0.6,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  subTitle: { alignSelf: 'flex-start', color: C.text, opacity: 0.8, fontSize: 14, fontWeight: '700', marginTop: 4 },
  stats: { alignItems: 'center', gap: 8 },
  stack: { alignSelf: 'stretch', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' },
  flex1: { flex: 1 },
  value: { color: C.text, fontSize: 16 },
  strong: { fontWeight: '800', color: C.accent },
  centerT: { textAlign: 'center' },
  link: { color: C.accent, fontWeight: '700' },
  heartsRow: { alignItems: 'center' },
  inviteUser: { alignItems: 'center', paddingVertical: 4 },
  userList: { backgroundColor: C.bg, borderRadius: 12, overflow: 'hidden' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.rowBorder,
  },
  userT: { color: C.text, fontSize: 15, fontWeight: '600' },
  match: { color: C.accent, fontWeight: '800' },
  pickT: { color: C.accent, fontWeight: '700', fontSize: 14, paddingVertical: 10, paddingHorizontal: 8 },
  stale: { opacity: 0.6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    backgroundColor: C.panel,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: C.panelBorder,
  },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: '800' },
  sheetList: { flexGrow: 0, maxHeight: 420 },
  countryRow: { paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10 },
  countryOn: { backgroundColor: C.accentSoft },
  countryT: { color: C.text, fontSize: 16 },
  pressed: { opacity: 0.6 },
});
