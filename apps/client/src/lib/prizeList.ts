/**
 * Alto de las tarjetas de premios de la Colección (paletas, sonidos, efectos y fondos): se ven
 * unas pocas filas y el resto se desplaza dentro de la tarjeta (CAMBIO-027).
 */

/** Filas que se ven enteras. */
export const LIST_ROWS = 4;
/** Cuánto asoma de la fila siguiente: así se nota que hay más. */
const PEEK = 0.5;
/** Alto supuesto de una fila mientras no se ha medido. */
const ROW_ESTIMATE = 66;
/** Tope respecto de la pantalla (letra muy grande, pantalla baja): fuera queda sitio para desplazarla. */
const MAX_SCREEN = 0.6;

/**
 * Alto máximo de la lista, o `undefined` si cabe entera. `heights` son las alturas medidas de las
 * primeras `LIST_ROWS + 1` filas (cambian con el texto, el ancho y el tamaño de letra), así el corte
 * cae siempre a media fila y no en un borde.
 */
export function prizeListHeight(count: number, heights: readonly (number | undefined)[], screenH: number): number | undefined {
  if (count <= LIST_ROWS) return undefined;
  const row = (i: number) => {
    const h = heights[i];
    return h !== undefined && h > 0 ? h : ROW_ESTIMATE;
  };
  let total = row(LIST_ROWS) * PEEK;
  for (let i = 0; i < LIST_ROWS; i++) total += row(i);
  return Math.round(screenH > 0 ? Math.min(total, screenH * MAX_SCREEN) : total);
}
