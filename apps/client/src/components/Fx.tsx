import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { C } from '@/theme';
import { Block, type BlockProps } from './Block';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// ---------------------------------------------------------------- partículas

interface ParticleSpec {
  a: number;
  d: number;
  rot: number;
  dur: number;
}

function Particle({ x, y, color, spec }: { x: number; y: number; color: string; spec: ParticleSpec }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: spec.dur, easing: EASE_OUT });
  }, [p, spec.dur]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [
      { translateX: Math.cos(spec.a) * spec.d * p.value },
      { translateY: (Math.sin(spec.a) * spec.d + 30) * p.value },
      { rotate: `${spec.rot * p.value}deg` },
      { scale: 1 - 0.8 * p.value },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[styles.p, { left: x - 5, top: y - 5, backgroundColor: color }, style]} />;
}

/** Explosión de partículas desde (x, y), como burst() de legacy. */
export function Burst({ x, y, color, count = 14 }: { x: number; y: number; color: string; count?: number }) {
  const [specs] = useState<ParticleSpec[]>(() =>
    Array.from({ length: count }, () => ({
      a: Math.random() * Math.PI * 2,
      d: 40 + Math.random() * 80,
      rot: Math.random() * 400,
      dur: 450 + Math.random() * 250,
    })),
  );
  return (
    <>
      {specs.map((s, i) => (
        <Particle key={i} x={x} y={y} color={color} spec={s} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- textos que suben

function useRise(duration: number) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration, easing: EASE_OUT });
  }, [p, duration]);
  return useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ translateY: -40 * p.value }] }));
}

/** "+4s" / "−15s" que sube y se desvanece. (x, y) = centro del bloque. */
export function FloatText({ x, y, text, neg, color }: { x: number; y: number; text: string; neg?: boolean; color?: string }) {
  const style = useRise(800);
  return (
    <Animated.View pointerEvents="none" style={[styles.floatBox, { left: Math.max(4, x - 20), top: y - 30 }, style]}>
      <Text style={[styles.pts, { color: color ?? (neg ? C.bad : C.good) }]} selectable={false}>
        {text}
      </Text>
    </Animated.View>
  );
}

/**
 * Mensaje corto centrado en x ("+1s · ¡Combo ×3!", "Racha de 18 · +10 s"): aparece, sube un
 * poco y se desvanece. Se mantiene dentro de [0, maxW].
 */
export function Banner({ x, y, text, color = C.good, maxW, small }: { x: number; y: number; text: string; color?: string; maxW: number; small?: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSequence(
      withTiming(0.15, { duration: 120, easing: EASE_OUT }),
      withTiming(0.7, { duration: small ? 1100 : 700 }),
      withTiming(1, { duration: 350, easing: EASE_OUT }),
    );
  }, [p, small]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.15 ? p.value / 0.15 : p.value > 0.7 ? 1 - (p.value - 0.7) / 0.3 : 1,
    transform: [{ translateY: -22 * p.value }],
  }));
  const bw = Math.min(BANNER_W, maxW);
  const left = Math.max(0, Math.min(maxW - bw, x - bw / 2));
  return (
    <Animated.View pointerEvents="none" style={[styles.banner, { left, top: y, width: bw }, style]}>
      <Text style={[small ? styles.bannerSmall : styles.bannerT, { color }]} selectable={false} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}
const BANNER_W = 240;

/** ✕ rojo donde se tocó fuera de un bloque. */
export function MissMark({ x, y }: { x: number; y: number }) {
  const style = useRise(600);
  return (
    <Animated.View pointerEvents="none" style={[styles.missBox, { left: x - 12, top: y - 24 }, style]}>
      <Text style={styles.miss} selectable={false}>
        ✕
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- lista de efectos

export type FxSpec =
  | { kind: 'burst'; x: number; y: number; color: string; count?: number }
  | { kind: 'float'; x: number; y: number; text: string; neg?: boolean; color?: string }
  | { kind: 'banner'; x: number; y: number; text: string; color?: string; maxW: number; small?: boolean }
  | { kind: 'miss'; x: number; y: number }
  | { kind: 'ghost'; block: BlockProps };

type FxItem = FxSpec & { id: number };

const LIFETIME: Record<FxSpec['kind'], number> = { burst: 750, float: 850, miss: 650, ghost: 320, banner: 1650 };

/** Efectos de corta vida (partículas, textos, ✕, bloques que se apagan). */
export function useFxList() {
  const [items, setItems] = useState<FxItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach(clearTimeout);
      t.clear();
    };
  }, []);

  const add = useCallback((spec: FxSpec) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { ...spec, id } as FxItem]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, LIFETIME[spec.kind]);
    timers.current.add(timer);
  }, []);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setItems([]);
  }, []);

  return { items, add, clear };
}

export function FxLayer({ items }: { items: FxItem[] }) {
  return (
    <>
      {items.map((it) => {
        switch (it.kind) {
          case 'burst':
            return <Burst key={it.id} x={it.x} y={it.y} color={it.color} count={it.count} />;
          case 'float':
            return <FloatText key={it.id} x={it.x} y={it.y} text={it.text} neg={it.neg} color={it.color} />;
          case 'banner':
            return <Banner key={it.id} x={it.x} y={it.y} text={it.text} color={it.color} maxW={it.maxW} small={it.small} />;
          case 'miss':
            return <MissMark key={it.id} x={it.x} y={it.y} />;
          case 'ghost':
            return <Block key={it.id} {...it.block} gone spawn={false} />;
        }
      })}
    </>
  );
}

// ---------------------------------------------------------------- sacudida + destello

/** Sacudida del campo y destello rojo (hurtFx de legacy). */
export function useHurtFx() {
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);
  const trigger = useCallback(() => {
    flash.value = withSequence(withTiming(0.28, { duration: 0 }), withTiming(0, { duration: 300 }));
    shake.value = withSequence(
      withTiming(-7, { duration: 50 }),
      withTiming(7, { duration: 50 }),
      withTiming(-5, { duration: 50 }),
      withTiming(5, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [flash, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  return { trigger, shakeStyle, flashStyle };
}

/** Capa roja del destello; va como último hijo del campo. */
export function Flash({ style }: { style: ReturnType<typeof useHurtFx>['flashStyle'] }) {
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, style]} />;
}

const styles = StyleSheet.create({
  p: { position: 'absolute', width: 10, height: 10, borderRadius: 3 },
  floatBox: { position: 'absolute', width: 120 },
  pts: { fontWeight: '800', fontSize: 22 },
  missBox: { position: 'absolute', width: 60 },
  banner: { position: 'absolute', alignItems: 'center' },
  bannerT: {
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerSmall: {
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(28,28,40,0.85)',
    overflow: 'hidden',
  },
  miss: { fontWeight: '800', fontSize: 34, color: C.bad, lineHeight: 40 },
  flash: { backgroundColor: C.danger, opacity: 0 },
});

