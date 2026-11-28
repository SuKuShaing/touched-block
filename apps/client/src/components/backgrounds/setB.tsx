import { memo, type ReactNode, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { BackgroundProps, BackgroundSet } from './types';

/**
 * Fondos estáticos B: bosque, nebulosa, topografia, ciudad, cristales, vitral. Colores y medidas
 * copiados de la maqueta (`config_logros/extras-fondos.css`): los degradados van en
 * `backgroundImage` (porcentajes) y los dibujos en react-native-svg.
 *
 * Para que se vean igual en la web y en Android: los `Pattern` van siempre en x=0, y=0 (Android
 * ignora ese origen; lo que se corre o se pega abajo se mueve con su `View`), sin `viewBox`
 * (se escala con un `G`), sin `Use` ni `vectorEffect` (las copias se escriben y el grosor del
 * trazo se divide por la escala), y con ids propios de cada instancia (en la web son globales).
 */

/** La miniatura dibuja mosaicos, luna y demás figuras a media escala (`--k` en la maqueta). */
const scaleFor = (thumb: boolean) => (thumb ? 0.5 : 1);

/** Id válido dentro de `url(#…)` y distinto en cada instancia. */
function useSvgId(name: string) {
  return `bg-${name}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function Scene({ color, image, children }: { color: string; image?: string; children?: ReactNode }) {
  return (
    <View pointerEvents="none" style={[styles.fill, { backgroundColor: color, backgroundImage: image }]}>
      {children}
    </View>
  );
}

/** Cubre su `View` repitiendo un mosaico de `w`×`h` (medidas del dibujo, antes de escalar por `s`). */
function Tiles({ name, w, h, s, children }: { name: string; w: number; h: number; s: number; children: ReactNode }) {
  const id = useSvgId(name);
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" x={0} y={0} width={w * s} height={h * s}>
          <G transform={`scale(${s})`}>{children}</G>
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Franja de un mosaico de alto pegada abajo; `bottom` y `left` (≤ 0) van en medidas del dibujo. */
function Strip({
  name,
  w,
  h,
  k,
  bottom,
  left = 0,
  children,
}: {
  name: string;
  w: number;
  h: number;
  k: number;
  bottom: number;
  left?: number;
  children: ReactNode;
}) {
  return (
    <View style={[styles.strip, { left: left * k, bottom: bottom * k, height: h * k }]}>
      <Tiles name={name} w={w} h={h} s={k}>
        {children}
      </Tiles>
    </View>
  );
}

// ---------------------------------------------------------------- estrellas sueltas

/** x e y en % del campo, radio en px, opacidad del centro y color. */
type Dot = readonly [x: number, y: number, r: number, opacity: number, color: string];

/** Puntos de luz que se apagan hacia el borde (no cambian de tamaño en la miniatura). */
function Dots({ dots }: { dots: readonly Dot[] }) {
  const id = useSvgId('dot');
  const colors = [...new Set(dots.map((d) => d[4]))];
  return (
    <Svg width="100%" height="100%" style={styles.fill}>
      <Defs>
        {colors.map((c, i) => (
          <RadialGradient key={c} id={`${id}-${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c} stopOpacity={1} />
            <Stop offset="1" stopColor={c} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {dots.map(([x, y, r, opacity, c], i) => (
        <Circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill={`url(#${id}-${colors.indexOf(c)})`} fillOpacity={opacity} />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------- bosque nocturno

const PINES_NEAR = 'M18 12L29 38H23L33 60H3L13 38H7ZM58 26L68 46H63L72 62H44L53 46H48ZM96 6L109 36H102L114 62H78L90 36H83ZM0 61H120V70H0Z';
const PINES_FAR = 'M12 10L21 30H17L25 46H0L7 30H3ZM42 18L50 34H46L53 46H31L38 34H34ZM70 4L80 26H75L85 46H55L65 26H60ZM0 45H90V60H0Z';

/** Luna de radio 8 con su halo hasta los 46 px, centrada en el 82 % × 11 % del campo. */
function Moon({ k }: { k: number }) {
  const id = useSvgId('moon');
  const r = 46;
  return (
    <View style={[styles.moon, { width: 2 * r * k, height: 2 * r * k, marginLeft: -r * k, marginTop: -r * k }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${2 * r} ${2 * r}`}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ecf8ff" stopOpacity={0.75} />
            <Stop offset={8 / r} stopColor="#ecf8ff" stopOpacity={0.75} />
            <Stop offset={10 / r} stopColor="#c8e6ff" stopOpacity={0.1} />
            <Stop offset={26 / r} stopColor="#c8e6ff" stopOpacity={0.03} />
            <Stop offset="1" stopColor="#c8e6ff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const Forest = memo(function Forest({ thumb }: BackgroundProps) {
  const k = scaleFor(thumb);
  return (
    <Scene color="#0a3329" image="linear-gradient(180deg, #0b2740 0%, #0b3739 40%, #0b3a28 68%, #082a1a 100%)">
      <Moon k={k} />
      <Strip name="pines-far" w={90} h={62} k={k} bottom={12} left={40 - 90}>
        <Path d={PINES_FAR} fill="#145036" />
      </Strip>
      <Strip name="pines" w={120} h={72} k={k} bottom={-2}>
        <Path d={PINES_NEAR} fill="#03130b" />
      </Strip>
    </Scene>
  );
});

// ---------------------------------------------------------------- nebulosa

const NEBULA = [
  'radial-gradient(75% 40% at 20% 24%, rgba(138,70,240,0.4), rgba(138,70,240,0) 100%)',
  'radial-gradient(60% 34% at 86% 50%, rgba(20,170,200,0.26), rgba(20,170,200,0) 100%)',
  'radial-gradient(70% 32% at 34% 84%, rgba(190,60,200,0.24), rgba(190,60,200,0) 100%)',
  'linear-gradient(180deg, #150c36 0%, #1c0f42 50%, #100a2e 100%)',
].join(', ');

const WHITE = '#ffffff';
const NEBULA_STARS: readonly Dot[] = [
  [12, 18, 1, 0.85, WHITE],
  [33, 8, 1, 0.6, WHITE],
  [58, 14, 1.6, 0.85, WHITE],
  [86, 22, 1, 0.7, WHITE],
  [8, 52, 1, 0.65, WHITE],
  [47, 44, 1.6, 0.75, WHITE],
  [92, 58, 1, 0.65, WHITE],
  [22, 74, 1, 0.7, WHITE],
  [66, 80, 1.6, 0.8, WHITE],
  [82, 92, 1, 0.65, WHITE],
  [38, 96, 1, 0.6, WHITE],
  [4, 90, 1, 0.6, WHITE],
];

const Nebula = memo(function Nebula() {
  return (
    <Scene color="#1c0f42" image={NEBULA}>
      <Dots dots={NEBULA_STARS} />
    </Scene>
  );
});

// ---------------------------------------------------------------- topografía

const TOPO = [
  'radial-gradient(80% 40% at 70% 12%, rgba(224,200,104,0.1), rgba(224,200,104,0) 100%)',
  'linear-gradient(165deg, #2b2b11 0%, #1c2310 50%, #11200f 100%)',
].join(', ');

const GOLD = '#e0c868';
/** La curva de nivel que, girada y escalada, forma todos los cerros. */
const CONTOUR = 'M-30 0C-30-20-10-32 8-27C30-22 37-8 30 10C22 29-3 33-18 25C-29 19-30 10-30 0Z';

/** Cerros del mosaico de 200×200: centro y curvas `[giro, escala, opacidad del trazo]`. */
const HILLS: readonly { x: number; y: number; rings: readonly (readonly [number, number, number])[] }[] = [
  { x: 57, y: 59, rings: [[0, 0.28, 0.2], [8, 0.56, 0.2], [14, 0.86, 0.4], [18, 1.18, 0.2], [24, 1.52, 0.15]] },
  { x: 143, y: 141, rings: [[170, 0.32, 0.2], [160, 0.64, 0.2], [152, 0.95, 0.4], [146, 1.24, 0.2], [138, 1.55, 0.15]] },
  { x: 162, y: 38, rings: [[80, 0.28, 0.24], [66, 0.64, 0.24]] },
  { x: 36, y: 163, rings: [[-70, 0.3, 0.24], [-55, 0.7, 0.24]] },
];

const Topography = memo(function Topography({ thumb }: BackgroundProps) {
  const k = scaleFor(thumb);
  return (
    <Scene color="#1c2310" image={TOPO}>
      <Tiles name="topo" w={200} h={200} s={k}>
        {HILLS.flatMap(({ x, y, rings }) =>
          rings.map(([turn, s, opacity]) => (
            <Path
              key={`${x}-${s}`}
              d={CONTOUR}
              transform={`translate(${x} ${y}) rotate(${turn}) scale(${s})`}
              fill="none"
              stroke={GOLD}
              // 1,1 px en pantalla a cualquier escala
              strokeWidth={1.1 / (s * k)}
              strokeOpacity={opacity}
            />
          )),
        )}
        <Path d="M57 55l3.5 6h-7zM143 137l3.5 6h-7z" fill={GOLD} fillOpacity={0.5} />
      </Tiles>
    </Scene>
  );
});

// ---------------------------------------------------------------- ciudad nocturna

const CITY = [
  'radial-gradient(90% 34% at 50% 100%, rgba(150,90,230,0.34), rgba(150,90,230,0) 100%)',
  'linear-gradient(180deg, #080d28 0%, #121a45 42%, #231f5c 72%, #342866 100%)',
].join(', ');

const CITY_STARS: readonly Dot[] = [
  [14, 12, 1.2, 0.8, WHITE],
  [46, 6, 1, 0.6, WHITE],
  [78, 18, 1.2, 0.75, WHITE],
  [30, 30, 1, 0.55, WHITE],
  [90, 40, 1, 0.55, WHITE],
];

const City = memo(function City({ thumb }: BackgroundProps) {
  const k = scaleFor(thumb);
  return (
    <Scene color="#131a45" image={CITY}>
      <Dots dots={CITY_STARS} />
      <Strip name="city-far" w={200} h={150} k={k} bottom={20} left={60 - 200}>
        <Path
          d="M0 150V80H22V50H40V90H58V30H66V18H70V30H80V90H104V60H128V100H140V42H166V76H180V58H200V150Z"
          fill="#1b2158"
        />
        <Path
          d="M26 58h3v4h-3zM33 70h3v4h-3zM62 40h3v4h-3zM72 52h3v4h-3zM62 68h3v4h-3zM110 68h3v4h-3zM119 80h3v4h-3zM146 52h3v4h-3zM157 62h3v4h-3zM146 78h3v4h-3zM188 68h3v4h-3z"
          fill="#78c8ff"
          fillOpacity={0.38}
        />
      </Strip>
      <Strip name="city" w={240} h={112} k={k} bottom={-2}>
        <Path
          d="M0 110V62H30V40H54V74H76V54H96V30H98V54H118V84H146V46H182V68H200V36H226V66H240V110Z"
          fill="#070a1c"
        />
        <Path
          d="M6 70h4v5H6zM36 48h4v5h-4zM44 76h4v5h-4zM82 62h4v5h-4zM104 76h4v5h-4zM152 54h4v5h-4zM172 68h4v5h-4zM206 44h4v5h-4zM214 86h4v5h-4zM124 92h4v5h-4z"
          fill="#ffd36a"
          fillOpacity={0.72}
        />
        <Path
          d="M17 70h4v5h-4zM6 86h4v5H6zM45 48h4v5h-4zM36 62h4v5h-4zM82 90h4v5h-4zM104 62h4v5h-4zM135 92h4v5h-4zM165 54h4v5h-4zM152 82h4v5h-4zM188 78h4v5h-4zM215 58h4v5h-4zM206 72h4v5h-4z"
          fill="#ffd36a"
          fillOpacity={0.32}
        />
        <Circle cx={97} cy={29} r={1.8} fill="#7fe6ff" />
      </Strip>
    </Scene>
  );
});

// ---------------------------------------------------------------- cristales

const CRYSTALS = [
  'radial-gradient(80% 32% at 40% 100%, rgba(40,200,210,0.26), rgba(40,200,210,0) 100%)',
  'radial-gradient(70% 34% at 8% 6%, rgba(130,80,230,0.3), rgba(130,80,230,0) 100%)',
  'linear-gradient(180deg, #170b38 0%, #17103c 48%, #0b2640 100%)',
].join(', ');

const CYAN_LIGHT = '#d2faff';
const VIOLET_LIGHT = '#e6d7ff';
const CRYSTAL_SPARKS: readonly Dot[] = [
  [18, 22, 1.6, 0.9, CYAN_LIGHT],
  [58, 38, 1.2, 0.8, VIOLET_LIGHT],
  [84, 60, 1.6, 0.7, CYAN_LIGHT],
  [30, 66, 1.2, 0.75, VIOLET_LIGHT],
];

/** Cada cristal tiene dos caras (oscura y clara) y el filo de su color. */
interface Crystals {
  edge: string;
  dark: string;
  light: string;
}
const VIOLET = { edge: '#b99bff', dark: '#281760', light: '#412884' };
const TEAL = { edge: '#7ff0ff', dark: '#093a48', light: '#105866' };

function faces(c: Crystals, opacity: number, pairs: readonly (readonly [string, string])[]) {
  return pairs.flatMap(([dark, light]) =>
    [
      [dark, c.dark],
      [light, c.light],
    ].map(([d, fill]) => (
      <Path key={d} d={d} fill={fill} stroke={c.edge} strokeWidth={1} strokeOpacity={opacity} strokeLinejoin="round" />
    )),
  );
}

const Crystal = memo(function Crystal({ thumb }: BackgroundProps) {
  const k = scaleFor(thumb);
  return (
    <Scene color="#17103c" image={CRYSTALS}>
      <Dots dots={CRYSTAL_SPARKS} />
      {/* los que cuelgan de la esquina: un solo grupo, sin repetir */}
      <View style={[styles.ceiling, { width: 120 * k, height: 76 * k }]}>
        <Svg width="100%" height="100%" viewBox="0 0 120 76">
          {faces(TEAL, 0.45, [['M42 0L38 40L46 54L52 0Z', 'M52 0L46 54L56 42L64 0Z']])}
          {faces(VIOLET, 0.45, [
            ['M68 0L72 54L84 72L82 0Z', 'M82 0L84 72L96 56L96 0Z'],
            ['M100 0L102 24L108 34L109 0Z', 'M109 0L108 34L116 24L118 0Z'],
          ])}
        </Svg>
      </View>
      <Strip name="crystals" w={220} h={130} k={k} bottom={-2}>
        {faces(VIOLET, 0.5, [
          ['M15 128L1 76L14 60L28 128Z', 'M28 128L14 60L27 76L41 128Z'],
          ['M147 128L153 58L170 38L164 128Z', 'M164 128L170 38L187 58L181 128Z'],
          ['M105 128L109 112L116 104L112 128Z', 'M112 128L116 104L123 112L119 128Z'],
        ])}
        {faces(TEAL, 0.5, [
          ['M37 128L35 40L50 22L52 128Z', 'M52 128L50 22L65 40L67 128Z'],
          ['M66 128L78 86L88 74L76 128Z', 'M76 128L88 74L98 86L86 128Z'],
          ['M125 128L119 101L128 90L134 128Z', 'M134 128L128 90L137 101L143 128Z'],
          ['M179 128L195 83L206 70L190 128Z', 'M190 128L206 70L217 83L201 128Z'],
        ])}
      </Strip>
    </Scene>
  );
});

// ---------------------------------------------------------------- vitral

/** Vidrios del dibujo de 150×150, por color. */
const PANES: readonly (readonly [fill: string, d: string])[] = [
  ['#122a6e', 'M0 0L56 8L40 44ZM40 44L94 96L60 108ZM94 96L155 92L150 150Z'],
  ['#183c7c', 'M0 0L40 44L-7 54ZM108 60L143 54L155 92L94 96Z'],
  ['#2f1866', 'M56 8L92-6L108 60L40 44ZM5 92L60 108L56 158ZM94 96L150 150L92 144Z'],
  ['#0a4652', 'M92-6L150 0L108 60ZM5 92L56 158L0 150Z'],
  ['#0f462c', 'M-7 54L40 44L60 108L5 92ZM60 108L94 96L92 144L56 158Z'],
  ['#47380e', 'M150 0L143 54L108 60ZM40 44L108 60L94 96Z'],
];

/** El dibujo y sus ocho vecinos, para que los bordes del mosaico calcen (en este orden). */
const COPIES: readonly (readonly [number, number])[] = [
  [0, 0],
  [150, 0],
  [-150, 0],
  [0, 150],
  [0, -150],
  [150, 150],
  [-150, 150],
  [150, -150],
  [-150, -150],
];

/** Luz cálida arriba y oscurecido hacia abajo, encima de los vidrios. */
const GLASS_SHADE = [
  'radial-gradient(75% 45% at 50% 20%, rgba(255,232,180,0.12), rgba(255,232,180,0) 100%)',
  'linear-gradient(180deg, rgba(6,6,15,0.18) 0%, rgba(6,6,15,0.24) 45%, rgba(6,6,15,0.42) 100%)',
].join(', ');

const StainedGlass = memo(function StainedGlass({ thumb }: BackgroundProps) {
  // en la miniatura el mosaico es de 56 px (no la mitad de 196), como en la maqueta
  const s = (thumb ? 56 : 196) / 150;
  return (
    <Scene color="#122456">
      <Tiles name="glass" w={150} h={150} s={s}>
        {COPIES.map(([x, y]) => (
          <G key={`${x},${y}`} transform={`translate(${x} ${y})`}>
            {PANES.map(([fill, d]) => (
              <Path key={fill} d={d} fill={fill} stroke="#06060f" strokeWidth={3.5} strokeLinejoin="round" />
            ))}
          </G>
        ))}
      </Tiles>
      <View style={[styles.fill, { backgroundImage: GLASS_SHADE }]} />
    </Scene>
  );
});

export const BACKGROUNDS: BackgroundSet = {
  bosque: Forest,
  nebulosa: Nebula,
  topografia: Topography,
  ciudad: City,
  cristales: Crystal,
  vitral: StainedGlass,
};

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  strip: { position: 'absolute', right: 0 },
  moon: { position: 'absolute', left: '82%', top: '11%' },
  ceiling: { position: 'absolute', right: 0, top: -1 },
});
