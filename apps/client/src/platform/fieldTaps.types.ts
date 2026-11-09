import type { RefObject } from 'react';
import type { HostInstance, ViewProps } from 'react-native';

/** Recibe cada toque en px relativos a la esquina superior izquierda del campo. */
export type TapHandler = (x: number, y: number) => void;

/**
 * Engancha los toques del campo de juego (multitáctil, en cuanto el dedo baja).
 * Devuelve props para esparcir en el View del campo.
 */
export type UseFieldTaps = (ref: RefObject<HostInstance | null>, onTap: TapHandler) => Partial<ViewProps>;
