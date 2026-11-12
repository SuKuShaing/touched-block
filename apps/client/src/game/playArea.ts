/**
 * Área de juego: dónde se dibuja el campo lógico del motor (`fieldW × fieldH`) dentro del campo
 * de la pantalla (`containerW × containerH`, px), y cómo se convierten los toques.
 *
 * - **Partida normal** (`stretchArea`): el campo es la pantalla completa de cada celular
 *   (decisión D5), así que la escala es `containerW / fieldW` y `containerH / fieldH` (1 salvo
 *   que la pantalla cambie de tamaño en plena partida), sin desplazamiento. Igual que siempre.
 * - **Retos** (`fitArea`, duel y daily): el campo lo decide el servidor y es igual para todos.
 *   Se dibuja en un rectángulo centrado con una sola escala `k = min(ancho / fieldW, alto / fieldH)`;
 *   lo que sobra queda como franjas sin usar. Un toque en esas franjas se ignora (no cuesta vida).
 */
export interface PlayArea {
  /** Escala px de pantalla por unidad lógica, en x y en y (iguales en `fitArea`). */
  sx: number;
  sy: number;
  /** Esquina superior izquierda del rectángulo dentro del campo de la pantalla (px). */
  ox: number;
  oy: number;
  /** Tamaño del rectángulo en px. */
  w: number;
  h: number;
  /** true en los retos: el rectángulo es más chico que la pantalla en alguna dimensión (lleva borde). */
  letterbox: boolean;
}

const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

/** Límites del campo que acepta la API (`POST /runs`). */
export const FIELD_MIN = 160;
export const FIELD_MAX = 4096;

const validSide = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= FIELD_MIN && v <= FIELD_MAX;

/**
 * Campo a jugar según la respuesta de `POST /runs`:
 * - partida normal: el de la respuesta si es válido; si no (API anterior a la fase 3), el enviado;
 * - retos (duel, daily): el de la respuesta, que decide el servidor y es igual para todos. Si no
 *   viene o no es válido, null: el reto no se puede jugar (no se usa el tamaño de la pantalla,
 *   que daría otra partida que la de los demás).
 */
export function serverField(
  challenge: boolean,
  sent: { fieldW: number; fieldH: number },
  res: { fieldW?: unknown; fieldH?: unknown },
): { fieldW: number; fieldH: number } | null {
  const ok = validSide(res.fieldW) && validSide(res.fieldH);
  if (ok) return { fieldW: res.fieldW as number, fieldH: res.fieldH as number };
  if (challenge) return null;
  return {
    fieldW: typeof res.fieldW === 'number' && res.fieldW > 0 ? res.fieldW : sent.fieldW,
    fieldH: typeof res.fieldH === 'number' && res.fieldH > 0 ? res.fieldH : sent.fieldH,
  };
}

/** Campo = pantalla completa (partida normal). */
export function stretchArea(containerW: number, containerH: number, fieldW: number, fieldH: number): PlayArea {
  const cw = pos(containerW);
  const ch = pos(containerH);
  return {
    sx: fieldW > 0 && cw > 0 ? cw / fieldW : 1,
    sy: fieldH > 0 && ch > 0 ? ch / fieldH : 1,
    ox: 0,
    oy: 0,
    w: cw,
    h: ch,
    letterbox: false,
  };
}

/** Campo del servidor en un rectángulo centrado con escala única (retos). */
export function fitArea(containerW: number, containerH: number, fieldW: number, fieldH: number): PlayArea {
  const cw = pos(containerW);
  const ch = pos(containerH);
  if (!(fieldW > 0 && fieldH > 0) || !(cw > 0 && ch > 0)) return { sx: 1, sy: 1, ox: 0, oy: 0, w: cw, h: ch, letterbox: true };
  const k = Math.min(cw / fieldW, ch / fieldH);
  const w = fieldW * k;
  const h = fieldH * k;
  return { sx: k, sy: k, ox: (cw - w) / 2, oy: (ch - h) / 2, w, h, letterbox: true };
}

/** El área que corresponde según el modo. */
export const areaFor = (letterbox: boolean, containerW: number, containerH: number, fieldW: number, fieldH: number) =>
  (letterbox ? fitArea : stretchArea)(containerW, containerH, fieldW, fieldH);

/**
 * Toque en px del campo de la pantalla → coordenadas lógicas del motor. En los retos, un toque
 * fuera del rectángulo devuelve null: se ignora (no es un toque fallido). En la partida normal
 * todo el campo es área de juego (el motor recorta al campo, como siempre).
 */
export function tapToField(a: PlayArea, px: number, py: number): { x: number; y: number } | null {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  const rx = px - a.ox;
  const ry = py - a.oy;
  if (a.letterbox && (rx < 0 || ry < 0 || rx > a.w || ry > a.h)) return null;
  return { x: rx / a.sx, y: ry / a.sy };
}

/** Punto lógico → px dentro del rectángulo (para efectos y textos sobre un bloque). */
export const fieldToArea = (a: PlayArea, x: number, y: number) => ({ x: x * a.sx, y: y * a.sy });

/** Rectángulo lógico (un bloque) → px dentro del rectángulo. */
export const rectToArea = (a: PlayArea, r: { x: number; y: number; w: number; h: number }) => ({
  x: r.x * a.sx,
  y: r.y * a.sy,
  w: r.w * a.sx,
  h: r.h * a.sy,
});
