/** Colores de la interfaz (los mismos de legacy/style.css). */
export const C = {
  bg: '#12121a',
  overlay: 'rgba(18,18,26,0.95)',
  panel: '#1c1c28',
  panelBorder: '#2a2a3d',
  rowBorder: '#26263a',
  barBg: '#232333',
  accent: '#77ccff',
  accentSoft: 'rgba(119,204,255,0.13)',
  good: '#5fe08a',
  bad: '#ff6369',
  danger: '#e5484d',
  gold: '#ffd166',
  heartOff: '#3a3a4d',
  trapNumber: '#ff2a2a',
  gone: '#555555',
  text: '#ffffff',
} as const;

/** Tiempo (s) desde el cual el reloj y la barra se ponen rojos. */
export const LOW_TIME = 5;
