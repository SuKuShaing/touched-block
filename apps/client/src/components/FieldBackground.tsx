import { memo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useActiveBackground } from '@/cosmetics/active';

/**
 * Fondo del campo de juego (premio cosmético): `liso` (nada), `grilla`, `estrellas` o `aurora`.
 * Va como **primer hijo** del campo, detrás de los bloques:
 *
 *   <Animated.View style={styles.field} …>
 *     <FieldBackground />
 *     {bloques…}
 *
 * Sin `id` usa el fondo elegido en la Colección (validado contra lo desbloqueado); con `id` dibuja
 * ese (vistas previas). Es estático (sin animación por cuadro), no recibe toques
 * (`pointerEvents="none"`), no se parece a un bloque y está memorizado: no se vuelve a dibujar
 * cuando la partida avanza.
 */
export const FieldBackground = memo(function FieldBackground({ id, cell = 44 }: { id?: string; cell?: number }) {
  const active = useActiveBackground();
  const bg = id ?? active;
  if (bg === 'grilla') return <Grid cell={cell} />;
  if (bg === 'estrellas') return <Stars />;
  if (bg === 'aurora') return <Aurora />;
  return null;
});

// ---------------------------------------------------------------- grilla

function Grid({ cell }: { cell: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.round(width) !== size.w || Math.round(height) !== size.h) setSize({ w: Math.round(width), h: Math.round(height) });
  };
  const cols = Math.floor(size.w / cell);
  const rows = Math.floor(size.h / cell);
  // centrada: lo que sobra se reparte a los dos lados
  const ox = (size.w - cols * cell) / 2;
  const oy = (size.h - rows * cell) / 2;
  return (
    <View pointerEvents="none" style={styles.fill} onLayout={onLayout}>
      {Array.from({ length: cols + 1 }, (_, i) => (
        <View key={'v' + i} style={[styles.vLine, { left: ox + i * cell }]} />
      ))}
      {Array.from({ length: rows + 1 }, (_, j) => (
        <View key={'h' + j} style={[styles.hLine, { top: oy + j * cell }]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- estrellas

interface Star {
  x: number;
  y: number;
  s: number;
  o: number;
}

/** Posiciones fijas (pseudoaleatorias con semilla), en % del campo: se ven igual en cualquier tamaño. */
const STARS: Star[] = (() => {
  let seed = 20261112;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647; // Park–Miller
    return seed / 2147483647;
  };
  return Array.from({ length: 46 }, () => ({ x: rnd() * 100, y: rnd() * 100, s: 1.5 + rnd() * 1.8, o: 0.18 + rnd() * 0.45 }));
})();

function Stars() {
  return (
    <View pointerEvents="none" style={styles.fill}>
      {STARS.map((st, i) => (
        <View
          key={i}
          style={[
            styles.star,
            { left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, borderRadius: st.s / 2, opacity: st.o },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- aurora

/**
 * Luces suaves arriba del campo: degradados radiales en una sola vista (sin desenfoque, que es
 * caro). `backgroundImage` lo soportan react-native-web y React Native ≥ 0.80.
 */
const AURORA = [
  'radial-gradient(75% 30% at 18% 0%, rgba(61,220,151,0.16), rgba(61,220,151,0) 100%)',
  'radial-gradient(70% 28% at 80% 4%, rgba(79,140,255,0.15), rgba(79,140,255,0) 100%)',
  'radial-gradient(90% 26% at 50% 18%, rgba(176,108,255,0.10), rgba(176,108,255,0) 100%)',
].join(', ');

function Aurora() {
  return <View pointerEvents="none" style={[styles.fill, { backgroundImage: AURORA }]} />;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  hLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  star: { position: 'absolute', backgroundColor: '#ffffff' },
});
