/** Datos de la tarjeta de resultado que se comparte como imagen. */
export interface ResultCard {
  /** null = invitado. */
  username: string | null;
  killed: number;
  worldRank?: number | null;
  countryRank?: number | null;
  /** Nombre del país (para "#3 en Chile"). */
  countryName?: string | null;
}

/** shared: se abrió la hoja de compartir; copied: se copió al portapapeles; cancelled: el usuario la cerró. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface Share {
  /** Prepara la imagen de antemano (para no perder el gesto del usuario al compartir). */
  prepareCard(card: ResultCard): void;
  /** Comparte la tarjeta (PNG) con texto y link; si no se puede, solo el texto; si no, lo copia. */
  shareResult(card: ResultCard, text: string, url: string): Promise<ShareOutcome>;
  /** Comparte un texto y un link; si no se puede, lo copia. */
  shareText(text: string, url: string): Promise<ShareOutcome>;
  copyText(text: string): Promise<boolean>;
}
