import { COLORS } from '@tb/engine';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { getActiveCosmetics, useActiveEffect, useActivePalette } from '@/cosmetics/active';
import type { EffectId } from '@/cosmetics/ids';
import { getPalette, paletteColor } from '@/cosmetics/palettes';
import { HEART } from '@/components/heart';
import { BURST_LIFETIME, type Piece, frameAt, isShapeEffect, makePieces } from '@/lib/fxShapes';
import { C } from '@/theme';
import { Block, type BlockProps } from './Block';

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// ---------------------------------------------------------------- partículas

/** Efecto al destruir (premio cosmético). */
export type BurstEffect = EffectId;

interface ParticleSpec {
  /** Ángulo y distancia del vuelo. */
  a: number;
  d: number;
  /** Giro total (grados) y giro inicial. */
  rot: number;
  rot0: number;
  dur: number;
  /** Desplazamiento vertical extra al final (+ cae, − sube). */
  fall: number;
  /** Escala al final. */
  end: number;
  w: number;
  h: number;
  radius: number;
  color: string;
  /** Si hay, la partícula es este carácter (♥) en vez de un rectángulo. */
  glyph?: string;
}

function Particle({ x, y, spec }: { x: number; y: number; spec: ParticleSpec }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: spec.dur, easing: EASE_OUT });
  }, [p, spec.dur]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [
      { translateX: Math.cos(spec.a) * spec.d * p.value },
      { translateY: (Math.sin(spec.a) * spec.d + spec.fall) * p.value },
      { rotate: `${spec.rot0 + spec.rot * p.value}deg` },
      { scale: 1 - (1 - spec.end) * p.value },
    ],
  }));
  if (spec.glyph) {
    return (
      <Animated.View pointerEvents="none" style={[styles.glyphBox, { left: x - spec.w / 2, top: y - spec.h / 2, width: spec.w, height: spec.h }, style]}>
        <Text style={[styles.glyph, { color: spec.color, fontSize: spec.h, lineHeight: spec.h }]} selectable={false}>
          {spec.glyph}
        </Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.p,
        { left: x - spec.w / 2, top: y - spec.h / 2, width: spec.w, height: spec.h, borderRadius: spec.radius, backgroundColor: spec.color },
        style,
      ]}
    />
  );
}

const SPARK = '#fff3b0';

/**
 * Partículas de Clásico, Chispas, Confeti y Corazones (los demás efectos salen de
 * `lib/fxShapes.ts`). Mismo número de partículas y duraciones ≤ 700 ms en los cuatro.
 */
function makeSpecs(effect: BurstEffect, count: number, color: string, palette: readonly string[]): ParticleSpec[] {
  const r = Math.random;
  return Array.from({ length: count }, (_, i): ParticleSpec => {
    const a = r() * Math.PI * 2;
    switch (effect) {
      case 'chispas':
        // trazos finos que salen disparados en su dirección, sin girar
        return { a, d: 60 + r() * 90, rot: 0, rot0: (a * 180) / Math.PI + 90, dur: 330 + r() * 220, fall: 10, end: 0.3, w: 3, h: 13, radius: 2, color: i % 2 ? SPARK : color };
      case 'confeti':
        // papelitos de todos los colores de la paleta, que giran y caen
        return { a, d: 40 + r() * 80, rot: 300 + r() * 500, rot0: r() * 180, dur: 450 + r() * 250, fall: 60, end: 0.7, w: 6, h: 10, radius: 1, color: palette[Math.floor(r() * palette.length)] };
      case 'corazones':
        // corazones que suben un poco
        return { a, d: 30 + r() * 70, rot: r() * 60 - 30, rot0: 0, dur: 450 + r() * 250, fall: -25, end: 0.5, w: 16, h: 13 + Math.round(r() * 5), radius: 0, color, glyph: HEART };
      default:
        // como burst() de legacy
        return { a, d: 40 + r() * 80, rot: r() * 400, rot0: 0, dur: 450 + r() * 250, fall: 30, end: 0.2, w: 10, h: 10, radius: 3, color };
    }
  });
}

// Pieza de un efecto de `fxShapes`: un solo valor compartido, y solo cambian opacidad y transform.
const ShapePiece = memo(function ShapePiece({ x, y, piece }: { x: number; y: number; piece: Piece }) {
  const { w, h, delay, dur, look, motion } = piece;
  const p = useSharedValue(0);
  useEffect(() => {
    // `Never`: con "reducir movimiento" las piezas ya vienen suavizadas; el ajuste del sistema las
    // haría saltar al final (invisibles).
    const never = ReduceMotion.Never;
    p.value = withDelay(delay, withTiming(1, { duration: dur, easing: Easing.linear, reduceMotion: never }), never);
  }, [p, delay, dur]);
  const style = useAnimatedStyle(() => {
    const f = frameAt(motion, p.value);
    return {
      opacity: f.o,
      transform: [{ translateX: f.x }, { translateY: f.y }, { rotate: `${f.r}deg` }, { scaleX: f.sx * f.s }, { scaleY: f.s }],
    };
  });
  const place = { left: x + piece.ox - w / 2, top: y + piece.oy - h / 2, width: w, height: h };
  if (look.type === 'text') {
    return (
      <Animated.Text
        pointerEvents="none"
        allowFontScaling={false}
        selectable={false}
        style={[styles.p, styles.pieceText, place, { fontSize: look.fontSize, lineHeight: h, color: look.color }, style]}
      >
        {look.text}
      </Animated.Text>
    );
  }
  const border = look.borderWidth ?? 0;
  const glint = look.glint;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.p,
        place,
        {
          borderRadius: look.radius,
          backgroundColor: look.color,
          borderWidth: border,
          borderColor: look.borderColor,
          backgroundImage: look.gradient,
        },
        style,
      ]}
    >
      {glint ? (
        // reflejo arriba a la izquierda, medido por dentro del borde
        <View
          style={[
            styles.glint,
            { left: (w - 2 * border) * 0.2, top: (h - 2 * border) * 0.16, width: glint, height: glint, borderRadius: glint / 2 },
          ]}
        />
      ) : null}
    </Animated.View>
  );
});

const ENGINE_COLORS = new Set<string>(COLORS);

/** Efecto con el que se dibuja un estallido: el forzado o, si es el de un bloque, el elegido. */
function burstEffect(color: string, forced: BurstEffect | undefined, active: BurstEffect): BurstEffect {
  return forced ?? (ENGINE_COLORS.has(color.toLowerCase()) ? active : 'normal');
}

/**
 * Explosión de partículas desde (x, y), como burst() de legacy. El color es el del motor y se
 * traduce a la paleta elegida. La forma sale del efecto elegido en la Colección, pero solo cuando
 * se destruye un bloque (su color está en `COLORS`): la trampa (`C.bad`) y el corazón siguen con
 * las partículas de siempre. `effect` lo fuerza (vistas previas; `'normal'` = las de siempre).
 * `count` solo vale para Clásico, Chispas, Confeti y Corazones: los demás tienen un número fijo de
 * piezas y, además, se suavizan con "reducir movimiento".
 */
export function Burst({ x, y, color, count = 14, effect }: { x: number; y: number; color: string; count?: number; effect?: BurstEffect }) {
  const activeEffect = useActiveEffect() as BurstEffect;
  const palette = useActivePalette();
  const reduced = useReducedMotion();
  const [burst] = useState(() => {
    const eff = burstEffect(color, effect, activeEffect);
    const shown = paletteColor(color, palette);
    return isShapeEffect(eff)
      ? { pieces: makePieces(eff, shown, reduced), specs: null }
      : { pieces: null, specs: makeSpecs(eff, count, shown, getPalette(palette).colors) };
  });
  return (
    <>
      {burst.pieces
        ? burst.pieces.map((piece, i) => <ShapePiece key={i} x={x} y={y} piece={piece} />)
        : burst.specs.map((s, i) => <Particle key={i} x={x} y={y} spec={s} />)}
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
  | { kind: 'burst'; x: number; y: number; color: string; count?: number; effect?: BurstEffect }
  | { kind: 'float'; x: number; y: number; text: string; neg?: boolean; color?: string }
  | { kind: 'banner'; x: number; y: number; text: string; color?: string; maxW: number; small?: boolean }
  | { kind: 'miss'; x: number; y: number }
  | { kind: 'ghost'; block: BlockProps };

type FxItem = FxSpec & { id: number };

/** Vida de cada cosa (ms); la de un estallido depende de su efecto (`BURST_LIFETIME`). */
const LIFETIME: Record<Exclude<FxSpec['kind'], 'burst'>, number> = { float: 850, miss: 650, ghost: 320, banner: 1650 };

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
    let item: FxSpec = spec;
    let life: number;
    if (spec.kind === 'burst') {
      // el efecto se fija aquí, para que el dibujo y la vida coincidan
      const effect = burstEffect(spec.color, spec.effect, getActiveCosmetics().effect as BurstEffect);
      item = { ...spec, effect };
      life = BURST_LIFETIME[effect] ?? BURST_LIFETIME.normal;
    } else {
      life = LIFETIME[spec.kind];
    }
    setItems((prev) => [...prev, { ...item, id } as FxItem]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, life);
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
            return <Burst key={it.id} x={it.x} y={it.y} color={it.color} count={it.count} effect={it.effect} />;
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
  /** Desplazamiento actual de la sacudida (px): los toques nativos lo descuentan, como hace la web. */
  const shakeX = useCallback(() => shake.value, [shake]);
  return { trigger, shakeStyle, flashStyle, shakeX };
}

/** Capa roja del destello; va como último hijo del campo. */
export function Flash({ style }: { style: ReturnType<typeof useHurtFx>['flashStyle'] }) {
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, style]} />;
}

const styles = StyleSheet.create({
  p: { position: 'absolute' },
  pieceText: { textAlign: 'center', includeFontPadding: false },
  glint: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.9)' },
  glyphBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glyph: { fontWeight: '800', textAlign: 'center' },
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

