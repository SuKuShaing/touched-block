import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * Confeti de las celebraciones: papelitos que salen disparados hacia arriba desde (x, y), giran,
 * se dan vuelta y caen frenados por el aire. Solo `View` + Reanimated (sin Skia ni librerías),
 * igual en la web y en Android. Un único valor animado mueve todos los papelitos (cada uno calcula
 * su posición a partir de él), así que cuesta poco. Para repetirlo, se vuelve a montar (`key`).
 * Quien lo usa no lo muestra con "reducir movimiento".
 */

/** Duración total (ms). */
export const CONFETTI_MS = 2600;
const COLORS = ['#ffd166', '#77ccff', '#5fe08a', '#ff6b9a', '#b18cff', '#ff9f43', '#ffffff'];
/** Gravedad (px/s²) y freno del aire (1/s): la caída se estabiliza en G/K ≈ 560 px/s. */
const G = 900;
const K = 1.6;

interface Piece {
  vx: number;
  vy: number;
  rot0: number;
  spin: number;
  flips: number;
  delay: number;
  w: number;
  h: number;
  color: string;
  round: boolean;
}

function makePieces(n: number): Piece[] {
  const r = Math.random; // solo decoración: el motor no participa
  return Array.from({ length: n }, (_, i) => {
    // abanico hacia arriba (−165° … −15°), más fuerte al centro
    const a = ((-165 + r() * 150) * Math.PI) / 180;
    const speed = 520 + r() * 620;
    return {
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed * 1.15,
      rot0: r() * 360,
      spin: (r() < 0.5 ? -1 : 1) * (240 + r() * 600),
      flips: 2 + r() * 4,
      delay: r() * 0.08,
      w: 6 + r() * 5,
      h: 9 + r() * 7,
      color: COLORS[i % COLORS.length],
      round: i % 5 === 0,
    };
  });
}

function PieceView({ p, t }: { p: Piece; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (t.value - p.delay) / (1 - p.delay)));
    const s = (local * CONFETTI_MS) / 1000;
    const e = (1 - Math.exp(-K * s)) / K;
    const x = p.vx * e;
    const y = p.vy * e + (G / K) * (s - e);
    return {
      opacity: local <= 0 ? 0 : local > 0.75 ? (1 - local) / 0.25 : 1,
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${p.rot0 + p.spin * local}deg` },
        { scaleY: Math.cos(local * p.flips * Math.PI * 2) },
        { scale: Math.min(1, 0.3 + local * 8) },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.piece, { width: p.w, height: p.h, marginLeft: -p.w / 2, marginTop: -p.h / 2, backgroundColor: p.color }, p.round && { borderRadius: p.w / 2, height: p.w }, style]}
    />
  );
}

export const Confetti = memo(function Confetti({ x, y, count = 44 }: { x: number; y: number; count?: number }) {
  const [pieces] = useState(() => makePieces(count));
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: CONFETTI_MS, easing: Easing.linear });
  }, [t]);
  return (
    <View pointerEvents="none" style={[styles.origin, { left: x, top: y }]}>
      {pieces.map((p, i) => (
        <PieceView key={i} p={p} t={t} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  origin: { position: 'absolute', width: 0, height: 0 },
  piece: { position: 'absolute', left: 0, top: 0, borderRadius: 2 },
});
