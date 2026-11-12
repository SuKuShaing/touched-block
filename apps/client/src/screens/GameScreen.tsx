import { useFocusEffect, useLocalSearchParams, useNavigation, useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type HostInstance, type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BASE_LIVES,
  DAILY_ATTEMPTS_GUEST,
  MILESTONES,
  START_TIME,
  type Block as EngineBlock,
  type EndReason,
  type GameEvent,
  type GameMods,
  type GameState,
  type TierRef,
  difficultyTime,
  milestoneIndexAt,
  tierRefForTicks,
} from '@tb/engine';
import { useQueryClient } from '@tanstack/react-query';
import { isApiError, warmSession } from '@/api/client';
import { type DailyRunResult, type MissionView, isAccountDaily } from '@/api/daily';
import { useClaimPendingDaily, useDailyStatus, useTodayMissions } from '@/api/dailyHooks';
import { useChallenge, useFetchFriendsWeek, useViewer } from '@/api/hooks';
import { session } from '@/api/session';
import { Block } from '@/components/Block';
import { ChallengeInvite, type InviteState } from '@/components/ChallengePanel';
import { DailyCard } from '@/components/DailyCard';
import { type EndRun, EndPanel } from '@/components/EndPanel';
import { FieldBackground } from '@/components/FieldBackground';
import { Flash, FxLayer, useFxList, useHurtFx } from '@/components/Fx';
import { Header, type PopKind, TimeBar } from '@/components/Hud';
import { InstallCard, useInstallOffer } from '@/components/InstallCard';
import { MissionList } from '@/components/MissionList';
import { NoticeStrip, useNotices } from '@/components/Notice';
import { PrizeCard } from '@/components/PrizeCard';
import { ProfileIcon } from '@/components/ProfileIcon';
import { StageTrack } from '@/components/StageTrack';
import { TierBadge } from '@/components/TierBadge';
import { GhostButton, HistoryList, Logo, MainButton, RecordPill, SoundToggle } from '@/components/ui';
import { features } from '@/config';
import { type CatalogItem, SETTING_KEY } from '@/cosmetics/catalog';
import { tierStepOf } from '@/cosmetics/tiers';
import { endTapReady } from '@/game/endGuard';
import { type EndPrize, endPrize, endStats } from '@/game/endPrize';
import {
  type Notice,
  comboNotice,
  duelStartText,
  friendNotice,
  milestoneNotice,
  modeNotice,
  pickNotice,
  recordNotice,
  streakBreakNotice,
} from '@/game/notices';
import { type PlayArea, areaFor, fieldToArea, rectToArea, stretchArea, tapToField } from '@/game/playArea';
import { NORMAL_RUN, type RunMode, type RunOptions, type RunStartFailure, prepareRun, submitRun } from '@/game/rankedRun';
import { sounds } from '@/game/sounds';
import type { GameResult } from '@/game/types';
import { useGameRunner } from '@/game/useGameRunner';
import {
  CHALLENGE_PARAM,
  challengeOfferVisible,
  clearPendingChallenge,
  isFatalChallengeReason,
  loadPendingChallenge,
  readChallengeParam,
  savePendingChallenge,
} from '@/lib/challenge';
import {
  DAILY_PARAM,
  anotherAttemptText,
  dailyVisible,
  homeCard,
  loadDailyLocal,
  localStreakBest,
  localUsed,
  markDailyStarted,
  readDailyParam,
  recordDailyFinish,
  recordDailyGuestResult,
  useToday,
} from '@/lib/daily';
import { type HistEntry, loadBest, loadHist, recordRun } from '@/lib/history';
import { newlyCompleted } from '@/lib/missions';
import { consumeStartRequest, dueOnboarding, onNewVisit, registerVisit, visitCount } from '@/lib/onboarding';
import { setPlaying } from '@/lib/playing';
import { updateSettings } from '@/lib/settings';
import { recordStats, useLocalStats } from '@/lib/stats';
import {
  type FriendScore,
  challengeTrackStart,
  friendAhead,
  friendAheadText,
  friendTargets,
  milestoneProgress,
  passedCount,
  recordGapText,
} from '@/lib/stagePath';
import { useTabBarSpace } from '@/lib/tabBar';
import { useFieldTaps } from '@/platform/fieldTaps';
import { C, LOW_TIME } from '@/theme';

interface EndInfo {
  /** Cambia en cada partida (reinicia la animación del camino). */
  id: number;
  /** Partida normal (récord e historial) o de reto (duel, daily: no los tocan, D6). */
  normal: boolean;
  title: string;
  killed: number;
  missed: number;
  bestStreak: number;
  durationTicks: number;
  /** Modificadores de la partida (entonces la duración no dice en qué etapa iba). */
  mods: GameMods | null;
  /** Su partida más larga antes de esta (ticks; 0 si es la primera): el máximo entre el dispositivo y la cuenta. */
  prevBestTicks: number;
  /** "Te faltaron N bloques para tu récord" (null si fue récord, si no había o si no es normal). */
  recordGap: string | null;
  /** "Estás a N bloques de @x esta semana" (null sin sesión, sin datos, si nadie está arriba o si no es normal). */
  friendGap: string | null;
  /** Insignia nueva y premios desbloqueados por esta partida (null si nada). */
  prize: EndPrize | null;
  /** Reto diario: fecha del reto e intentos que quedan (null en los otros modos). */
  daily: { date: string; left: number } | null;
  /** Misiones de hoy al empezar la partida (para mostrar las que cumplió en ella). */
  missionsBefore: MissionView[] | null;
  /** De quién eran esas misiones (`useViewer().key`): si después cambia la sesión, no se comparan. */
  missionsViewer: string;
}

/** Partida del reto diario en curso: su fecha e intentos que quedan después de empezarla. */
interface DailyRun {
  date: string;
  left: number;
}

/** Lo que se sigue durante una partida para los avisos de la franja. */
interface RunTrack {
  /** milestoneIndexAt en el último cuadro. */
  milestone: number;
  /** Récord local al empezar (para "¡Nuevo récord!"; 0 en los retos: sin aviso). */
  bestAtStart: number;
  recordDone: boolean;
  /** Ranking semanal de amigos (si llegó). */
  lb: { entries: FriendScore[]; meId: string | null; myWeek: number } | null;
  /** Amigos por superar, de menor a mayor, y cuántos ya se superaron. */
  friends: FriendScore[];
  friendsPassed: number;
  /** Avisos que dejaron los eventos de este cuadro (combo, racha cortada). */
  pending: Notice[];
}

const emptyTrack = (): RunTrack => ({ milestone: 0, bestAtStart: 0, recordDone: false, lb: null, friends: [], friendsPassed: 0, pending: [] });

/** Centro de un bloque en px del área de juego. */
const centerOf = (b: EngineBlock, a: PlayArea) => ({ cx: (b.x + b.w / 2) * a.sx, cy: (b.y + b.h / 2) * a.sy });

function endTitle(isRecord: boolean, reason: EndReason) {
  if (isRecord) return '¡Nuevo récord!';
  return reason === 'vidas' ? '¡Sin vidas!' : '¡Se acabó el tiempo!';
}

/** Insignia de este dispositivo (sin sesión), como la calcula el servidor: nada sin partidas. */
const localTier = (s: { runs: number; bestTicks: number }): TierRef | null => (s.runs > 0 ? tierRefForTicks(s.bestTicks) : null);

/** Error al empezar un reto, y para qué partida era (para mostrarlo donde corresponde). */
type StartFail = RunStartFailure & { challenge: string | null };

/**
 * Pantalla principal: marcador, campo de juego y la pantalla de inicio / fin encima.
 *
 * Modos de partida: `startGame(opts)` empieza una partida normal (`NORMAL_RUN`, por defecto), un
 * reto a un amigo (`{ mode: 'duel', challenge? }`) o el reto diario (`{ mode: 'daily', date }`).
 * Los retos usan el campo del servidor dibujado con escala única (`game/playArea.ts`) y no tocan
 * el récord ni el historial local (D6). Si un reto no se puede empezar, el motivo queda en
 * `startFail` y se muestra en el inicio o en la pantalla final.
 */
export function GameScreen() {
  const router = useRouter();
  const rootNav = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const viewer = useViewer();
  const localStats = useLocalStats();
  const fetchFriendsWeek = useFetchFriendsWeek();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ reto?: string | string[]; diario?: string | string[] }>();

  const fieldRef = useRef<HostInstance>(null);
  const [field, setField] = useState({ w: 0, h: 0 });
  const fieldNow = useRef(field);
  fieldNow.current = field;

  const fxl = useFxList();
  const hurt = useHurtFx();
  const notices = useNotices();
  const [pop, setPop] = useState<{ key: number; kind: PopKind }>({ key: 0, kind: 'gain' });
  const [streakPop, setStreakPop] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [hist, setHist] = useState<HistEntry[]>(loadHist);
  const [end, setEnd] = useState<EndInfo | null>(null);
  const [endRun, setEndRun] = useState<EndRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [startFail, setStartFail] = useState<StartFail | null>(null);
  const startingRef = useRef(false);
  // modo de la partida en curso (semilla del servidor o local; normal o reto)
  const runMode = useRef<RunMode>({ kind: 'local', reason: 'off' });
  const runSeq = useRef(0);
  const track = useRef<RunTrack>(emptyTrack());
  // cuándo terminó la última partida (pausa contra toques accidentales en la pantalla final)
  const endedAt = useRef<number | null>(null);

  // Área de juego: dónde se dibuja el campo lógico del motor dentro del campo de la pantalla.
  // Normal: pantalla completa (sx/sy ≠ 1 solo si cambia de tamaño en plena partida). Retos:
  // rectángulo centrado con escala única; los toques fuera de él se ignoran.
  const letterbox = useRef(false);
  const area = useRef<PlayArea>(stretchArea(0, 0, 1, 1));

  // ---- reto a un amigo por enlace (?reto=CODIGO) ----
  const paramCode = readChallengeParam(params);
  // el código queda guardado mientras tanto (tutorial de la 1.ª visita, recargas)
  const [inviteCode, setInviteCode] = useState<string | null>(() => paramCode ?? loadPendingChallenge());
  const inviteQ = useChallenge(inviteCode);
  // llegó por un enlace de reto: "Retar a un amigo" se ofrece aunque sea la 1.ª visita
  const [arrivedByLink, setArrivedByLink] = useState(() => inviteCode !== null);
  useEffect(() => {
    if (!paramCode) return;
    savePendingChallenge(paramCode);
    setInviteCode(paramCode);
    setArrivedByLink(true);
  }, [paramCode]);
  const paramCodeRef = useRef(paramCode);
  paramCodeRef.current = paramCode;
  /** Ya se usó (o se descartó) el enlace: se olvida, y se saca de la URL para que recargar no lo repita. */
  const dropInvite = useCallback(() => {
    setInviteCode(null);
    clearPendingChallenge();
    if (paramCodeRef.current) {
      try {
        router.setParams({ [CHALLENGE_PARAM]: undefined });
      } catch {}
    }
  }, [router]);

  // ---- reto diario y misiones (fases 4 y 5) ----
  const today = useToday();
  // se presentan desde la 2.ª visita (la 1.ª es solo para jugar)
  const [visits, setVisits] = useState(() => {
    registerVisit();
    return visitCount();
  });
  useEffect(() => onNewVisit(() => setVisits(visitCount())), []);
  // Enlace ?diario=1: la tarjeta del reto se ve aunque sea la 1.ª visita y, apenas se pueda (después
  // del tutorial, si toca), se abre su hoja de reglas. El intento solo se gasta con "Empezar".
  const paramDaily = readDailyParam(params);
  const [dailyLinked, setDailyLinked] = useState(paramDaily);
  const dailyLinkPending = useRef(paramDaily);
  useEffect(() => {
    if (!paramDaily) return;
    setDailyLinked(true);
    dailyLinkPending.current = true;
  }, [paramDaily]);
  const [openRules, setOpenRules] = useState(false);
  const showDaily = features.accounts && (dailyVisible(visits, features.accounts) || dailyLinked);
  const missionsOn = dailyVisible(visits, features.accounts);
  const { status: todayDaily } = useDailyStatus(today, showDaily);
  const { missions } = useTodayMissions(today, missionsOn);
  const missionsRef = useRef(missions);
  missionsRef.current = missions;
  const missionsBefore = useRef<MissionView[] | null>(null);
  const viewerKeyRef = useRef(viewer.key);
  viewerKeyRef.current = viewer.key;
  const missionsViewer = useRef(viewer.key);
  const installOffer = useInstallOffer();
  const [startingDaily, setStartingDaily] = useState(false);
  // reto diario en curso (fecha e intentos que quedan)
  const dailyRun = useRef<DailyRun | null>(null);

  /** Abre la hoja de reglas del enlace ?diario=1 (una vez) y saca el parámetro de la URL. */
  const openDailyLink = useCallback(() => {
    if (!dailyLinkPending.current) return;
    dailyLinkPending.current = false;
    setOpenRules(true);
    try {
      router.setParams({ [DAILY_PARAM]: undefined });
    } catch {}
  }, [router]);

  const invalidateDaily = useCallback(
    (keys: string[]) => {
      for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
    },
    [qc],
  );

  const timePop = (kind: PopKind) => setPop((p) => ({ key: p.key + 1, kind }));

  const onEvents = (evs: GameEvent[], _s: GameState) => {
    const a = area.current;
    for (const ev of evs) {
      switch (ev.type) {
        case 'hit': {
          const b = ev.block;
          // tono que sube con cada toque (el paquete pone el tope)
          sounds.play('hit', b.total - b.left);
          break;
        }
        case 'kill': {
          const b = ev.block;
          const { cx, cy } = centerOf(b, a);
          timePop('gain');
          sounds.play('kill');
          fxl.add({ kind: 'burst', x: cx, y: cy, color: b.color });
          fxl.add({ kind: 'float', x: cx, y: cy, text: `+${ev.gain}s` });
          break;
        }
        case 'trap': {
          const { cx, cy } = centerOf(ev.block, a);
          timePop('hurt');
          fxl.add({ kind: 'burst', x: cx, y: cy, color: C.bad, count: 24 });
          fxl.add({ kind: 'float', x: cx, y: cy, text: `−${ev.penalty}s`, neg: true });
          hurt.trigger();
          sounds.play('trap');
          break;
        }
        case 'heal': {
          const { cx, cy } = centerOf(ev.block, a);
          fxl.add({ kind: 'burst', x: cx, y: cy, color: ev.block.color, count: 20 });
          fxl.add({ kind: 'float', x: cx, y: cy, text: '+1 ♥' });
          sounds.play('heal');
          break;
        }
        case 'expire':
        case 'heartGone':
        case 'trapGone': {
          const b = ev.block;
          fxl.add({ kind: 'ghost', block: { ...rectToArea(a, b), label: ev.type === 'expire' ? '✕' : '', color: b.color } });
          if (ev.type === 'expire') {
            const { cx, cy } = centerOf(b, a);
            timePop('hurt');
            fxl.add({ kind: 'float', x: cx, y: cy, text: `−${ev.penalty}s`, neg: true });
            sounds.play('expire');
          }
          break;
        }
        case 'miss': {
          const p = fieldToArea(a, ev.x, ev.y);
          fxl.add({ kind: 'miss', x: p.x, y: p.y });
          hurt.trigger();
          sounds.play('miss');
          break;
        }
        case 'combo':
          // "+1s · ¡Combo ×3!" en la franja de avisos (fuera del campo)
          setStreakPop((k) => k + 1);
          track.current.pending.push(comboNotice(ev.streak, ev.bonus));
          sounds.play('combo', ev.bonus);
          break;
        case 'comboBreak':
          // solo si la racha alcanzó a dar premio
          if (ev.streak >= 3) track.current.pending.push(streakBreakNotice(ev.streak, ev.earned));
          break;
        case 'end':
          sounds.play('end');
          break;
      }
    }
  };

  // Avisos de la franja: un solo aviso a la vez; si coinciden, el más importante.
  const onFrame = (s: GameState) => {
    const t = track.current;
    const cands = t.pending;
    t.pending = [];
    // con modificadores (startAt) los hitos siguen a la dificultad, no a los segundos jugados
    const idx = milestoneIndexAt(difficultyTime(s));
    if (idx > t.milestone) cands.push(milestoneNotice(MILESTONES[idx - 1]));
    t.milestone = idx;
    if (!t.recordDone && t.bestAtStart > 0 && s.killed > t.bestAtStart) {
      t.recordDone = true;
      cands.push(recordNotice());
    }
    const passed = passedCount(t.friends, s.killed);
    if (passed > t.friendsPassed) {
      cands.push(friendNotice(t.friends[passed - 1].username));
      t.friendsPassed = passed;
    }
    const n = pickNotice(cands);
    if (n && notices.offer(n) && n.kind === 'milestone') sounds.play('milestone');
  };

  const onEnd = (r: GameResult) => {
    notices.clear();
    const mode = runMode.current;
    const normal = mode.kind === 'local' || mode.mode === 'normal';
    let finish: EndRun['finish'] = null;
    if (mode.kind === 'server') {
      finish = submitRun(mode, r);
      finish.catch(() => {}); // el error se muestra en EndPanel
    }
    const id = ++runSeq.current;
    // reto diario: la partida queda en tb_daily1 (racha y misiones del invitado, partida por reclamar)
    const rd = mode.kind === 'server' && mode.mode === 'daily' ? dailyRun.current : null;
    const dailyBestBefore = localStreakBest(loadDailyLocal());
    if (rd) recordDailyFinish(rd.date, r);
    const dailyBestAfter = localStreakBest(loadDailyLocal());
    if (finish) {
      finish.then(
        (res) => {
          // invitado: dónde habría quedado (para el logro "Mejor resultado en un reto diario")
          if (rd && res.valid && res.daily && !isAccountDaily(res.daily)) recordDailyGuestResult(rd.date, res.daily);
          // misiones (con sesión las calcula el servidor) y, en el reto, su tarjeta y su ranking
          invalidateDaily(rd ? ['missions', 'daily', 'dailyLb'] : ['missions']);
        },
        () => {},
      );
    }
    setEndRun({ id, result: r, mode, finish, ...(rd ? { dailyDate: rd.date } : {}) });
    const me = session.get().user;
    let title = endTitle(false, r.endReason);
    let recordGap: string | null = null;
    let friendGap: string | null = null;
    let stats: ReturnType<typeof recordStats>;
    if (normal) {
      const rec = recordRun(r);
      setBest(rec.best);
      setHist(rec.hist);
      stats = rec.stats;
      title = endTitle(rec.isRecord, r.endReason);
      recordGap = rec.isRecord ? null : recordGapText(r.killed, rec.best);
      const lb = track.current.lb;
      const ahead = lb ? friendAhead(lb.entries, lb.meId, Math.max(r.killed, lb.myWeek)) : null;
      friendGap = ahead ? friendAheadText(ahead) : null;
    } else {
      // retos (D6): ni récord ni historial; sí bloques y partidas para el nivel y los premios
      stats = recordStats(r, { normal: false });
    }
    // premios: estadísticas antes y después (con sesión, el máximo con las de la cuenta, a la que
    // también se suma esta partida si cuenta en ella: jugada con sesión y semilla del servidor)
    // (la racha de días del reto de este dispositivo cuenta para Constancia)
    const es = endStats(stats, me, r, {
      normal,
      countsOnAccount: mode.kind === 'server' && !mode.claimToken,
      dailyBestBefore,
      dailyBestAfter,
    });
    const prize = endPrize(es.before, es.after, { accounts: features.accounts, daily: features.accounts });
    endedAt.current = Date.now();
    setEnd({
      id,
      normal,
      title,
      killed: r.killed,
      missed: r.missed,
      bestStreak: r.bestStreak,
      durationTicks: r.durationTicks,
      mods: r.mods,
      prevBestTicks: es.prevBestTicks,
      recordGap,
      friendGap,
      prize,
      daily: rd ? { date: rd.date, left: rd.left } : null,
      missionsBefore: missionsBefore.current,
      missionsViewer: missionsViewer.current,
    });
  };

  const runner = useGameRunner({ onEvents, onFrame, onEnd });
  const s = runner.state;
  if (field.w > 0) {
    if (s) area.current = areaFor(letterbox.current, field.w, field.h, s.config.fieldW, s.config.fieldH);
    else area.current = stretchArea(field.w, field.h, field.w, field.h);
  }
  const a = area.current;

  const tapsProps = useFieldTaps(fieldRef, (px, py) => {
    // en los retos, un toque fuera del rectángulo de juego se ignora (no cuesta vida)
    const p = tapToField(area.current, px, py);
    if (p) runner.tapAt(p.x, p.y);
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // En web, mientras otra pantalla está encima, esta queda oculta y mide 0×0: se ignora.
    if (width > 0 && height > 0) setField({ w: width, h: height });
    tapsProps.onLayout?.(e);
  };

  const runnerRef = useRef(runner);
  runnerRef.current = runner;
  const clearFx = fxl.clear;
  const clearNotices = notices.clear;
  const offerNotice = notices.offer;
  const pendingStart = useRef<RunOptions | null>(null);
  const friendsSeq = useRef(0);
  const dropInviteRef = useRef(dropInvite);
  dropInviteRef.current = dropInvite;

  const startGame = useCallback(
    async (opts: RunOptions = NORMAL_RUN) => {
      const f = fieldNow.current;
      if (!(f.w > 0 && f.h > 0)) {
        pendingStart.current = opts; // se empieza apenas se mida el campo
        return;
      }
      if (startingRef.current) return;
      pendingStart.current = null;
      const w = Math.round(f.w);
      const h = Math.round(f.h);
      const normal = opts.mode === 'normal';
      // El sonido va dentro del toque (iOS solo habilita el audio durante un gesto del usuario).
      sounds.play('start');
      setStartFail(null);
      // Avisos de esta partida: el récord local de ahora y, con sesión, los puntajes semanales de
      // los amigos (si no llegan, no hay avisos de amigos). En los retos no hay ninguno de los dos.
      track.current = { ...emptyTrack(), bestAtStart: normal ? loadBest() : 0 };
      const seq = ++friendsSeq.current;
      if (normal) {
        void fetchFriendsWeek().then((lb) => {
          if (!lb || seq !== friendsSeq.current) return;
          const t = track.current;
          const entries: FriendScore[] = lb.entries.map((e) => ({ userId: e.userId, username: e.username, killed: e.killed, isMe: e.isMe }));
          const meId = session.get().user?.id ?? null;
          const myWeek = lb.me?.killed ?? 0;
          t.lb = { entries, meId, myWeek };
          t.friends = friendTargets(entries, meId, myWeek);
          // los que esta partida ya superó antes de que llegaran los datos no se avisan
          t.friendsPassed = passedCount(t.friends, runnerRef.current.playing ? (runnerRef.current.state?.killed ?? 0) : 0);
        });
      }
      // Con cuentas: POST /runs (semilla, corazones y, en los retos, el campo y los modificadores).
      startingRef.current = true;
      setStarting(true);
      setStartingDaily(opts.mode === 'daily');
      const prep = await prepareRun(w, h, opts);
      startingRef.current = false;
      setStarting(false);
      setStartingDaily(false);
      if (prep.kind === 'failed') {
        // sin conexión no hay reto: se queda en la pantalla y se dice por qué
        setStartFail({ ...prep, challenge: opts.mode === 'duel' ? (opts.challenge ?? null) : null });
        // ya no quedan intentos (p. ej. jugados en otro dispositivo): la tarjeta se pone al día
        if (prep.mode === 'daily' && prep.reason === 'daily_attempts_exhausted') invalidateDaily(['daily']);
        return;
      }
      runMode.current = prep;
      // misiones de hoy al empezar: al terminar se muestran las que se cumplieron en esta partida
      missionsBefore.current = missionsRef.current;
      missionsViewer.current = viewerKeyRef.current;
      dailyRun.current = null;
      if (prep.kind === 'server' && prep.mode === 'daily' && opts.mode === 'daily') {
        // el intento se gasta al empezar (también en este dispositivo: el invitado tiene 1)
        const date = prep.daily?.date ?? opts.date;
        markDailyStarted(date, { runId: prep.runId, claimToken: prep.claimToken });
        const left = prep.claimToken
          ? Math.max(0, DAILY_ATTEMPTS_GUEST - localUsed(loadDailyLocal(), date))
          : prep.daily
            ? Math.max(0, prep.daily.attemptsMax - prep.daily.attemptsUsed)
            : 0;
        dailyRun.current = { date, left };
      }
      clearFx();
      clearNotices();
      setEnd(null);
      setEndRun(null);
      if (prep.kind === 'server') {
        letterbox.current = prep.mode !== 'normal';
        const mods = prep.mods;
        // con startAt los hitos ya cruzados no se avisan al empezar
        track.current.milestone = milestoneIndexAt(mods?.startAt ?? 0);
        // en la partida normal el campo es el enviado (la respuesta lo repite); en los retos, el del servidor
        runnerRef.current.start({ fieldW: prep.fieldW, fieldH: prep.fieldH, maxLives: prep.maxLives, seed: prep.seed, mods });
        if (prep.mode === 'duel') {
          offerNotice(modeNotice(duelStartText(prep.challenge?.creator ?? null, !prep.created)));
          // el enlace ya se usó: recargar no repite el reto
          if (opts.mode === 'duel' && opts.challenge) dropInviteRef.current();
        } else if (prep.mode === 'daily' && prep.daily) {
          offerNotice(modeNotice(`Reto #${prep.daily.number}${prep.daily.title ? ` · ${prep.daily.title}` : ''}`));
        }
      } else {
        letterbox.current = false;
        runnerRef.current.start({ fieldW: w, fieldH: h, maxLives: BASE_LIVES });
      }
    },
    [clearFx, clearNotices, offerNotice, fetchFriendsWeek, invalidateDaily],
  );

  useEffect(() => {
    if (pendingStart.current && field.w > 0) void startGame(pendingStart.current);
  }, [field, startGame]);

  // Durante la partida se esconden las pestañas (sin toques accidentales).
  useEffect(() => {
    setPlaying(runner.playing || starting);
  }, [runner.playing, starting]);
  useEffect(() => () => setPlaying(false), []);

  // Tutoriales automáticos: el básico en la 1.ª visita y el avanzado en la 3.ª (lib/onboarding.ts).
  const navigation = useNavigation();
  const openDueOnboarding = useCallback(() => {
    // nunca encima de otra pantalla ni en medio de una partida
    if (!navigation.isFocused() || runnerRef.current.playing || startingRef.current) return;
    const level = dueOnboarding();
    if (level) router.push({ pathname: '/como-jugar', params: { nivel: level } });
  }, [router, navigation]);
  useEffect(() => {
    if (!rootNav?.key) return;
    openDueOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootNav?.key]);
  // volver a una pestaña que quedó abierta también puede ser una visita nueva
  useEffect(() => onNewVisit(openDueOnboarding), [openDueOnboarding]);

  // ---- invitación a un reto ----
  const inviteErr = inviteQ.error;
  const inviteFail = startFail && startFail.challenge && startFail.challenge === inviteCode ? startFail : null;
  const inviteDead =
    !features.accounts ||
    (isApiError(inviteErr) && inviteErr.code === 'challenge_not_found') ||
    (!!inviteQ.data && !inviteQ.data.playable) ||
    (!!inviteFail && isFatalChallengeReason(inviteFail.reason));
  const invite: InviteState | null = inviteCode
    ? {
        code: inviteCode,
        view: inviteQ.data,
        loading: inviteQ.isPending && features.accounts,
        error: inviteErr,
        startError: inviteFail ? inviteFail.message : null,
        dead: inviteDead,
        off: !features.accounts,
      }
    : null;
  /** Hay un reto por jugar: el botón principal lo empieza. */
  const inviteActive = !!invite && !invite.dead;
  const inviteRef = useRef<string | null>(null);
  inviteRef.current = inviteActive ? inviteCode : null;

  // "¡Jugar!" en la última slide del onboarding vuelve aquí y empieza la partida (el reto, si se
  // abrió un enlace de reto en la 1.ª visita). Con el enlace ?diario=1 no empieza nada: muestra la
  // tarjeta del reto con su hoja de reglas (el intento solo se gasta con "Empezar"). Sin tutorial
  // pendiente, la hoja se abre apenas se ve el inicio.
  useFocusEffect(
    useCallback(() => {
      if (consumeStartRequest()) {
        if (dailyLinkPending.current) {
          openDailyLink();
          return;
        }
        const code = inviteRef.current;
        void startGame(code ? { mode: 'duel', challenge: code } : NORMAL_RUN);
      } else {
        warmSession();
        if (dailyLinkPending.current && !dueOnboarding()) openDailyLink();
      }
    }, [startGame, openDailyLink]),
  );

  // Al iniciar sesión se reclaman las partidas del reto jugadas como invitado (la que muestra la
  // pantalla final la reclama EndPanel).
  useClaimPendingDaily(endRun && endRun.mode.kind === 'server' && endRun.mode.claimToken ? endRun.mode.runId : null);

  // Resultado del reto con cuenta (al terminar, o al iniciar sesión y reclamar la partida de
  // invitado): los intentos que quedan de verdad para "Otro intento (quedan N)".
  const onDailyResult = useCallback((d: DailyRunResult) => {
    setEnd((e) => (e?.daily && e.daily.date === d.date ? { ...e, daily: { ...e.daily, left: Math.max(0, d.attemptsLeft) } } : e));
  }, []);

  // Solo en desarrollo: el área de juego en __tb_debug (para revisar el escalado de los retos).
  useEffect(() => {
    if (!__DEV__ || typeof window === 'undefined') return;
    const w = window as unknown as { __tb_debug?: Record<string, unknown> };
    if (!w.__tb_debug) return;
    Object.defineProperty(w.__tb_debug, 'area', { get: () => area.current, configurable: true, enumerable: true });
  }, []);

  // Botones de la pantalla final que empiezan otra partida: se ignoran durante una pausa breve
  // después de terminar (quien tocaba bloques rápido podría pulsarlos sin querer).
  const endReady = () => endTapReady(endedAt.current, Date.now());
  const tryPrize = (item: CatalogItem) => {
    if (!endReady()) return;
    updateSettings({ [SETTING_KEY[item.type]]: item.id });
    void startGame(NORMAL_RUN);
  };
  const startFromEnd = (o: RunOptions) => {
    if (endReady()) void startGame(o);
  };
  // "Retar a un amigo" (inicio y pantalla final): desde la 2.ª visita, o si llegó por un enlace de reto
  const challengeOffer = challengeOfferVisible({ accounts: features.accounts, visits, arrivedByLink });

  const seconds = s ? s.timeLeft : START_TIME;
  const low = seconds <= LOW_TIME;
  const barRatio = s ? s.timeLeft / s.barMax : 1;
  // corazones en reposo: los de la cuenta (5 + invitados, máx. 8)
  const restLives = features.accounts && viewer.user ? viewer.user.maxLives : BASE_LIVES;
  const prog = s && runner.playing ? milestoneProgress(difficultyTime(s)) : milestoneProgress(0);
  // camino de etapas de una partida de reto: dónde parte según sus modificadores (null: se omite)
  const stageStart = end && !end.normal ? challengeTrackStart(end.mods) : null;
  // después del reto diario: "Otro intento (quedan N)" mientras queden; sin intentos, "Jugar" (normal)
  const dailyAgain = end?.daily && end.daily.date === today && end.daily.left > 0 ? end.daily : null;
  const mainTitle = starting
    ? 'Preparando…'
    : end
      ? dailyAgain
        ? anotherAttemptText(dailyAgain.left)
        : end.daily
          ? 'Jugar'
          : 'Jugar de nuevo'
      : inviteActive
        ? 'Jugar el reto'
        : 'Jugar';
  // insignia pública: con sesión, la de la cuenta (Me.tier); sin sesión, la de este dispositivo
  const publicTier = features.accounts && viewer.user ? (viewer.user.tier ?? null) : localTier(localStats);
  const publicTierStep = tierStepOf(publicTier);
  // error al empezar el reto diario desde su tarjeta: se muestra en la tarjeta
  const dailyFail = startFail && startFail.mode === 'daily' && !end ? startFail : null;
  // error al empezar un reto que no es el del enlace ("Retar a un amigo", "Revancha", "Otro intento")
  const otherFail = startFail && !inviteFail && !dailyFail ? startFail : null;
  const onMain = () => {
    if (end && !endReady()) return;
    if (!end && inviteActive && inviteCode) void startGame({ mode: 'duel', challenge: inviteCode });
    else if (dailyAgain) void startGame({ mode: 'daily', date: dailyAgain.date });
    else void startGame(NORMAL_RUN);
  };
  // Inicio: como máximo una tarjeta (el reto con sus misiones, o la de instalar). Con el enlace
  // ?diario=1 el reto se muestra aunque no le queden intentos ("Vuelve mañana").
  const homeSlot = homeCard({ daily: showDaily, dailyPlayable: todayDaily.canPlay || dailyLinked, install: installOffer });
  // misiones que se cumplieron en esta partida (comparando con las de antes de empezarla)
  // (si después se inició o cerró sesión, quedan las que se calcularon para quien jugó)
  const [endMissions, setEndMissions] = useState<MissionView[]>([]);
  useEffect(() => {
    if (!end || !missionsOn) setEndMissions([]);
    else if (end.missionsViewer === viewer.key) setEndMissions(newlyCompleted(end.missionsBefore, missions));
  }, [end, missionsOn, missions, viewer.key]);

  return (
    <View style={[styles.app, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Header
        killed={s ? s.killed : 0}
        seconds={seconds}
        lives={s && (runner.playing || end) ? s.lives : restLives}
        maxLives={s && (runner.playing || end) ? s.config.maxLives : restLives}
        popKey={pop.key}
        popKind={pop.kind}
        streak={s && runner.playing ? s.streak : 0}
        streakPop={streakPop}
      />
      <TimeBar ratio={barRatio} low={low} style={styles.bar} />
      <NoticeStrip notice={notices.notice} ratio={prog.ratio} icon={prog.next?.icon ?? null} style={styles.strip} />
      <Animated.View ref={fieldRef} {...tapsProps} style={[styles.field, a.letterbox && styles.fieldBands, hurt.shakeStyle]} onLayout={onLayout}>
        {a.letterbox ? (
          // borde sutil: dentro del rectángulo, tocar fuera de un bloque sí cuesta una vida
          <View pointerEvents="none" style={[styles.areaBorder, { left: a.ox - 1, top: a.oy - 1, width: a.w + 2, height: a.h + 2 }]} />
        ) : null}
        <View pointerEvents="none" style={[styles.area, { left: a.ox, top: a.oy, width: a.w, height: a.h }, a.letterbox && styles.areaInner]}>
          <FieldBackground />
          {s && !s.over
            ? s.blocks.map((b) => {
                const r = rectToArea(a, b);
                return (
                  <Block
                    key={b.id}
                    x={r.x}
                    y={r.y}
                    w={r.w}
                    h={r.h}
                    // números: toques que faltan; operaciones: su operación (el jugador cuenta de memoria)
                    label={b.heart ? '♥' : b.kind === 'num' ? String(b.left) : b.label}
                    color={b.color}
                    red={b.red}
                    life={b.life / b.max}
                    hitKey={b.total - b.left}
                  />
                );
              })
            : null}
          <FxLayer items={fxl.items} />
        </View>
        <Flash style={hurt.flashStyle} />
      </Animated.View>

      {!runner.playing ? (
        <View style={styles.over}>
          <ScrollView
            contentContainerStyle={[styles.overInner, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom + tabSpace }]}
          >
            {end ? (
              <>
                {/* Orden "una más": resultado → premio → camino → Jugar de nuevo (sin desplazarse) → reto/ranking → historial */}
                <Text style={styles.endTitle} accessibilityRole="header">
                  {end.title}
                </Text>
                <Text style={styles.endText}>
                  Destruiste <Text style={styles.endBig}>{end.killed}</Text> bloques{'\n'}Bloques que se escaparon: {end.missed}
                  {'\n'}Mejor racha: <Text style={styles.endStreak}>{end.bestStreak}</Text>
                </Text>
                {end.prize ? (
                  <PrizeCard key={`prize${end.id}`} prize={end.prize} onTry={tryPrize} />
                ) : publicTierStep ? (
                  <View style={styles.tierRow} accessible accessibilityLabel={`Tu insignia: ${publicTierStep.name}`}>
                    <TierBadge tier={publicTierStep} size="sm" />
                    <Text style={styles.tierT}>{publicTierStep.name}</Text>
                  </View>
                ) : null}
                {end.recordGap || end.friendGap ? (
                  <View style={styles.near}>
                    {end.recordGap ? <Text style={styles.nearT}>{end.recordGap}</Text> : null}
                    {end.friendGap ? <Text style={[styles.nearT, styles.nearFriend]}>{end.friendGap}</Text> : null}
                  </View>
                ) : null}
                {end.normal ? (
                  <StageTrack key={`stage${end.id}`} todayTicks={end.durationTicks} prevBestTicks={end.prevBestTicks} />
                ) : stageStart !== null ? (
                  // retos (D6): sin "tu mejor" ni "¡Llegaste a…!"; con startAt, según la dificultad alcanzada
                  <StageTrack key={`stage${end.id}`} challenge todayTicks={end.durationTicks} startAt={stageStart} />
                ) : null}
                {otherFail ? <Text style={styles.fail}>{otherFail.message}</Text> : null}
                <MainButton title={mainTitle} onPress={onMain} />
                {endMissions.length ? <MissionList key={`miss${end.id}`} variant="end" missions={endMissions} /> : null}
                {features.accounts && endRun ? (
                  <EndPanel key={endRun.id} run={endRun} onStart={startFromEnd} onDaily={onDailyResult} challengeOffer={challengeOffer} />
                ) : null}
                <RecordPill best={best} />
                <HistoryList hist={hist} best={best} current={end.normal} />
              </>
            ) : (
              <>
                <Logo />
                {invite ? (
                  <ChallengeInvite invite={invite} onRetry={() => void inviteQ.refetch()} />
                ) : (
                  <Text style={styles.tag}>Toca cada bloque tantas veces como diga su número… o su resultado.</Text>
                )}
                {otherFail ? <Text style={styles.fail}>{otherFail.message}</Text> : null}
                <MainButton title={mainTitle} onPress={onMain} />
                {invite ? (
                  <GhostButton small title={inviteActive ? 'Mejor una partida normal' : 'Cerrar'} onPress={dropInvite} />
                ) : challengeOffer ? (
                  <GhostButton small title="Retar a un amigo" onPress={() => void startGame({ mode: 'duel' })} />
                ) : null}
                {invite ? null : homeSlot === 'daily' ? (
                  <>
                    <DailyCard
                      date={today}
                      onStart={(d) => void startGame({ mode: 'daily', date: d })}
                      busy={starting && startingDaily}
                      error={dailyFail?.message ?? null}
                      openRules={openRules}
                      onRulesOpened={() => setOpenRules(false)}
                    />
                    {missionsOn && missions ? <MissionList missions={missions} /> : null}
                  </>
                ) : homeSlot === 'install' ? (
                  <InstallCard />
                ) : null}
                <RecordPill best={best} />
                <HistoryList hist={hist} best={best} current={false} />
              </>
            )}
          </ScrollView>
          <SoundToggle style={{ ...styles.cornerBtn, left: 14, top: insets.top + 10 }} />
          {features.accounts ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Perfil"
              hitSlop={10}
              onPress={() => router.push('/perfil')}
              style={({ pressed }) => [styles.profileBtn, styles.cornerBtn, { right: 14, top: insets.top + 10 }, pressed && styles.pressed]}
            >
              <ProfileIcon />
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  bar: { marginHorizontal: 16 },
  strip: { marginHorizontal: 16, marginTop: 4 },
  field: { flex: 1, marginTop: 4, overflow: 'hidden', position: 'relative' },
  // retos: lo que sobra alrededor del rectángulo de juego, un poco más oscuro
  fieldBands: { backgroundColor: '#0c0c12' },
  area: { position: 'absolute' },
  areaInner: { backgroundColor: C.bg },
  areaBorder: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 4 },
  over: { ...StyleSheet.absoluteFill, backgroundColor: C.overlay, zIndex: 10 },
  overInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  tag: { color: C.text, fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 8, lineHeight: 25, maxWidth: 300 },
  // con margen a los lados para no quedar bajo los botones de las esquinas (sonido, perfil)
  endTitle: { color: C.text, fontSize: 30, lineHeight: 36, fontWeight: '800', textAlign: 'center', paddingHorizontal: 30 },
  endText: { color: C.text, opacity: 0.85, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  endBig: { fontSize: 40, color: C.accent, fontWeight: '800' },
  endStreak: { color: C.gold, fontWeight: '800' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  tierT: { color: C.text, opacity: 0.8, fontSize: 13, fontWeight: '700' },
  near: { alignItems: 'center', gap: 2, marginTop: -4 },
  nearT: { color: C.text, opacity: 0.85, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  nearFriend: { color: C.accent, opacity: 1, fontWeight: '700' },
  fail: { color: C.bad, fontSize: 14, lineHeight: 19, fontWeight: '700', textAlign: 'center', maxWidth: 320 },
  cornerBtn: { position: 'absolute' },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.94 }] },
});
