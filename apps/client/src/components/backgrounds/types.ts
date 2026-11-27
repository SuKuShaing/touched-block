import type { ComponentType } from 'react';
import type { BackgroundId } from '@/cosmetics/ids';

/** Lo que recibe cada fondo del campo (`FieldBackground` los llama por su id). */
export interface BackgroundProps {
  /** Lado de referencia de los mosaicos, en px (44 en el campo; menos en las vistas previas). */
  cell: number;
  /** Miniatura (fila de la Colección): mosaicos más chicos y sin animación. */
  thumb: boolean;
  /** Animación detenida (partida terminada, miniaturas…). */
  paused: boolean;
}

/** Fondos de un archivo (`setA`, `setB`, `animated`), por id. */
export type BackgroundSet = Partial<Record<BackgroundId, ComponentType<BackgroundProps>>>;
