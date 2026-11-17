import type { RefObject } from 'react';
import type { HostInstance, ViewProps } from 'react-native';

/** Recibe cada toque en px relativos a la esquina superior izquierda del campo. */
export type TapHandler = (x: number, y: number) => void;

/**
 * Engancha los toques del campo de juego (multitáctil, en cuanto el dedo baja).
 * Devuelve props para esparcir en el View del campo.
 */
export interface FieldTapsOptions {
  /**
   * Desplazamiento horizontal actual del campo (la sacudida al perder una vida). En la web no hace
   * falta: getBoundingClientRect ya lo incluye. En nativo el origen se mide al cambiar el tamaño,
   * así que se descuenta en cada toque para que coincida con lo que se ve.
   */
  offsetX?: () => number;
}

export type UseFieldTaps = (ref: RefObject<HostInstance | null>, onTap: TapHandler, opts?: FieldTapsOptions) => Partial<ViewProps>;
