import { memo, type ReactNode, useId, useState } from 'react';
import { type LayoutChangeEvent, PixelRatio, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { BackgroundProps, BackgroundSet } from './types';

/**
 * Fondos estáticos A: puntos, rayas, hexagonos, circuito, atardecer, oceano.
 * Cada uno es una vista con degradados (`backgroundImage`) y, encima, un `Svg` con los detalles.
 * Los valores salen de la maqueta (`config_logros/extras-fondos.css`); en miniatura (`thumb`) los
 * mosaicos, el sol y los montes van a media escala, como allí. No tienen animación.
 */

const scaleOf = (thumb: boolean) => (thumb ? 0.5 : 1);

/** Id propio de cada dibujo: en la web los ids de un SVG son de todo el documento. */
function useSvgId() {
  return 'bg' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Lado de un mosaico. En Android `react-native-svg` lo dibuja en un mapa de bits de tamaño entero
 * (trunca): se ajusta a píxeles completos para que no queden costuras entre mosaicos.
 */
function tileSide(v: number) {
  if (Platform.OS === 'web') return v;
  const ratio = PixelRatio.get();
  return (Math.round(v * ratio) + 0.01) / ratio;
}

interface Mosaic {
  /** Tamaño en px de pantalla. */
  w: number;
  h: number;
  /** Caja de las coordenadas del dibujo. */
  box: string;
  draw: ReactNode;
}

/** Mosaicos repetidos sobre todo el campo, desde la esquina superior izquierda (el último, arriba). */
function Mosaics({ items }: { items: Mosaic[] }) {
  const id = useSvgId();
  return (
    <Svg width="100%" height="100%" style={styles.svg}>
      <Defs>
        {items.map((m, i) => (
          <Pattern
            key={i}
            id={`${id}-${i}`}
            patternUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={tileSide(m.w)}
            height={tileSide(m.h)}
            viewBox={m.box}
          >
            {m.draw}
          </Pattern>
        ))}
      </Defs>
      {items.map((_, i) => (
        <Rect key={i} x={0} y={0} width="100%" height="100%" fill={`url(#${id}-${i})`} />
      ))}
    </Svg>
  );
}

function Scene({ color, image, children }: { color: string; image: string; children?: ReactNode }) {
  return (
    <View pointerEvents="none" style={[styles.fill, { backgroundColor: color, backgroundImage: image }]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------- puntos

const DOTS_BASE = 'linear-gradient(180deg, #1a1742 0%, #11142f 100%)';

const Dots = memo(function Dots({ thumb }: BackgroundProps) {
  const k = scaleOf(thumb);
  return (
    <Scene color="#141436" image={DOTS_BASE}>
      <Mosaics
        items={[
          {
            w: 22 * k,
            h: 22 * k,
            box: '0 0 22 22',
            draw: <Circle cx={11} cy={11} r={1.9} fill="#69c8ff" fillOpacity={0.4} />,
          },
          {
            w: 66 * k,
            h: 66 * k,
            box: '0 0 66 66',
            draw: <Circle cx={33} cy={33} r={3} fill="#be82ff" fillOpacity={0.55} />,
          },
        ]}
      />
    </Scene>
  );
});

// ---------------------------------------------------------------- rayas

const STRIPES_BASE = 'linear-gradient(160deg, #26164f 0%, #17154a 50%, #0d1c3f 100%)';

/**
 * Franjas de 11 px cada 26, en diagonal («/»). El mosaico es recto (lado 26·√2) y lleva dos
 * polígonos que calzan entre sí: así no hace falta girar el mosaico (en Android se vería dentado).
 */
const STRIPES_TILE = 'M0 0H11L0 11ZM26 0V11L11 26H0Z';

const Stripes = memo(function Stripes({ thumb }: BackgroundProps) {
  const side = 26 * Math.SQRT2 * scaleOf(thumb);
  return (
    <Scene color="#1b1445" image={STRIPES_BASE}>
      <Mosaics
        items={[{ w: side, h: side, box: '0 0 26 26', draw: <Path d={STRIPES_TILE} fill="#a078ff" fillOpacity={0.13} /> }]}
      />
    </Scene>
  );
});

// ---------------------------------------------------------------- hexágonos

const HEX_BASE = [
  'radial-gradient(80% 60% at 50% 0%, rgba(60,140,255,0.22), rgba(60,140,255,0) 100%)',
  'linear-gradient(180deg, #0c2550 0%, #0a1634 100%)',
].join(', ');

/** Panal en un mosaico de 28×49 (el de Hero Patterns). */
const HEX_TILE =
  'M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z';

const Hexagons = memo(function Hexagons({ thumb }: BackgroundProps) {
  const k = scaleOf(thumb);
  return (
    <Scene color="#0b1f46" image={HEX_BASE}>
      <Mosaics
        items={[
          {
            w: 44.8 * k,
            h: 78.4 * k,
            box: '0 0 28 49',
            draw: <Path d={HEX_TILE} fill="#66b8ff" fillOpacity={0.2} fillRule="evenodd" />,
          },
        ]}
      />
    </Scene>
  );
});

// ---------------------------------------------------------------- circuito

const CIRCUIT_BASE = 'linear-gradient(160deg, #07382c 0%, #042723 60%, #031c20 100%)';

/** Pistas en ángulo de 45° en un mosaico de 80×80. */
const CIRCUIT_TRACKS =
  'M0 20H22L34 32V46L42 54H80M80 20H58L48 30H40M0 54H12L20 62V80M20 0V10L28 18H34M52 0V14L60 22M52 80V70L60 62H64';

const CIRCUIT_PADS: readonly (readonly [number, number])[] = [
  [40, 30],
  [34, 18],
  [60, 22],
  [64, 62],
  [12, 54],
];

const Circuit = memo(function Circuit({ thumb }: BackgroundProps) {
  const k = scaleOf(thumb);
  return (
    <Scene color="#05302a" image={CIRCUIT_BASE}>
      <Mosaics
        items={[
          {
            w: 96 * k,
            h: 96 * k,
            box: '0 0 80 80',
            draw: (
              <>
                <Path d={CIRCUIT_TRACKS} fill="none" stroke="#3dffc0" strokeOpacity={0.26} strokeWidth={1.2} />
                {CIRCUIT_PADS.map(([x, y]) => (
                  <Circle
                    key={`${x}-${y}`}
                    cx={x}
                    cy={y}
                    r={2.5}
                    fill="#3dffc0"
                    fillOpacity={0.24}
                    stroke="#3dffc0"
                    strokeOpacity={0.45}
                    strokeWidth={1.2}
                  />
                ))}
              </>
            ),
          },
        ]}
      />
    </Scene>
  );
});

// ---------------------------------------------------------------- atardecer

/** Índigo, morado, malva y ámbar; el paso al ámbar va apagado para no hacer una franja roja. */
const SUNSET_SKY =
  'linear-gradient(180deg, #171a4a 0%, #2c205c 30%, #43205a 52%, #4a2a48 66%, #473234 75%, #53321a 87%, #3d2410 100%)';

const RIDGE_W = 200;
const RIDGE_H = 50;
/** Dos cordones; sobresalen 0,6 por la derecha para que no se note la unión con el siguiente. */
const RIDGE_FAR = 'M0 30L30 12L55 26L90 6L125 28L160 14L200 30H200.6V50H0Z';
const RIDGE_NEAR = 'M0 42L25 30L60 40L100 24L140 42L170 32L200 42H200.6V50H0Z';

/** Medidas desde el borde inferior, a escala 1. */
const SUN_Y = 34;
const SUN_GLOW = 90;
const SUN_BOX = SUN_Y + SUN_GLOW;

const Sunset = memo(function Sunset({ thumb }: BackgroundProps) {
  const k = scaleOf(thumb);
  const id = useSvgId();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const height = SUN_BOX * k;
  // montes repetidos a lo ancho, con un mosaico centrado bajo el sol
  const tile = RIDGE_W * k;
  const before = Math.ceil(Math.max(0, width - tile) / 2 / tile);
  const first = (width - tile) / 2 - before * tile;
  const tiles = width > 0 ? Math.ceil((width - first) / tile) : 0;
  const ridges = Array.from({ length: tiles }, (_, i) => first + i * tile);
  return (
    <View pointerEvents="none" style={[styles.fill, { backgroundColor: '#38205a', backgroundImage: SUNSET_SKY }]} onLayout={onLayout}>
      <Svg width="100%" height={height} style={styles.bottom}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset={0} stopColor="#ffba4c" stopOpacity={0.6} />
            <Stop offset={17 / SUN_GLOW} stopColor="#ffba4c" stopOpacity={0.6} />
            <Stop offset={19 / SUN_GLOW} stopColor="#ff9c28" stopOpacity={0.15} />
            <Stop offset={46 / SUN_GLOW} stopColor="#ff9c28" stopOpacity={0.05} />
            <Stop offset={1} stopColor="#ff9c28" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50%" cy={height - SUN_Y * k} r={SUN_GLOW * k} fill={`url(#${id})`} />
        {ridges.map((x, i) => (
          <G key={i} transform={`translate(${x} ${height - RIDGE_H * k}) scale(${k})`}>
            <Path d={RIDGE_FAR} fill="#3a1638" />
            <Path d={RIDGE_NEAR} fill="#1d0b24" />
          </G>
        ))}
      </Svg>
    </View>
  );
});

// ---------------------------------------------------------------- océano

/** Rayos de luz, claridad arriba, turquesa abajo y el agua. */
const OCEAN = [
  'linear-gradient(105deg, rgba(110,225,255,0) 24%, rgba(110,225,255,0.065) 33%, rgba(110,225,255,0) 42%, rgba(110,225,255,0) 58%, rgba(110,225,255,0.05) 65%, rgba(110,225,255,0) 74%)',
  'radial-gradient(70% 30% at 62% 0%, rgba(110,220,255,0.1), rgba(110,220,255,0) 100%)',
  'radial-gradient(80% 24% at 40% 100%, rgba(20,190,170,0.14), rgba(20,190,170,0) 100%)',
  'linear-gradient(180deg, #09385f 0%, #073055 38%, #052545 68%, #041c38 100%)',
].join(', ');

/** Burbujas: posición (% del campo), radio, grosor del borde (px) y opacidad. */
const BUBBLES = [
  { x: '16%', y: '78%', r: 5.4, w: 2, o: 0.42 },
  { x: '24%', y: '60%', r: 3.5, w: 1.6, o: 0.36 },
  { x: '78%', y: '70%', r: 6.95, w: 2.1, o: 0.34 },
  { x: '70%', y: '44%', r: 3.5, w: 1.6, o: 0.3 },
  { x: '88%', y: '28%', r: 2.8, w: 1.4, o: 0.3 },
  { x: '36%', y: '90%', r: 2.8, w: 1.4, o: 0.3 },
] as const;

const Ocean = memo(function Ocean({ thumb }: BackgroundProps) {
  return (
    <Scene color="#07315a" image={OCEAN}>
      {/* la miniatura va sin burbujas, como en la maqueta */}
      {thumb ? null : (
        <Svg width="100%" height="100%" style={styles.svg}>
          {BUBBLES.map((b) => (
            <Circle key={`${b.x}-${b.y}`} cx={b.x} cy={b.y} r={b.r} fill="none" stroke="#bef0ff" strokeWidth={b.w} strokeOpacity={b.o} />
          ))}
        </Svg>
      )}
    </Scene>
  );
});

export const BACKGROUNDS: BackgroundSet = {
  puntos: Dots,
  rayas: Stripes,
  hexagonos: Hexagons,
  circuito: Circuit,
  atardecer: Sunset,
  oceano: Ocean,
};

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  svg: { position: 'absolute', top: 0, left: 0 },
  bottom: { position: 'absolute', left: 0, bottom: 0 },
});
