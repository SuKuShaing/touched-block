import { useFocusEffect, useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type HostInstance, type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_LIVES, START_TIME, type Block as EngineBlock, type EndReason, type GameEvent, type GameState } from '@tb/engine';
import { warmSession } from '@/api/client';
import { useViewer } from '@/api/hooks';
import { Block } from '@/components/Block';
import { type EndRun, EndPanel } from '@/components/EndPanel';
import { Flash, FxLayer, useFxList, useHurtFx } from '@/components/Fx';
import { Header, type PopKind, TimeBar } from '@/components/Hud';
import { ProfileIcon } from '@/components/ProfileIcon';
import { HistoryList, Logo, MainButton, RecordPill } from '@/components/ui';
import { features } from '@/config';
import type { RunResult } from '@/api/types';
import type { GameResult } from '@/game/types';
import { prepareRun, submitRun } from '@/game/rankedRun';
import { useGameRunner } from '@/game/useGameRunner';
import { type HistEntry, loadBest, loadHist, recordRun } from '@/lib/history';
import { consumeStartRequest, onboardingSeen } from '@/lib/onboarding';
import { setPlaying } from '@/lib/playing';
import { useTabBarSpace } from '@/lib/tabBar';
import { fx } from '@/platform/fx';
import { useFieldTaps } from '@/platform/fieldTaps';
import { C, LOW_TIME } from '@/theme';

interface EndInfo {
  title: string;
  killed: number;
  missed: number;
  bestStreak: number;
}

/** Centro de un bloque en px de pantalla. */
const centerOf = (b: EngineBlock, sx: number, sy: number) => ({ cx: (b.x + b.w / 2) * sx, cy: (b.y + b.h / 2) * sy });

/** Arpegio corto y agradable para los premios de combo (más notas cuanto mayor el premio). */
function comboSound(bonus: number) {
  const notes = [660, 830, 990, 1320, 1660].slice(0, Math.min(5, bonus + 2));
  notes.forEach((f, i) => {
    if (i === 0) fx.beep(f, 0.09, 'triangle', 0.06);
    else setTimeout(() => fx.beep(f, 0.09, 'triangle', 0.06), i * 65);
  });
  fx.buzz(25);
}

function endTitle(isRecord: boolean, reason: EndReason) {
  if (isRecord) return '¡Nuevo récord!';
  return reason === 'vidas' ? '¡Sin vidas!' : '¡Se acabó el tiempo!';
}

/** Pantalla principal: marcador, campo de juego y la pantalla de inicio / fin encima. */
export function GameScreen() {
  const router = useRouter();
  const rootNav = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const viewer = useViewer();

  const fieldRef = useRef<HostInstance>(null);
  const [field, setField] = useState({ w: 0, h: 0 });
  const fieldNow = useRef(field);
  fieldNow.current = field;

  const fxl = useFxList();
  const hurt = useHurtFx();
  const [pop, setPop] = useState<{ key: number; kind: PopKind }>({ key: 0, kind: 'gain' });
  const [streakPop, setStreakPop] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [hist, setHist] = useState<HistEntry[]>(loadHist);
  const [end, setEnd] = useState<EndInfo | null>(null);
  const [endRun, setEndRun] = useState<EndRun | null>(null);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  // modo de la partida en curso (semilla del servidor o local)
  const runMode = useRef<EndRun['mode']>({ kind: 'local', reason: 'off' });
  const runSeq = useRef(0);

  // escala px de pantalla / coordenadas lógicas del motor (≠ 1 solo si el campo cambia de tamaño en plena partida)
  const scale = useRef({ sx: 1, sy: 1 });

  const timePop = (kind: PopKind) => setPop((p) => ({ key: p.key + 1, kind }));

  const onEvents = (evs: GameEvent[], _s: GameState) => {
    const { sx, sy } = scale.current;
    const fieldW = fieldNow.current.w;
    // centro del último bloque destruido: ahí aparece el texto del combo (el evento viene justo después)
    let lastKill = { cx: fieldW / 2, cy: 80 };
    for (const ev of evs) {
      switch (ev.type) {
        case 'hit': {
          const b = ev.block;
          // tono que sube con cada toque, con tope para que los bloques largos (25 toques) no chillen
          fx.beep(300 + Math.min(b.total - b.left, 12) * 70, 0.07);
          fx.buzz(10);
          break;
        }
        case 'kill': {
          const b = ev.block;
          const { cx, cy } = centerOf(b, sx, sy);
          lastKill = { cx, cy };
          timePop('gain');
          fx.beep(880, 0.15, 'triangle', 0.09);
          fx.buzz(30);
          fxl.add({ kind: 'burst', x: cx, y: cy, color: b.color });
          fxl.add({ kind: 'float', x: cx, y: cy, text: `+${ev.gain}s` });
          break;
        }
        case 'trap': {
          const { cx, cy } = centerOf(ev.block, sx, sy);
          timePop('hurt');
          fxl.add({ kind: 'burst', x: cx, y: cy, color: C.bad, count: 24 });
          fxl.add({ kind: 'float', x: cx, y: cy, text: `−${ev.penalty}s`, neg: true });
          hurt.trigger();
          fx.beep(90, 0.4, 'sawtooth', 0.12);
          fx.buzz(250);
          break;
        }
        case 'expire':
        case 'trapGone': {
          const b = ev.block;
          fxl.add({
            kind: 'ghost',
            block: { x: b.x * sx, y: b.y * sy, w: b.w * sx, h: b.h * sy, label: ev.type === 'expire' ? '✕' : '', color: b.color },
          });
          if (ev.type === 'expire') {
            const { cx, cy } = centerOf(b, sx, sy);
            timePop('hurt');
            fxl.add({ kind: 'float', x: cx, y: cy, text: `−${ev.penalty}s`, neg: true });
            fx.beep(150, 0.15, 'sawtooth', 0.05);
          }
          break;
        }
        case 'miss':
          fxl.add({ kind: 'miss', x: ev.x * sx, y: ev.y * sy });
          hurt.trigger();
          fx.beep(120, 0.25, 'sawtooth', 0.08);
          fx.buzz(80);
          break;
        case 'combo':
          // "+1s · ¡Combo ×3!" sobre el bloque recién destruido, por encima de su "+Ns"
          setStreakPop((k) => k + 1);
          fxl.add({
            kind: 'banner',
            x: lastKill.cx,
            y: Math.max(0, lastKill.cy - 64),
            text: `+${ev.bonus}s · ¡Combo ×${ev.streak}!`,
            maxW: fieldW,
          });
          comboSound(ev.bonus);
          break;
        case 'comboBreak':
          // solo si la racha alcanzó a dar premio
          if (ev.streak >= 3) {
            fxl.add({
              kind: 'banner',
              x: fieldW / 2,
              y: 12,
              text: `Racha de ${ev.streak} · +${ev.earned} s`,
              color: C.gold,
              maxW: fieldW,
              small: true,
            });
          }
          break;
        case 'end':
          fx.beep(200, 0.5, 'sawtooth', 0.08);
          fx.buzz(150);
          break;
      }
    }
  };

  const onEnd = (r: GameResult) => {
    const mode = runMode.current;
    let finish: Promise<RunResult> | null = null;
    if (mode.kind === 'server') {
      finish = submitRun(mode, r);
      finish.catch(() => {}); // el error se muestra en EndPanel
    }
    setEndRun({ id: ++runSeq.current, result: r, mode, finish });
    const rec = recordRun(r.killed, r.missed);
    setBest(rec.best);
    setHist(rec.hist);
    setEnd({ title: endTitle(rec.isRecord, r.endReason), killed: r.killed, missed: r.missed, bestStreak: r.bestStreak });
  };

  const runner = useGameRunner({ onEvents, onEnd });
  const s = runner.state;
  if (s && field.w > 0) scale.current = { sx: field.w / s.config.fieldW, sy: field.h / s.config.fieldH };
  const { sx, sy } = scale.current;

  const tapsProps = useFieldTaps(fieldRef, (px, py) => {
    const { sx: kx, sy: ky } = scale.current;
    runner.tapAt(px / kx, py / ky);
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
  const pendingStart = useRef(false);

  const startGame = useCallback(async () => {
    const f = fieldNow.current;
    if (!(f.w > 0 && f.h > 0)) {
      pendingStart.current = true; // se empieza apenas se mida el campo
      return;
    }
    if (startingRef.current) return;
    pendingStart.current = false;
    const w = Math.round(f.w);
    const h = Math.round(f.h);
    // El pitido va dentro del toque (iOS solo habilita el audio durante un gesto del usuario).
    fx.beep(520, 0.1, 'triangle', 0.08);
    // Con cuentas: POST /runs (semilla y corazones del servidor), sin esperar más de 1.5 s.
    startingRef.current = true;
    setStarting(true);
    const mode = await prepareRun(w, h);
    startingRef.current = false;
    setStarting(false);
    runMode.current = mode;
    clearFx();
    setEnd(null);
    setEndRun(null);
    if (mode.kind === 'server') runnerRef.current.start(w, h, mode.maxLives, mode.seed);
    else runnerRef.current.start(w, h, BASE_LIVES);
  }, [clearFx]);

  useEffect(() => {
    if (pendingStart.current && field.w > 0) void startGame();
  }, [field, startGame]);

  // Durante la partida se esconden las pestañas (sin toques accidentales).
  useEffect(() => {
    setPlaying(runner.playing || starting);
  }, [runner.playing, starting]);
  useEffect(() => () => setPlaying(false), []);

  // Primera visita en este dispositivo: el onboarding se abre solo (una única vez).
  useEffect(() => {
    if (!rootNav?.key) return;
    if (!onboardingSeen()) router.push('/como-jugar');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootNav?.key]);

  // "¡Jugar!" en la última slide del onboarding vuelve aquí y empieza la partida.
  useFocusEffect(
    useCallback(() => {
      if (consumeStartRequest()) void startGame();
      else warmSession();
    }, [startGame]),
  );

  const seconds = s ? s.timeLeft : START_TIME;
  const low = seconds <= LOW_TIME;
  const barRatio = s ? s.timeLeft / s.barMax : 1;
  // corazones en reposo: los de la cuenta (5 + invitados, máx. 8)
  const restLives = features.accounts && viewer.user ? viewer.user.maxLives : BASE_LIVES;

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
      <Animated.View ref={fieldRef} {...tapsProps} style={[styles.field, hurt.shakeStyle]} onLayout={onLayout}>
        {s && !s.over
          ? s.blocks.map((b) => (
              <Block
                key={b.id}
                x={b.x * sx}
                y={b.y * sy}
                w={b.w * sx}
                h={b.h * sy}
                // números: toques que faltan; operaciones: su operación (el jugador cuenta de memoria)
                label={b.kind === 'num' ? String(b.left) : b.label}
                color={b.color}
                red={b.red}
                life={b.life / b.max}
                hitKey={b.total - b.left}
              />
            ))
          : null}
        <FxLayer items={fxl.items} />
        <Flash style={hurt.flashStyle} />
      </Animated.View>

      {!runner.playing ? (
        <View style={styles.over}>
          <ScrollView
            contentContainerStyle={[styles.overInner, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom + tabSpace }]}
          >
            {end ? (
              <>
                <Text style={styles.endTitle} accessibilityRole="header">
                  {end.title}
                </Text>
                <Text style={styles.endText}>
                  Destruiste <Text style={styles.endBig}>{end.killed}</Text> bloques{'\n'}Bloques que se escaparon: {end.missed}
                  {'\n'}Mejor racha: <Text style={styles.endStreak}>{end.bestStreak}</Text>
                </Text>
                {features.accounts && endRun ? <EndPanel key={endRun.id} run={endRun} /> : null}
              </>
            ) : (
              <>
                <Logo />
                <Text style={styles.tag}>Toca cada bloque tantas veces como diga su número… o su resultado.</Text>
              </>
            )}
            <RecordPill best={best} />
            <HistoryList hist={hist} best={best} current={!!end} />
            <MainButton title={starting ? 'Preparando…' : end ? 'Jugar de nuevo' : 'Jugar'} onPress={() => void startGame()} />
          </ScrollView>
          {features.accounts ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Perfil"
            hitSlop={10}
            onPress={() => router.push('/perfil')}
            style={({ pressed }) => [styles.profileBtn, { top: insets.top + 10 }, pressed && styles.pressed]}
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
  field: { flex: 1, marginTop: 10, overflow: 'hidden', position: 'relative' },
  over: { ...StyleSheet.absoluteFill, backgroundColor: C.overlay, zIndex: 10 },
  overInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  tag: { color: C.text, fontSize: 17, fontWeight: '600', textAlign: 'center', marginTop: 8, lineHeight: 25, maxWidth: 300 },
  endTitle: { color: C.text, fontSize: 32, fontWeight: '800', textAlign: 'center' },
  endText: { color: C.text, opacity: 0.85, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  endBig: { fontSize: 40, color: C.accent, fontWeight: '800' },
  endStreak: { color: C.gold, fontWeight: '800' },
  profileBtn: {
    position: 'absolute',
    right: 14,
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
