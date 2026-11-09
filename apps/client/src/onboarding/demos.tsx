import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { BASE_LIVES, BOMB_PENALTY, COLORS, COMBO_REWARDS, MAX_LIVES_CAP, MISS_MULT_NUM, OP_SYMBOL, OP_WIDTH_RATIO } from '@tb/engine';
import { Block } from '@/components/Block';
import { Flash, FxLayer, useFxList, useHurtFx } from '@/components/Fx';
import { Clock, Hearts, Streak, TimeBar } from '@/components/Hud';
import { C } from '@/theme';
import { TapFinger } from './TapFinger';
import { passed, useCues, useLoopTime } from './timeline';

/** Props comunes: tamaño del escenario, si la slide está a la vista y si hay movimiento reducido. */
export interface DemoProps {
  w: number;
  h: number;
  active: boolean;
  reduced: boolean;
}

const BS = 84; // tamaño de bloque en las demos

/** Escenario: un trozo de campo de juego con su sacudida y destello. */
function Stage({ w, h, children, top, hurt }: { w: number; h: number; children: ReactNode; top?: ReactNode; hurt?: ReturnType<typeof useHurtFx> }) {
  return (
    <View style={[styles.stage, { width: w, height: h }]}>
      {top ? <View style={styles.stageTop}>{top}</View> : null}
      <Animated.View style={[styles.stageField, hurt?.shakeStyle]}>{children}</Animated.View>
      {hurt ? <Flash style={hurt.flashStyle} /> : null}
    </View>
  );
}

/** Texto flotante quieto, para el cuadro fijo con movimiento reducido. */
function StaticFloat({ x, y, text, neg }: { x: number; y: number; text: string; neg?: boolean }) {
  return (
    <Text pointerEvents="none" style={[styles.staticFloat, { left: Math.max(4, x - 20), top: y - 76, color: neg ? C.bad : C.good }]}>
      {text}
    </Text>
  );
}

const FIELD_TOP = 64; // alto de la franja superior (reloj / corazones) dentro del escenario

// ------------------------------------------------------------------ 1. tocar N veces

const T1 = { period: 2700, spawn: 200, taps: [700, 1150, 1600] as const };
const CUES1 = { kill: 1600 };

export function DemoTap({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(T1.period, active, reduced ? 1000 : null);
  const fxl = useFxList();
  const fh = h - 20;
  const bx = w / 2 - BS / 2;
  const by = fh / 2 - BS / 2;
  const color = COLORS[2];
  useCues(t, CUES1, () => fxl.add({ kind: 'burst', x: bx + BS / 2, y: by + BS / 2, color }), active && !reduced);
  const n = passed(t, T1.taps);
  const alive = t >= T1.spawn && n < 3;
  return (
    <Stage w={w} h={h}>
      {alive ? <Block x={bx} y={by} w={BS} h={BS} label={String(3 - n)} color={color} life={1 - (t - T1.spawn) / 4000} hitKey={n} /> : null}
      <FxLayer items={fxl.items} />
      <TapFinger x={bx + BS / 2 + 24} y={by + BS / 2 + 28} tapKey={n} visible={t >= 450 && t < 1900} />
    </Stage>
  );
}

// ------------------------------------------------------------------ 2. completar suma tiempo

const T2 = { period: 3600, spawn: 200, taps: [700, 1050, 1400, 1750] as const, start: 8 };
const CUES2 = { kill: 1750 };

export function DemoGain({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(T2.period, active, reduced ? 2050 : null);
  const fxl = useFxList();
  const fh = h - FIELD_TOP;
  const bx = w / 2 - BS / 2;
  const by = fh / 2 - BS / 2;
  const color = COLORS[3];
  const n = passed(t, T2.taps);
  const killed = n >= 4;
  const seconds = T2.start - t / 1000 + (killed ? 4 : 0);
  useCues(
    t,
    CUES2,
    () => {
      fxl.add({ kind: 'burst', x: bx + BS / 2, y: by + BS / 2, color });
      fxl.add({ kind: 'float', x: bx + BS / 2, y: by + BS / 2, text: '+4s' });
    },
    active && !reduced,
  );
  return (
    <Stage
      w={w}
      h={h}
      top={
        <View style={styles.center}>
          <Clock seconds={seconds} popKey={killed ? 1 : 0} popKind="gain" size={32} />
          <TimeBar ratio={seconds / 12} low={false} style={styles.miniBar} />
        </View>
      }
    >
      {t >= T2.spawn && !killed ? (
        <Block x={bx} y={by} w={BS} h={BS} label={String(4 - n)} color={color} life={1 - (t - T2.spawn) / 4000} hitKey={n} />
      ) : null}
      {reduced ? <StaticFloat x={bx + BS / 2} y={by + BS / 2} text="+4s" /> : null}
      <FxLayer items={fxl.items} />
      <TapFinger x={bx + BS / 2 + 24} y={by + BS / 2 + 28} tapKey={n} visible={t >= 450 && t < 1950} />
    </Stage>
  );
}

// ------------------------------------------------------------------ 3. bloque que se escapa

const T3 = { period: 3800, spawn: 200, expire: 2400, start: 25 };
const CUES3 = { expire: 2400 };

export function DemoEscape({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(T3.period, active, reduced ? 2550 : null);
  const fxl = useFxList();
  const fh = h - FIELD_TOP;
  const bx = w / 2 - BS / 2;
  const by = fh / 2 - BS / 2;
  const color = COLORS[2];
  const penalty = 3 * MISS_MULT_NUM;
  const gone = t >= T3.expire;
  const seconds = T3.start - t / 1000 - (gone ? penalty : 0);
  useCues(
    t,
    CUES3,
    () => {
      fxl.add({ kind: 'ghost', block: { x: bx, y: by, w: BS, h: BS, label: '✕', color } });
      fxl.add({ kind: 'float', x: bx + BS / 2, y: by + BS / 2, text: `−${penalty}s`, neg: true });
    },
    active && !reduced,
  );
  return (
    <Stage
      w={w}
      h={h}
      top={
        <View style={styles.center}>
          <Clock seconds={seconds} popKey={gone ? 1 : 0} popKind="hurt" size={32} />
          <TimeBar ratio={seconds / T3.start} low={seconds <= 5} style={styles.miniBar} />
        </View>
      }
    >
      {t >= T3.spawn && !gone ? (
        <Block x={bx} y={by} w={BS} h={BS} label="3" color={color} life={1 - (t - T3.spawn) / (T3.expire - T3.spawn)} />
      ) : null}
      {reduced ? (
        <>
          <Block x={bx} y={by} w={BS} h={BS} label="✕" color={C.gone} spawn={false} />
          <StaticFloat x={bx + BS / 2} y={by + BS / 2} text={`−${penalty}s`} neg />
        </>
      ) : null}
      <FxLayer items={fxl.items} />
    </Stage>
  );
}

// ------------------------------------------------------------------ 4. tocar fuera quita una vida

const T4 = { period: 3200, tap: 1300 };
const CUES4 = { miss: 1300 };

export function DemoMiss({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(T4.period, active, reduced ? 1500 : null);
  const fxl = useFxList();
  const hurt = useHurtFx();
  const fh = h - FIELD_TOP;
  const bx = 22;
  const by = fh / 2 - BS / 2;
  const tx = w - 70;
  const ty = fh / 2 + 6;
  const missed = t >= T4.tap;
  useCues(
    t,
    CUES4,
    () => {
      fxl.add({ kind: 'miss', x: tx, y: ty });
      hurt.trigger();
    },
    active && !reduced,
  );
  return (
    <Stage
      w={w}
      h={h}
      hurt={hurt}
      top={
        <View style={styles.center}>
          <Hearts lives={missed ? BASE_LIVES - 1 : BASE_LIVES} max={BASE_LIVES} size={26} />
        </View>
      }
    >
      <Block x={bx} y={by} w={BS} h={BS} label="2" color={COLORS[1]} life={0.75} spawn={false} />
      {reduced ? <Text style={[styles.staticMiss, { left: tx - 12, top: ty - 24 }]}>✕</Text> : null}
      <FxLayer items={fxl.items} />
      <TapFinger x={tx + 12} y={ty + 14} tapKey={missed ? 1 : 0} visible={t >= 700 && t < 1700} />
    </Stage>
  );
}

// ------------------------------------------------------------------ 5. trampas

const T5 = { period: 4300, spawn: 200, hiFrom: 800, hiTo: 1900, tap: 2500, start: 45 };
const CUES5 = { trap: 2500 };

function Highlight({ x, y, size, on }: { x: number; y: number; size: number; on: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = on ? withRepeat(withSequence(withTiming(1, { duration: 280 }), withTiming(0.35, { duration: 280 })), -1) : withTiming(0, { duration: 150 });
  }, [on, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.hi, { left: x - 7, top: y - 7, width: size + 14, height: size + 14 }, style]}
    />
  );
}

export function DemoTrap({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(T5.period, active, reduced ? 1300 : null);
  const fxl = useFxList();
  const hurt = useHurtFx();
  const fh = h - FIELD_TOP;
  const gap = Math.min(40, (w - BS * 2) / 3);
  const ax = w / 2 - BS - gap / 2;
  const bx = w / 2 + gap / 2;
  const by = fh / 2 - BS / 2;
  const color = COLORS[3];
  const hit = t >= T5.tap;
  const seconds = T5.start - t / 1000 - (hit ? BOMB_PENALTY : 0);
  useCues(
    t,
    CUES5,
    () => {
      fxl.add({ kind: 'burst', x: bx + BS / 2, y: by + BS / 2, color: C.bad, count: 24 });
      fxl.add({ kind: 'float', x: bx + BS / 2, y: by + BS / 2, text: `−${BOMB_PENALTY}s`, neg: true });
      hurt.trigger();
    },
    active && !reduced,
  );
  const shown = t >= T5.spawn;
  return (
    <Stage
      w={w}
      h={h}
      hurt={hurt}
      top={
        <View style={styles.center}>
          <Clock seconds={seconds} popKey={hit ? 1 : 0} popKind="hurt" size={32} />
        </View>
      }
    >
      {shown ? <Block x={ax} y={by} w={BS} h={BS} label="4" color={color} life={1 - (t - T5.spawn) / 6000} /> : null}
      {shown && !hit ? (
        <>
          <Highlight x={bx} y={by} size={BS} on={t >= T5.hiFrom && t < T5.hiTo} />
          <Block x={bx} y={by} w={BS} h={BS} label="4" color={color} red life={1 - (t - T5.spawn) / 6000} />
        </>
      ) : null}
      <FxLayer items={fxl.items} />
      <TapFinger x={bx + BS / 2 + 24} y={by + BS / 2 + 28} tapKey={hit ? 1 : 0} visible={t >= 2050 && t < 2800} />
    </Stage>
  );
}

// ------------------------------------------------------------------ operaciones

/** Puntos que se llenan con cada toque (el bloque con operación no cambia su texto). */
function TapDots({ x, y, n, of }: { x: number; y: number; n: number; of: number }) {
  return (
    <View pointerEvents="none" style={[styles.dots, { left: x, top: y }]}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={[styles.tapDot, i < n && styles.tapDotOn]} />
      ))}
    </View>
  );
}

const DOTS_W = 5 * 8 + 4 * 6;
const TOPS = { period: 4300, spawn: 200, taps: [700, 1000, 1300, 1600, 1900] as const, start: 8 };
const CUES_OPS = { kill: 1900 };
const OP_ADD = `2${OP_SYMBOL.add}3`;
const OP_MUL = `2${OP_SYMBOL.mul}3`;
const OP_DIV = `8${OP_SYMBOL.div}2`;

export function DemoOps({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(TOPS.period, active, reduced ? 1750 : null);
  const fxl = useFxList();
  const fh = h - FIELD_TOP;
  // bloque principal "2+3" arriba; ejemplos "2×3" y "8÷2" abajo
  const mh = Math.min(70, fh * 0.36);
  const mw = mh * OP_WIDTH_RATIO;
  const mx = w / 2 - mw / 2;
  const my = 8;
  const sh = Math.min(50, fh * 0.26);
  const sw = sh * OP_WIDTH_RATIO;
  const sgap = Math.min(36, (w - sw * 2) / 3);
  const sy = fh - sh - 26;
  const s1 = w / 2 - sw - sgap / 2;
  const s2 = w / 2 + sgap / 2;
  const color = COLORS[4];
  const n = passed(t, TOPS.taps);
  const killed = n >= 5;
  const seconds = TOPS.start - t / 1000 + (killed ? 5 : 0);
  useCues(
    t,
    CUES_OPS,
    () => {
      fxl.add({ kind: 'burst', x: mx + mw / 2, y: my + mh / 2, color });
      fxl.add({ kind: 'float', x: mx + mw / 2, y: my + mh / 2, text: '+5s' });
    },
    active && !reduced,
  );
  return (
    <Stage
      w={w}
      h={h}
      top={
        <View style={styles.center}>
          <Clock seconds={seconds} popKey={killed ? 1 : 0} popKind="gain" size={32} />
          <TimeBar ratio={seconds / 14} low={false} style={styles.miniBar} />
        </View>
      }
    >
      {t >= TOPS.spawn && !killed ? (
        <>
          <Block x={mx} y={my} w={mw} h={mh} label={OP_ADD} color={color} life={1 - (t - TOPS.spawn) / 4000} hitKey={n} />
          <TapDots x={w / 2 - DOTS_W / 2} y={my + mh + 10} n={n} of={5} />
        </>
      ) : null}
      <Block x={s1} y={sy} w={sw} h={sh} label={OP_MUL} color={COLORS[5]} spawn={false} />
      <Block x={s2} y={sy} w={sw} h={sh} label={OP_DIV} color={COLORS[7]} spawn={false} />
      <Text style={[styles.opCap, { left: s1, top: sy + sh + 6, width: sw }]}>6 toques</Text>
      <Text style={[styles.opCap, { left: s2, top: sy + sh + 6, width: sw }]}>4 toques</Text>
      <FxLayer items={fxl.items} />
      <TapFinger x={mx + mw - 16} y={my + mh - 4} tapKey={n} visible={t >= 450 && t < 2200} />
    </Stage>
  );
}

// ------------------------------------------------------------------ resultados ≤ 0 y trampas con operación

const TPOS = { period: 4800, spawn: 200, hoverA: [700, 1300] as const, hoverB: [1300, 1900] as const, fade: 2100, tap: 3100, start: 45 };
const CUES_POS = { fade: 2100, trap: 3100 };
const OP_NEG = `3${OP_SYMBOL.sub}4`;
const OP_ZERO = `3${OP_SYMBOL.sub}3`;

export function DemoPositive({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(TPOS.period, active, reduced ? 1000 : null);
  const fxl = useFxList();
  const hurt = useHurtFx();
  const fh = h - FIELD_TOP;
  const bh = Math.min(62, fh * 0.32);
  const bw = bh * OP_WIDTH_RATIO;
  const gap = Math.min(36, (w - bw * 2) / 3);
  const ax = w / 2 - bw - gap / 2;
  const bx = w / 2 + gap / 2;
  const ty = 8;
  const rx = w / 2 - bw / 2;
  const ry = fh - bh - 12;
  const redColor = COLORS[4];
  const faded = t >= TPOS.fade;
  const hit = t >= TPOS.tap;
  const seconds = TPOS.start - t / 1000 - (hit ? BOMB_PENALTY : 0);
  useCues(
    t,
    CUES_POS,
    (name) => {
      if (name === 'fade') {
        // las trampas que se van solas no castigan
        fxl.add({ kind: 'ghost', block: { x: ax, y: ty, w: bw, h: bh, label: '', color: COLORS[1] } });
        fxl.add({ kind: 'ghost', block: { x: bx, y: ty, w: bw, h: bh, label: '', color: COLORS[6] } });
        fxl.add({ kind: 'banner', x: w / 2, y: ty + bh + 6, text: 'Sin castigo', color: C.text, maxW: w, small: true });
      } else {
        fxl.add({ kind: 'burst', x: rx + bw / 2, y: ry + bh / 2, color: C.bad, count: 24 });
        fxl.add({ kind: 'float', x: rx + bw / 2, y: ry + bh / 2, text: `−${BOMB_PENALTY}s`, neg: true });
        hurt.trigger();
      }
    },
    active && !reduced,
  );
  const shown = t >= TPOS.spawn;
  const lifeOf = (dur: number) => 1 - (t - TPOS.spawn) / dur;
  // el dedo se acerca a cada resta sin tocarla y después toca la trampa roja
  let finger: { x: number; y: number } | null = null;
  if (t >= TPOS.hoverA[0] && t < TPOS.hoverA[1]) finger = { x: ax + bw / 2 + 10, y: ty + bh + 26 };
  else if (t >= TPOS.hoverB[0] && t < TPOS.hoverB[1]) finger = { x: bx + bw / 2 + 10, y: ty + bh + 26 };
  else if (t >= 2600 && t < 3400) finger = { x: rx + bw - 16, y: ry + bh - 4 };
  return (
    <Stage
      w={w}
      h={h}
      hurt={hurt}
      top={
        <View style={styles.center}>
          <Clock seconds={seconds} popKey={hit ? 1 : 0} popKind="hurt" size={32} />
        </View>
      }
    >
      {shown && !faded ? (
        <>
          <Block x={ax} y={ty} w={bw} h={bh} label={OP_NEG} color={COLORS[1]} life={lifeOf(TPOS.fade - TPOS.spawn)} />
          <Block x={bx} y={ty} w={bw} h={bh} label={OP_ZERO} color={COLORS[6]} life={lifeOf(TPOS.fade - TPOS.spawn)} />
        </>
      ) : null}
      {shown && !hit ? <Block x={rx} y={ry} w={bw} h={bh} label={OP_ADD} color={redColor} red life={lifeOf(5000)} /> : null}
      <FxLayer items={fxl.items} />
      {finger ? <TapFinger x={finger.x} y={finger.y} tapKey={hit ? 1 : 0} /> : null}
    </Stage>
  );
}

// ------------------------------------------------------------------ combos

const TCOMBO = { period: 4600, kills: [700, 1200, 1700, 2200, 2700] as const, start: 12 };
const CUES_COMBO = { k0: 700, k1: 1200, k2: 1700, k3: 2200, k4: 2700 };
const COMBO_COLORS = [COLORS[4], COLORS[3], COLORS[5], COLORS[2], COLORS[7]];

export function DemoCombo({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(TCOMBO.period, active, reduced ? 2600 : null);
  const fxl = useFxList();
  const fh = h - FIELD_TOP;
  const bs = Math.min(54, fh * 0.28);
  const pad = 16;
  const listH = 46;
  const span = w - pad * 2 - bs;
  const area = fh - listH - 18 - bs; // alto disponible para los bloques
  const pos = TCOMBO.kills.map((_, i) => ({ x: pad + (span * i) / 4, y: 6 + (i % 2 ? area * 0.95 : area * 0.4) }));
  const streak = passed(t, TCOMBO.kills);
  let bonus = 0;
  for (let i = 1; i <= streak; i++) for (const [at, b] of COMBO_REWARDS) if (at === i) bonus += b;
  const seconds = TCOMBO.start - t / 1000 + streak + bonus;
  useCues(
    t,
    CUES_COMBO,
    (name) => {
      const i = Number(name.slice(1));
      const p = pos[i];
      const cx = p.x + bs / 2;
      const cy = p.y + bs / 2;
      fxl.add({ kind: 'burst', x: cx, y: cy, color: COMBO_COLORS[i], count: 10 });
      fxl.add({ kind: 'float', x: cx, y: cy, text: '+1s' });
      const reward = COMBO_REWARDS.find(([at]) => at === i + 1);
      if (reward) fxl.add({ kind: 'banner', x: w / 2, y: Math.max(0, area * 0.5 - 4), text: `+${reward[1]}s · ¡Combo ×${reward[0]}!`, maxW: w });
    },
    active && !reduced,
  );
  // cada bloque aparece ~0.5 s antes de que lo toquen; el dedo se queda un poco después del toque
  const current = TCOMBO.kills.findIndex((k) => t < k);
  const aim = TCOMBO.kills.findIndex((k) => t < k + 150);
  const chipW = Math.min(58, (w - pad * 2 - 4 * 6) / 5);
  return (
    <Stage
      w={w}
      h={h}
      top={
        <View style={styles.center}>
          <Clock seconds={seconds} popKey={streak} popKind="gain" size={32} />
          <Streak n={streak} popKey={streak >= 3 ? (streak >= 5 ? 2 : 1) : 0} size={14} />
        </View>
      }
    >
      {TCOMBO.kills.map((k, i) =>
        i === current && t >= k - 500 ? (
          <Block key={i} x={pos[i].x} y={pos[i].y} w={bs} h={bs} label="1" color={COMBO_COLORS[i]} life={1 - (t - (k - 500)) / 3000} />
        ) : null,
      )}
      <View style={[styles.comboList, { top: fh - listH - 8 }]}>
        {COMBO_REWARDS.map(([at, b]) => (
          <View key={at} style={[styles.comboChip, { width: chipW }, streak >= at && styles.comboChipOn]}>
            <Text style={[styles.comboAt, streak >= at && styles.comboOnT]}>{at}</Text>
            <Text style={[styles.comboB, streak >= at && styles.comboOnT]}>+{b}s</Text>
          </View>
        ))}
      </View>
      <FxLayer items={fxl.items} />
      {aim >= 0 && t >= TCOMBO.kills[aim] - 300 ? (
        <TapFinger x={pos[aim].x + bs / 2 + 18} y={pos[aim].y + bs / 2 + 18} tapKey={streak} />
      ) : null}
    </Stage>
  );
}

// ------------------------------------------------------------------ 6. invitar amigos (con cuentas)

const T6 = { period: 3800, friend: 900, plus: 1500 };
const CUES6 = { plus: 1500 };

export function DemoInvite({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(T6.period, active, reduced ? 2200 : null);
  const fxl = useFxList();
  const max = t >= T6.plus ? BASE_LIVES + 1 : BASE_LIVES;
  const cx = w / 2;
  const cy = (h - FIELD_TOP) / 2 - 10;
  useCues(t, CUES6, () => fxl.add({ kind: 'float', x: cx + 10, y: cy + 10, text: '+1 ♥' }), active && !reduced);
  const friend = useSharedValue(0);
  useEffect(() => {
    friend.value = withTiming(t >= T6.friend ? 1 : 0, { duration: t >= T6.friend ? 300 : 0 });
  }, [t >= T6.friend, friend]); // eslint-disable-line react-hooks/exhaustive-deps
  const chip = useAnimatedStyle(() => ({ opacity: friend.value, transform: [{ translateY: 16 * (1 - friend.value) }] }));
  return (
    <Stage
      w={w}
      h={h}
      top={
        <View style={styles.center}>
          <Hearts lives={max} max={max} size={26} />
        </View>
      }
    >
      <Animated.View style={[styles.chip, chip]}>
        <Text style={styles.chipT}>@amiga se unió con tu invitación</Text>
      </Animated.View>
      {reduced ? <StaticFloat x={cx + 10} y={cy + 30} text="+1 ♥" /> : null}
      <FxLayer items={fxl.items} />
      <Text style={styles.capNote}>Máximo {MAX_LIVES_CAP} corazones</Text>
    </Stage>
  );
}

// ------------------------------------------------------------------ 7. ranking (con cuentas)

const T7 = { period: 4200, up: 1400 };
const ROW_H = 34;

function RankRow({ pos, name, score, me, w }: { pos: number; name: string; score: number; me?: boolean; w: number }) {
  const y = useSharedValue(pos * ROW_H);
  useEffect(() => {
    y.value = withTiming(pos * ROW_H, { duration: 500 });
  }, [pos, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[styles.rankRow, { width: w }, me && styles.rankMe, style]}>
      <Text style={[styles.rankPos, me && styles.rankMeT]}>{pos + 1}</Text>
      <Text style={[styles.rankName, me && styles.rankMeT]}>{name}</Text>
      <Text style={[styles.rankScore, me && styles.rankMeT]}>{score}</Text>
    </Animated.View>
  );
}

export function DemoRanking({ w, h, active, reduced }: DemoProps) {
  const t = useLoopTime(T7.period, active, reduced ? 2500 : null);
  const up = t >= T7.up;
  const rw = Math.min(w - 32, 260);
  return (
    <Stage
      w={w}
      h={h}
      top={
        <View style={[styles.center, styles.tabs]}>
          <Text style={[styles.tab, styles.tabOn]}>Tu país</Text>
          <Text style={styles.tab}>Mundo</Text>
        </View>
      }
    >
      <View style={[styles.rankList, { width: rw, left: (w - rw) / 2 }]}>
        <RankRow w={rw} pos={0} name="camila" score={58} />
        <RankRow w={rw} pos={up ? 2 : 1} name="tomás" score={47} />
        <RankRow w={rw} pos={up ? 3 : 2} name="ana" score={39} />
        <RankRow w={rw} pos={up ? 1 : 3} name="Tú" score={up ? 52 : 31} me />
      </View>
    </Stage>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: '#16161f',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.barBg,
    overflow: 'hidden',
  },
  stageTop: { height: FIELD_TOP, justifyContent: 'center' },
  stageField: { flex: 1, position: 'relative' },
  center: { alignItems: 'center' },
  miniBar: { width: 140, marginTop: 4 },
  staticFloat: { position: 'absolute', fontWeight: '800', fontSize: 22 },
  staticMiss: { position: 'absolute', fontWeight: '800', fontSize: 34, color: C.bad },
  hi: { position: 'absolute', borderRadius: 22, borderWidth: 3, borderColor: C.gold },
  chip: {
    position: 'absolute',
    alignSelf: 'center',
    top: 30,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipT: { color: C.text, fontSize: 14 },
  dots: { position: 'absolute', width: DOTS_W, flexDirection: 'row', gap: 6 },
  tapDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.heartOff },
  tapDotOn: { backgroundColor: C.accent },
  opCap: { position: 'absolute', textAlign: 'center', color: C.text, opacity: 0.7, fontSize: 12 },
  comboList: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  comboChip: {
    height: 46,
    borderRadius: 10,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comboChipOn: { borderColor: C.gold, backgroundColor: 'rgba(255,209,102,0.12)' },
  comboAt: { color: C.text, opacity: 0.75, fontSize: 15, fontWeight: '800', lineHeight: 18 },
  comboB: { color: C.text, opacity: 0.6, fontSize: 12, fontWeight: '700', lineHeight: 15 },
  comboOnT: { color: C.gold, opacity: 1 },
  capNote: { position: 'absolute', bottom: 14, alignSelf: 'center', color: C.text, opacity: 0.55, fontSize: 12 },
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  tab: { color: C.text, opacity: 0.6, fontSize: 13, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.panel },
  tabOn: { opacity: 1, backgroundColor: C.accentSoft, color: C.accent, fontWeight: '700' },
  rankList: { position: 'absolute', top: 4, height: ROW_H * 4 },
  rankRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: ROW_H - 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: C.panel,
  },
  rankMe: { backgroundColor: C.accent },
  rankMeT: { color: C.bg, opacity: 1, fontWeight: '800' },
  rankPos: { color: C.text, opacity: 0.6, width: 24, fontSize: 14, fontWeight: '700' },
  rankName: { color: C.text, flex: 1, fontSize: 14 },
  rankScore: { color: C.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
