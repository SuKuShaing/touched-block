import { memo, type ReactNode, useEffect, useId, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { lifecycle } from '@/platform/lifecycle';
import {
  fallOffset,
  FIREFLY_GROUPS,
  FIREFLY_REST_OPACITY,
  fireflyPose,
  GALAXY,
  GALAXY_ARMS,
  GALAXY_CORE,
  GALAXY_STARS,
  galaxySize,
  type Glow,
  GLOW,
  GLOW_CORE_COLOR,
  GLOW_HALO_COLOR,
  GLOW_THUMB,
  GRASS,
  RAIN,
  SNOW_BIG,
  SNOW_GROUND,
  SNOW_SMALL,
  SNOW_THUMB,
  type SnowLayer,
  type Spot,
  THUMB_SPOTS,
  wrap,
} from './animatedShapes';
import type { BackgroundProps, BackgroundSet } from './types';

/**
 * Fondos animados: lluvia, nieve, luciernagas y galaxia. Cada capa en movimiento tiene un solo
 * valor compartido y solo cambia transformaciones u opacidad (nada se vuelve a dibujar). Quedan
 * quietos con `paused`, con "reducir movimiento" y con la app en segundo plano; la miniatura
 * (`thumb`) es un dibujo fijo aparte, sin valores compartidos.
 */

// ---------------------------------------------------------------- movimiento

/** `false` con la app en segundo plano o la pestaña oculta. */
function useAppVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => lifecycle.onVisibility(setVisible), []);
  return visible;
}

/** Si la capa debe moverse ahora, y si pide movimiento reducido (cuadro de reposo). */
function useMotion(paused: boolean) {
  const reduced = useReducedMotion();
  const visible = useAppVisible();
  return { running: !paused && !reduced && visible, reduced };
}

/** Vueltas que avanzan sin fin mientras `running`; al detenerse queda donde estaba. */
function useLoop(ms: number, running: boolean, phase = 0): SharedValue<number> {
  const cycle = useSharedValue(phase);
  useEffect(() => {
    if (!running) return;
    const from = wrap(cycle.value);
    cycle.value = from;
    cycle.value = withRepeat(withTiming(from + 1, { duration: ms, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(cycle);
  }, [running, ms, cycle]);
  return cycle;
}

// en la web, la capa va aparte en la GPU para no repintar el SVG en cada cuadro
const gpu = (willChange: string): ViewStyle | null => (Platform.OS === 'web' ? ({ willChange } as unknown as ViewStyle) : null);
const GPU_MOVE = gpu('transform');
const GPU_GLOW = gpu('transform, opacity');

/** Prefijo único para los `id` de SVG (en la web son globales al documento). */
function useSvgId(): string {
  return 'fa' + useId().replace(/[^a-zA-Z0-9]/g, '');
}

// ---------------------------------------------------------------- piezas

function Base({ color, image, children }: { color: string; image: string; children: ReactNode }) {
  return (
    <View pointerEvents="none" style={[styles.fill, { backgroundColor: color, backgroundImage: image }]}>
      {children}
    </View>
  );
}

/** Un mosaico repetido que llena su contenedor. El dibujo va en px de diseño y `scale` lo achica. */
function Tiles({ w, h, scale = 1, children }: { w: number; h: number; scale?: number; children: ReactNode }) {
  const id = useSvgId();
  return (
    <Svg width="100%" height="100%" style={styles.fill}>
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" x={0} y={0} width={w * scale} height={h * scale}>
          <G transform={`scale(${scale})`}>{children}</G>
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Franja pegada al borde de abajo (lomas, pasto): `sink` px quedan fuera del campo. */
function Strip({ w, h, sink, scale = 1, children }: { w: number; h: number; sink: number; scale?: number; children: ReactNode }) {
  return (
    <View style={[styles.strip, { bottom: -sink, height: h * scale }]}>
      <Tiles w={w} h={h} scale={scale}>
        {children}
      </Tiles>
    </View>
  );
}

/** Capa un mosaico más alta que el campo, que baja justo un mosaico por vuelta. */
function Falling({ period, ms, running, reduced, children }: { period: number; ms: number; running: boolean; reduced: boolean; children: ReactNode }) {
  const cycle = useLoop(ms, running);
  const move = useAnimatedStyle(() => ({ transform: [{ translateY: reduced ? 0 : fallOffset(cycle.value, period) }] }), [reduced, period]);
  return (
    <Animated.View style={[styles.falling, { top: -period }, GPU_MOVE, move]} renderToHardwareTextureAndroid={running} shouldRasterizeIOS={running}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------- lluvia

const RAIN_TOP = 'radial-gradient(70% 22% at 30% 0%, rgba(140,170,220,0.2), rgba(140,170,220,0) 100%)';
const RAIN_BOTTOM = 'radial-gradient(80% 20% at 50% 100%, rgba(90,170,220,0.14), rgba(90,170,220,0) 100%)';
const RAIN_SKY = 'linear-gradient(180deg, #1c3050 0%, #152a47 45%, #0d1c32 100%)';
const RAIN_COLOR = '#152a47';

function RainTile({ scale }: { scale?: number }) {
  return (
    <Tiles w={RAIN.w} h={RAIN.h} scale={scale}>
      <Path d={RAIN.path} fill="none" stroke="#a9d4ff" strokeOpacity={0.42} strokeWidth={1.3} strokeLinecap="round" />
    </Tiles>
  );
}

function RainThumb() {
  return (
    <Base color={RAIN_COLOR} image={`${RAIN_TOP}, ${RAIN_SKY}`}>
      <RainTile scale={RAIN.thumbScale} />
    </Base>
  );
}

function RainField({ paused }: { paused: boolean }) {
  const motion = useMotion(paused);
  return (
    <Base color={RAIN_COLOR} image={`${RAIN_TOP}, ${RAIN_BOTTOM}, ${RAIN_SKY}`}>
      <Falling period={RAIN.h} ms={RAIN.ms} {...motion}>
        <RainTile />
      </Falling>
    </Base>
  );
}

const Rain = memo(function Rain({ thumb, paused }: BackgroundProps) {
  return thumb ? <RainThumb /> : <RainField paused={paused} />;
});

// ---------------------------------------------------------------- nieve

const SNOW_SKY = 'linear-gradient(180deg, #12244a 0%, #172f54 50%, #1e3a5e 100%)';
const SNOW_COLOR = '#1b355a';

function Flakes({ layer, scale }: { layer: SnowLayer; scale?: number }) {
  return (
    <Tiles w={layer.w} h={layer.h} scale={scale}>
      {layer.flakes.map(([x, y, r, o]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={layer.color} fillOpacity={o} />
      ))}
    </Tiles>
  );
}

function SnowGround({ sink, scale }: { sink: number; scale?: number }) {
  return (
    <Strip w={SNOW_GROUND.w} h={SNOW_GROUND.h} sink={sink} scale={scale}>
      {SNOW_GROUND.hills.map((hill) => (
        <G key={hill.fill}>
          <Path d={hill.line + SNOW_GROUND.close} fill={hill.fill} />
          <Path d={hill.line} fill="none" stroke={hill.crest} strokeWidth={1} />
        </G>
      ))}
    </Strip>
  );
}

function SnowThumb() {
  return (
    <Base color={SNOW_COLOR} image={SNOW_SKY}>
      <SnowGround sink={SNOW_GROUND.thumbSink} scale={SNOW_THUMB.ground} />
      <Flakes layer={SNOW_SMALL} scale={SNOW_THUMB.flakes} />
      <Flakes layer={SNOW_BIG} scale={SNOW_THUMB.flakes} />
    </Base>
  );
}

function SnowField({ paused }: { paused: boolean }) {
  const motion = useMotion(paused);
  return (
    <Base color={SNOW_COLOR} image={SNOW_SKY}>
      <SnowGround sink={SNOW_GROUND.sink} />
      {[SNOW_BIG, SNOW_SMALL].map((layer) => (
        <Falling key={layer.ms} period={layer.h} ms={layer.ms} {...motion}>
          <Flakes layer={layer} />
        </Falling>
      ))}
    </Base>
  );
}

const Snow = memo(function Snow({ thumb, paused }: BackgroundProps) {
  return thumb ? <SnowThumb /> : <SnowField paused={paused} />;
});

// ---------------------------------------------------------------- luciérnagas

const MEADOW_SKY = 'linear-gradient(180deg, #08202e 0%, #0a2e27 45%, #0c3520 75%, #0a2c17 100%)';
const MEADOW_GLOW = 'radial-gradient(80% 28% at 50% 100%, rgba(120,200,70,0.14), rgba(120,200,70,0) 100%)';
const MEADOW_COLOR = '#0a2e1f';

function Grass({ sink, scale }: { sink: number; scale?: number }) {
  return (
    <Strip w={GRASS.w} h={GRASS.h} sink={sink} scale={scale}>
      <Path d={GRASS.path} fill={GRASS.color} />
    </Strip>
  );
}

/** Una luz: un SVG apenas del tamaño del halo (mucho más liviano que una capa de todo el campo). */
function Light({ spot: [x, y], glow }: { spot: Spot; glow: Glow }) {
  const id = useSvgId();
  const side = glow.r * 2;
  return (
    <View style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: side, height: side, marginLeft: -glow.r, marginTop: -glow.r }}>
      <Svg width={side} height={side}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset={0} stopColor={GLOW_CORE_COLOR} stopOpacity={1} />
            <Stop offset={glow.core / glow.r} stopColor={GLOW_CORE_COLOR} stopOpacity={1} />
            <Stop offset={glow.mid / glow.r} stopColor={GLOW_HALO_COLOR} stopOpacity={glow.midOpacity} />
            <Stop offset={1} stopColor={GLOW_HALO_COLOR} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={glow.r} cy={glow.r} r={glow.r} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

function FireflyGroup({ ms, phase, spots, running, reduced }: (typeof FIREFLY_GROUPS)[number] & { running: boolean; reduced: boolean }) {
  const cycle = useLoop(ms, running, phase);
  const pulse = useAnimatedStyle(() => {
    const p = reduced ? { opacity: FIREFLY_REST_OPACITY, x: 0, y: 0 } : fireflyPose(cycle.value);
    return { opacity: p.opacity, transform: [{ translateX: p.x }, { translateY: p.y }] };
  }, [reduced]);
  return (
    <Animated.View style={[styles.fill, GPU_GLOW, pulse]}>
      {spots.map((spot) => (
        <Light key={spot.join('-')} spot={spot} glow={GLOW} />
      ))}
    </Animated.View>
  );
}

function FirefliesThumb() {
  return (
    <Base color={MEADOW_COLOR} image={MEADOW_SKY}>
      <Grass sink={GRASS.thumbSink} scale={GRASS.thumbScale} />
      {THUMB_SPOTS.map((spot) => (
        <Light key={spot.join('-')} spot={spot} glow={GLOW_THUMB} />
      ))}
    </Base>
  );
}

function FirefliesField({ paused }: { paused: boolean }) {
  const motion = useMotion(paused);
  return (
    <Base color={MEADOW_COLOR} image={`${MEADOW_GLOW}, ${MEADOW_SKY}`}>
      <Grass sink={GRASS.sink} />
      {FIREFLY_GROUPS.map((group) => (
        <FireflyGroup key={group.ms} {...group} {...motion} />
      ))}
    </Base>
  );
}

const Fireflies = memo(function Fireflies({ thumb, paused }: BackgroundProps) {
  return thumb ? <FirefliesThumb /> : <FirefliesField paused={paused} />;
});

// ---------------------------------------------------------------- galaxia

const GALAXY_HAZE = 'radial-gradient(70% 36% at 50% 42%, rgba(120,80,220,0.16), rgba(120,80,220,0) 100%)';
const GALAXY_SKY = 'linear-gradient(180deg, #0a0a2a 0%, #151140 45%, #0a0c28 100%)';
const GALAXY_THUMB_SKY = 'linear-gradient(180deg, #0a0a2a 0%, #161242 45%, #0a0c28 100%)';
const GALAXY_COLOR = '#12103a';

/** La espiral: dos brazos (el mismo trazo girado 180°) y el núcleo. Dibujo fijo. */
const Spiral = memo(function Spiral({ size }: { size: number }) {
  const id = useSvgId();
  return (
    <Svg width={size} height={size} viewBox="-100 -100 200 200">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          {GALAXY_CORE.map(([offset, color, opacity]) => (
            <Stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
          ))}
        </RadialGradient>
      </Defs>
      {GALAXY_ARMS.map((a, i) =>
        [0, 180].map((half) => (
          <G key={`${i}-${half}`} transform={`rotate(${a.turn + half}) scale(${a.scale})`}>
            <Path
              d={a.d}
              fill="none"
              stroke={a.color}
              strokeWidth={a.width}
              strokeOpacity={a.opacity}
              strokeLinecap="round"
              strokeDasharray={a.gap ? [0.1, a.gap] : undefined}
            />
          </G>
        )),
      )}
      <Circle cx={0} cy={0} r={GALAXY.coreRadius} fill={`url(#${id})`} />
    </Svg>
  );
});

/** Caja cuadrada centrada en el ancho, con su centro a `top` % del alto. */
const centered = (size: number, top: number): ViewStyle => ({
  position: 'absolute',
  left: '50%',
  top: `${top}%`,
  width: size,
  height: size,
  marginLeft: -size / 2,
  marginTop: -size / 2,
});

function GalaxyThumb() {
  return (
    <Base color={GALAXY_COLOR} image={GALAXY_THUMB_SKY}>
      <View style={centered(GALAXY.thumbSize, 50)}>
        <Spiral size={GALAXY.thumbSize} />
      </View>
    </Base>
  );
}

function GalaxyField({ cell, paused }: { cell: number; paused: boolean }) {
  const { running, reduced } = useMotion(paused);
  const cycle = useLoop(GALAXY.ms, running);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${reduced ? 0 : wrap(cycle.value) * 360}deg` }] }), [reduced]);
  const size = galaxySize(cell);
  return (
    <Base color={GALAXY_COLOR} image={`${GALAXY_HAZE}, ${GALAXY_SKY}`}>
      <Svg width="100%" height="100%" style={styles.fill}>
        {GALAXY_STARS.map(([x, y, r, o]) => (
          <Circle key={`${x}-${y}`} cx={`${x}%`} cy={`${y}%`} r={r} fill="#ffffff" fillOpacity={o} />
        ))}
      </Svg>
      <Animated.View style={[centered(size, GALAXY.centerY), GPU_MOVE, spin]} renderToHardwareTextureAndroid={running} shouldRasterizeIOS={running}>
        <Spiral size={size} />
      </Animated.View>
    </Base>
  );
}

const Galaxy = memo(function Galaxy({ cell, thumb, paused }: BackgroundProps) {
  return thumb ? <GalaxyThumb /> : <GalaxyField cell={cell} paused={paused} />;
});

// ----------------------------------------------------------------

export const BACKGROUNDS: BackgroundSet = {
  lluvia: Rain,
  nieve: Snow,
  luciernagas: Fireflies,
  galaxia: Galaxy,
};

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  strip: { position: 'absolute', left: 0, right: 0 },
  falling: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
