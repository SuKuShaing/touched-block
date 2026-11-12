import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/api/client';
import { useDailyLeaderboard } from '@/api/dailyHooks';
import { useLeaderboard, useMyRuns, useViewer } from '@/api/hooks';
import type { LeaderboardEntry, Period, Scope } from '@/api/types';
import { SmallButton } from '@/components/form';
import { LoginOptions } from '@/components/LoginOptions';
import { Segmented } from '@/components/Segmented';
import { TierBadge } from '@/components/TierBadge';
import { features } from '@/config';
import { browserCountry, countryName, flag } from '@/lib/countries';
import { dailyInfo, dailyVisible, playedRuns, todayLine, useToday } from '@/lib/daily';
import { fmtDate } from '@/lib/format';
import { type HistEntry, loadHist } from '@/lib/history';
import { registerVisit, visitCount } from '@/lib/onboarding';
import { PERIOD_EMPTY, PERIODS, periodStart } from '@/lib/periods';
import { useLocalStats } from '@/lib/stats';
import { useTabBarSpace } from '@/lib/tabBar';
import { C } from '@/theme';

type Tab = 'me' | Scope;
/** Ranking general (por período) o el del reto diario de hoy. */
type BoardKind = 'general' | 'daily';

const TABS: { value: Tab; label: string }[] = [
  { value: 'me', label: 'Tú' },
  { value: 'country', label: 'País' },
  { value: 'world', label: 'Mundial' },
  { value: 'friends', label: 'Amigos' },
];

// El reto diario no tiene historial propio ("Tú"): solo mundo, país y amigos.
const DAILY_TABS = TABS.filter((t) => t.value !== 'me');

const BOARDS: { value: BoardKind; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'daily', label: 'Reto de hoy' },
];

function Center({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

function Loading() {
  return (
    <Center>
      <ActivityIndicator color={C.text} />
      <Text style={styles.muted}>Cargando…</Text>
    </Center>
  );
}

function Failed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Center>
      <Text style={styles.muted}>{errorMessage(error)}</Text>
      <SmallButton title="Reintentar" kind="ghost" onPress={onRetry} />
    </Center>
  );
}

/** Fila de historial personal: fecha, destruidos (★ si es el mejor), escapados. */
function RunRow({ date, killed, missed, best, last }: { date: number; killed: number; missed: number; best: boolean; last: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.date}>{fmtDate(date)}</Text>
      <Text style={[styles.k, best && styles.gold]}>
        {best ? <Text style={styles.star}>★ </Text> : null}
        {killed}
      </Text>
      <Text style={styles.m}>{missed} esc.</Text>
    </View>
  );
}

/** "Tú": historial del servidor (con sesión) o el local de este dispositivo (invitado). */
function MyHistory({ period, refreshKey }: { period: Period; refreshKey: number }) {
  const viewer = useViewer();
  const runs = useMyRuns(period, viewer.loggedIn);

  const local = useMemo(() => {
    if (viewer.loggedIn) return null;
    const from = periodStart(period);
    const list = loadHist().filter((g) => g.d >= from);
    let best: HistEntry | null = null;
    for (const g of list) if (!best || g.k > best.k || (g.k === best.k && g.m < best.m)) best = g;
    return { list, best };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loggedIn, period, refreshKey]);

  if (local) {
    return (
      <>
        <Text style={styles.note}>Como invitado, tu historial queda solo en este dispositivo.</Text>
        {local.list.length === 0 ? (
          <Center>
            <Text style={styles.muted}>No tienes partidas {PERIOD_EMPTY[period]}.</Text>
          </Center>
        ) : (
          <View style={styles.list}>
            {local.list.map((g, i) => (
              <RunRow key={g.d + ':' + i} date={g.d} killed={g.k} missed={g.m} best={g === local.best && g.k > 0} last={i === local.list.length - 1} />
            ))}
          </View>
        )}
      </>
    );
  }
  if (runs.isPending) return <Loading />;
  if (runs.isError) return <Failed error={runs.error} onRetry={() => void runs.refetch()} />;
  const list = runs.data.runs;
  if (!list.length)
    return (
      <Center>
        <Text style={styles.muted}>No tienes partidas en el ranking {PERIOD_EMPTY[period]}.</Text>
      </Center>
    );
  return (
    <View style={[styles.list, runs.isPlaceholderData && styles.stale]}>
      {list.map((r, i) => (
        <RunRow key={r.id} date={Date.parse(r.finishedAt)} killed={r.killed} missed={r.missed} best={r.isBest} last={i === list.length - 1} />
      ))}
    </View>
  );
}

function Board({
  entries,
  emptyText,
  onUser,
  stale,
}: {
  entries: LeaderboardEntry[];
  emptyText: string;
  onUser: (u: string) => void;
  stale?: boolean;
}) {
  if (!entries.length)
    return (
      <Center>
        <Text style={styles.muted}>{emptyText}</Text>
      </Center>
    );
  return (
    <View style={[styles.list, stale && styles.stale]}>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.rank, styles.headT]}>#</Text>
        <Text style={[styles.user, styles.headT, styles.flex1]}>Jugador</Text>
        <Text style={[styles.k, styles.headT]}>Bloques</Text>
        <Text style={[styles.m, styles.headT]}>Esc.</Text>
      </View>
      {entries.map((e, i) => (
        <View key={e.userId} style={[styles.row, e.isMe && styles.rowMe, i === entries.length - 1 && styles.rowLast]}>
          <Text style={[styles.rank, e.rank <= 3 && styles.gold]}>{e.rank}</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Ver perfil de ${e.username}`}
            onPress={() => onUser(e.username)}
            style={styles.userBtn}
            hitSlop={4}
          >
            <View style={styles.userRow}>
              <Text style={[styles.user, e.isMe && styles.me]} numberOfLines={1}>
                {flag(e.country)} {e.username}
              </Text>
              <TierBadge tier={e.tier} size="sm" />
            </View>
          </Pressable>
          <Text style={styles.k}>{e.killed}</Text>
          <Text style={styles.m}>{e.missed}</Text>
        </View>
      ))}
    </View>
  );
}

/** Lo que necesita la fila fija: mi posición (o null) y el total del ranking. */
interface MeData {
  me?: { rank: number; killed: number; missed: number } | null;
  total: number;
}

/** Fila fija abajo con mi posición. */
function MeRow({
  data,
  loggedIn,
  onLogin,
  noScoreText,
}: {
  data: MeData | undefined;
  loggedIn: boolean;
  onLogin: () => void;
  /** "Sin puntaje esta semana.", "Todavía no juegas el reto de hoy." */
  noScoreText: string;
}) {
  if (!loggedIn) {
    return (
      <View style={styles.meRow}>
        <Text style={[styles.meT, styles.flex1]}>Inicia sesión para aparecer en el ranking.</Text>
        <SmallButton title="Iniciar sesión" onPress={onLogin} />
      </View>
    );
  }
  if (!data) return null;
  return (
    <View style={styles.meRow} accessibilityLabel="Tu posición">
      <Text style={styles.meCap}>Tu posición</Text>
      {data.me ? (
        <>
          <Text style={styles.meRank}>#{data.me.rank}</Text>
          <Text style={[styles.meT, styles.flex1]}>de {data.total}</Text>
          <Text style={styles.k}>{data.me.killed}</Text>
          <Text style={styles.m}>{data.me.missed} esc.</Text>
        </>
      ) : (
        <Text style={[styles.meT, styles.flex1]}>{noScoreText}</Text>
      )}
    </View>
  );
}

export function RankingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const viewer = useViewer();
  const [tab, setTab] = useState<Tab>('world');
  const [period, setPeriod] = useState<Period>('week');
  const [kind, setKind] = useState<BoardKind>('general');
  const today = useToday();

  // El reto diario se presenta desde la 2.ª visita o la 3.ª partida (la 1.ª es solo para jugar).
  const [visits] = useState(() => {
    registerVisit();
    return visitCount();
  });
  const localStats = useLocalStats();
  const showDaily = dailyVisible({ accounts: features.accounts, visits, runs: playedRuns(localStats.runs, viewer.user) });
  const daily = showDaily && kind === 'daily';
  const pickKind = (k: BoardKind) => {
    setKind(k);
    if (k === 'daily' && tab === 'me') setTab('world');
  };

  const myCountry = viewer.loggedIn ? (viewer.user?.country ?? null) : browserCountry();
  const scope: Scope = tab === 'me' ? 'world' : tab;
  const needsCountry = scope === 'country' && !myCountry;
  const needsLogin = scope === 'friends' && !viewer.loggedIn;
  const canFetch = !needsCountry && !needsLogin;
  const general = useLeaderboard(scope, period, scope === 'country' ? myCountry : null, !daily && tab !== 'me' && canFetch);
  const dailyLb = useDailyLeaderboard(today, scope, scope === 'country' ? myCountry : null, daily && canFetch);
  const lb = daily ? dailyLb : general;
  const todayInfo = useMemo(() => dailyInfo(today), [today]);

  // Al volver a la pestaña se relee el historial local (los datos del servidor se invalidan al
  // terminar cada partida).
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => setFocusTick((t) => t + 1), []));

  const openUser = (u: string) => router.push({ pathname: '/u/[username]', params: { username: u } });
  const goProfile = () => router.navigate('/perfil');

  const emptyText = daily ? 'Nadie ha jugado el reto de hoy en este ranking todavía.' : `Nadie tiene puntaje ${PERIOD_EMPTY[period]} en este ranking.`;
  const noScoreText = daily ? 'Todavía no juegas el reto de hoy.' : `Sin puntaje ${PERIOD_EMPTY[period]}.`;

  let body: ReactNode;
  if (tab === 'me' && !daily) body = <MyHistory period={period} refreshKey={focusTick} />;
  else if (needsLogin)
    body = (
      <Center>
        <Text style={styles.muted}>Inicia sesión para ver el ranking de las personas que sigues.</Text>
        <LoginOptions />
      </Center>
    );
  else if (needsCountry)
    body = (
      <Center>
        <Text style={styles.muted}>
          {viewer.loggedIn ? 'Elige tu país en tu perfil para ver este ranking.' : 'No pudimos detectar tu país.'}
        </Text>
        {viewer.loggedIn ? <SmallButton title="Ir al perfil" kind="ghost" onPress={goProfile} /> : null}
      </Center>
    );
  else if (lb.isPending) body = <Loading />;
  else if (lb.isError) body = <Failed error={lb.error} onRetry={() => void lb.refetch()} />;
  else
    body = (
      <>
        {scope === 'friends' && lb.data.total <= 1 ? (
          <Text style={styles.note}>Sigue a tus amigos desde tu perfil para competir con ellos.</Text>
        ) : null}
        <Board entries={lb.data.entries} emptyText={emptyText} onUser={openUser} stale={lb.isPlaceholderData} />
      </>
    );

  const showMeRow = (daily || tab !== 'me') && !needsLogin && !needsCountry && (lb.isSuccess || !viewer.loggedIn);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: tabSpace }]}>
      <View style={styles.top}>
        <Text style={styles.title} accessibilityRole="header">
          Rankings
        </Text>
        {showDaily ? <Segmented label="Tipo de ranking" chips options={BOARDS} value={kind} onChange={pickKind} /> : null}
        <Segmented label="Ranking" options={daily ? DAILY_TABS : TABS} value={tab} onChange={setTab} />
        {daily ? (
          <Text style={styles.sub}>
            Reto #{todayInfo.number} · {todayLine(todayInfo.title)}
          </Text>
        ) : (
          <Segmented label="Período" chips options={PERIODS} value={period} onChange={setPeriod} />
        )}
        {scope === 'country' && myCountry && (daily || tab !== 'me') ? (
          <Text style={styles.sub}>
            {flag(myCountry)} {countryName(myCountry)}
            {viewer.loggedIn ? '' : ' · según tu navegador'}
          </Text>
        ) : null}
      </View>
      <ScrollView style={styles.flex1} contentContainerStyle={styles.content}>
        {body}
      </ScrollView>
      {showMeRow ? <MeRow data={lb.data} loggedIn={viewer.loggedIn} onLogin={goProfile} noScoreText={noScoreText} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // datos del filtro anterior mientras llegan los nuevos
  stale: { opacity: 0.45 },
  screen: { flex: 1, backgroundColor: C.bg },
  flex1: { flex: 1 },
  top: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 10, width: '100%', maxWidth: 520, alignSelf: 'center' },
  title: { color: C.text, fontSize: 28, fontWeight: '800' },
  sub: { color: C.text, opacity: 0.75, fontSize: 14, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 10, width: '100%', maxWidth: 520, alignSelf: 'center' },
  center: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 8 },
  muted: { color: C.text, opacity: 0.65, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  note: { color: C.text, opacity: 0.55, fontSize: 13, textAlign: 'center' },
  list: { backgroundColor: C.panel, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.rowBorder,
  },
  head: { paddingVertical: 7 },
  headT: { fontSize: 11, opacity: 0.55, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  rowLast: { borderBottomWidth: 0 },
  rowMe: { backgroundColor: C.accentSoft },
  rank: { width: 30, color: C.text, opacity: 0.8, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  userBtn: { flex: 1, minWidth: 0 },
  // nombre + insignia: el nombre se corta antes que la insignia
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  user: { flexShrink: 1, color: C.text, fontSize: 15, fontWeight: '600' },
  me: { color: C.accent },
  date: { flex: 1, color: C.text, opacity: 0.7, fontSize: 14, fontVariant: ['tabular-nums'] },
  k: { color: C.text, fontSize: 17, fontWeight: '800', minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  m: { color: C.text, opacity: 0.5, fontSize: 12, minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  gold: { color: C.gold, opacity: 1 },
  star: { fontSize: 12 },
  meRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: C.panel,
    borderTopWidth: 1,
    borderTopColor: C.accent,
  },
  meCap: { color: C.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  meRank: { color: C.accent, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  meT: { color: C.text, opacity: 0.8, fontSize: 14 },
});
