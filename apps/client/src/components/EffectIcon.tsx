import { type ComponentType, memo } from 'react';
import { StyleSheet, Text, type TextProps, View } from 'react-native';
import type { EffectId } from '@/cosmetics/ids';
import { HEART } from './heart';

/**
 * Dibujo fijo de cada efecto al destruir (filas y premios de la Colección). Los cuatro primeros
 * (Clásico, Chispas, Confeti y Corazones) son los de siempre; los demás resumen sus piezas de
 * `lib/fxShapes.ts` con el color de la maqueta (`config_logros/coleccion.js`). Están hechos con
 * vistas para verse igual en la web y en la app (solo Emojis y la estrella son texto).
 */

/** Lado de la caja en que está dibujado cada icono. */
const BOX = 36;
const BLUE = '#0091ff';
const WHITE = '#ffffff';

/** Esquina de una pieza a partir de su desplazamiento desde el centro. */
const at = (x: number, y: number) => ({ left: 17 + x, top: 17 + y });
/** Igual, desde el centro exacto de la caja (piezas simétricas). */
const mid = BOX / 2;

/** Caja de `w` × `h` centrada en (x, y) respecto al centro. */
const centered = (x: number, y: number, w: number, h = w) => ({ left: mid + x - w / 2, top: mid + y - h / 2, width: w, height: h });

/** Trazo recto entre dos puntos (relativos al centro): una barra girada. */
function Line({ from, to, width, color }: { from: [number, number]; to: [number, number]; width: number; color: string }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) + width * 0.6; // un poco más largo: las uniones quedan cerradas
  return (
    <View
      style={[
        styles.abs,
        centered(from[0] + dx / 2, from[1] + dy / 2, len, width),
        { borderRadius: width / 2, backgroundColor: color, transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }] },
      ]}
    />
  );
}

function Dot({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  return <View style={[styles.abs, centered(x, y, size), { borderRadius: size / 2, backgroundColor: color }]} />;
}

function Classic() {
  const pos: [number, number][] = [
    [-12, -10],
    [4, -12],
    [-4, 0],
    [6, 4],
    [-13, 6],
  ];
  return (
    <>
      {pos.map(([x, y], i) => (
        <View key={i} style={[styles.square, at(x, y), { backgroundColor: BLUE, opacity: 1 - i * 0.12 }]} />
      ))}
    </>
  );
}

function Sparks() {
  return (
    <>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const r = (deg * Math.PI) / 180;
        return (
          <View
            key={deg}
            style={[
              styles.spark,
              at(Math.cos(r) * 10 - 1.5, Math.sin(r) * 10 - 5),
              { backgroundColor: i % 2 ? '#fff3b0' : BLUE, transform: [{ rotate: `${deg + 90}deg` }] },
            ]}
          />
        );
      })}
    </>
  );
}

function ConfettiIcon() {
  const cols = ['#e5484d', '#e5a50a', '#30a46c', '#0091ff', '#d6409f'];
  const pos: [number, number, number][] = [
    [-12, -12, 20],
    [4, -13, -30],
    [-3, -2, 60],
    [8, 2, 15],
    [-12, 4, -50],
  ];
  return (
    <>
      {pos.map(([x, y, rot], i) => (
        <View key={i} style={[styles.confetti, at(x, y), { backgroundColor: cols[i], transform: [{ rotate: `${rot}deg` }] }]} />
      ))}
    </>
  );
}

function Hearts() {
  return (
    <>
      <Glyph style={[styles.heart, at(-13, -14), { fontSize: 13 }]}>{HEART}</Glyph>
      <Glyph style={[styles.heart, at(1, -9), { fontSize: 16 }]}>{HEART}</Glyph>
      <Glyph style={[styles.heart, at(-10, 1), { fontSize: 11 }]}>{HEART}</Glyph>
    </>
  );
}

/** Texto que no crece con el tamaño de letra del sistema (el dibujo es de medida fija). */
function Glyph({ style, children }: { style: TextProps['style']; children: string }) {
  return (
    <Text style={style} allowFontScaling={false} selectable={false}>
      {children}
    </Text>
  );
}

function Emojis() {
  return <Glyph style={styles.emoji}>😎</Glyph>;
}

function Bubbles() {
  // [x, y, diámetro] desde el centro
  const bubbles: [number, number, number][] = [
    [-6, 5, 18],
    [8, -8, 13],
    [10, 9, 8],
  ];
  return (
    <>
      {bubbles.map(([x, y, d], i) => (
        <View key={i} style={[styles.abs, styles.bubble, centered(x, y, d), { borderRadius: d / 2 }]}>
          <View style={[styles.glint, { left: d * 0.16, top: d * 0.12, width: d * 0.24, height: d * 0.24, borderRadius: d * 0.12 }]} />
        </View>
      ))}
    </>
  );
}

function Waves() {
  const color = '#5ad0c0';
  return (
    <>
      <View style={[styles.abs, centered(0, 0, 32), { borderRadius: 16, borderWidth: 2.5, borderColor: color }]} />
      <View style={[styles.abs, centered(0, 0, 20), { borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' }]} />
      <Dot x={0} y={0} size={8} color={color} />
    </>
  );
}

function Bolts() {
  const color = '#e8f6ff';
  return (
    <>
      <Line from={[5, -15]} to={[-6, 1]} width={4} color={color} />
      <Line from={[-6, 1]} to={[5, -1]} width={4} color={color} />
      <Line from={[5, -1]} to={[-5, 15]} width={3} color={color} />
      <Line from={[-14, -9]} to={[-9, -5]} width={2} color="#77ccff" />
      <Line from={[9, 7]} to={[15, 10]} width={2} color="#77ccff" />
    </>
  );
}

/** Moneda de frente (ancha) o de canto (angosta, girando). */
function Coin({ x, y, w, h, sign }: { x: number; y: number; w: number; h: number; sign?: boolean }) {
  return (
    <View style={[styles.abs, styles.coin, centered(x, y, w, h), { borderRadius: h / 2 }]}>
      {sign ? <Glyph style={styles.coinSign}>$</Glyph> : null}
    </View>
  );
}

function Coins() {
  return (
    <>
      <Coin x={9} y={-9} w={7} h={14} />
      <Coin x={-12} y={-8} w={10} h={10} />
      <Coin x={0} y={5} w={21} h={21} sign />
    </>
  );
}

function Fireworks() {
  const color = '#ff9f43';
  const ring = (n: number, radius: number, size: number, turn: number, tone: (i: number) => string) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + turn;
      return <Dot key={`${radius}-${i}`} x={Math.cos(a) * radius} y={Math.sin(a) * radius} size={size} color={tone(i)} />;
    });
  return (
    <>
      {ring(8, 14, 4.5, 0, (i) => (i % 4 === 0 ? WHITE : color))}
      {ring(5, 7.5, 3.5, 0.4, () => color)}
      <Dot x={0} y={0} size={5} color={WHITE} />
    </>
  );
}

function Pixels() {
  // los tres tonos del estallido, a partir del verde de la maqueta
  const tones = ['#7dff8a', '#c5ffca', '#67d171'];
  // [x, y, tono]: una rejilla de 4×3 que se está separando
  const pixels: [number, number, number][] = [
    [-14, -12, 0],
    [-5, -14, 1],
    [4, -11, 2],
    [13, -14, 0],
    [-12, -1, 1],
    [-4, -3, 2],
    [4, -2, 0],
    [14, -1, 1],
    [-14, 12, 2],
    [-4, 9, 0],
    [5, 12, 1],
    [12, 9, 2],
  ];
  return (
    <>
      {pixels.map(([x, y, tone], i) => (
        <View key={i} style={[styles.abs, centered(x, y, 7), { backgroundColor: tones[tone] }]} />
      ))}
    </>
  );
}

/** Dirección de caída de las estrellas fugaces (la de `fxShapes`): hacia abajo a la izquierda. */
const FALL_DEG = 148;

function ShootingStar({ x, y, size, tail }: { x: number; y: number; size: number; tail: number }) {
  const r = (FALL_DEG * Math.PI) / 180;
  const box = size * 1.2;
  return (
    <>
      <View
        style={[
          styles.abs,
          centered(x - (Math.cos(r) * tail) / 2, y - (Math.sin(r) * tail) / 2, tail, 3),
          {
            borderRadius: 1.5,
            backgroundImage: 'linear-gradient(90deg, rgba(255, 226, 122, 0), rgba(255, 226, 122, 0.95))',
            transform: [{ rotate: `${FALL_DEG}deg` }],
          },
        ]}
      />
      <Glyph style={[styles.abs, styles.star, centered(x, y, box), { fontSize: size, lineHeight: box }]}>★</Glyph>
    </>
  );
}

function ShootingStars() {
  return (
    <>
      <ShootingStar x={-9} y={5} size={14} tail={22} />
      <ShootingStar x={5} y={10} size={10} tail={16} />
      <ShootingStar x={1} y={-10} size={8} tail={14} />
    </>
  );
}

const DRAWINGS: Record<EffectId, ComponentType> = {
  normal: Classic,
  chispas: Sparks,
  emojis: Emojis,
  confeti: ConfettiIcon,
  burbujas: Bubbles,
  ondas: Waves,
  rayos: Bolts,
  monedas: Coins,
  pixeles: Pixels,
  fugaces: ShootingStars,
  fuegos: Fireworks,
  corazones: Hearts,
};

/** Icono de un efecto en una caja de `size` px. Un id desconocido se dibuja como Clásico. */
export const EffectIcon = memo(function EffectIcon({ id, size = BOX }: { id: string; size?: number }) {
  const Drawing = DRAWINGS[id as EffectId] ?? Classic;
  const offset = (size - BOX) / 2;
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <View style={[styles.box, { left: offset, top: offset, transform: [{ scale: size / BOX }] }]}>
        <Drawing />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { position: 'absolute', width: BOX, height: BOX },
  abs: { position: 'absolute' },
  heart: { position: 'absolute', color: '#d6409f', fontWeight: '800' },
  spark: { position: 'absolute', width: 3, height: 10, borderRadius: 2 },
  confetti: { position: 'absolute', width: 5, height: 9, borderRadius: 1 },
  square: { position: 'absolute', width: 8, height: 8, borderRadius: 2.5 },
  emoji: { position: 'absolute', left: 0, right: 0, top: 2, fontSize: 25, lineHeight: 32, textAlign: 'center' },
  bubble: { backgroundColor: 'rgba(143,216,255,0.25)', borderWidth: 1.5, borderColor: '#8fd8ff' },
  glint: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.85)' },
  coin: { backgroundColor: '#ffc933', borderWidth: 2, borderColor: '#c98a00', alignItems: 'center', justifyContent: 'center' },
  coinSign: { color: '#7a5200', fontSize: 12, lineHeight: 15, fontWeight: '800' },
  star: { color: '#fff3b0', textAlign: 'center' },
});
