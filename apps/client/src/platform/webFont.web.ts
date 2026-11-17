// Web: la misma tipografía que la app. En Android la app usa Roboto (la fuente del sistema),
// pero la web usaba la del sistema de cada equipo (Segoe UI en Windows, San Francisco en iOS),
// y los pesos y anchos se veían distintos. Roboto variable (archivos de @fontsource-variable/roboto
// 5.3; SIL Open Font License 1.1, ver src/assets/fonts/LICENSE-Roboto.txt) cubre todos los pesos que usa el juego (400–900): latín ~43 KB y latín extendido ~29 KB, este último
// solo si aparece un carácter de su rango.
//
// Se registra con FontFace y require() (no con el CSS del paquete) porque Metro no empaqueta los
// url() de un CSS; con require() el archivo sale como asset con la ruta base correcta
// (/touched-block en GitHub Pages). La regla que aplica la fuente a todo está en webFont.css.
import './webFont.css';

type Src = string | { uri?: string; default?: string };
const url = (m: Src): string | null => (typeof m === 'string' ? m : (m?.uri ?? m?.default ?? null));

const FACES: { src: Src; range: string }[] = [
  {
    src: require('@/assets/fonts/roboto-latin-wght-normal.woff2'),
    range:
      'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  },
  {
    src: require('@/assets/fonts/roboto-latin-ext-wght-normal.woff2'),
    range:
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  },
];

try {
  if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
    for (const f of FACES) {
      const u = url(f.src);
      if (!u) continue;
      const face = new FontFace('Roboto Variable', `url(${JSON.stringify(u)}) format('woff2')`, {
        weight: '100 900',
        style: 'normal',
        display: 'swap',
        unicodeRange: f.range,
      });
      document.fonts.add(face);
      // el latín se carga de inmediato (lo usa toda la página); el extendido, si hace falta
      if (f === FACES[0]) face.load().catch(() => {});
    }
  }
} catch {}
