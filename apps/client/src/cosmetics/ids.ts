/**
 * Ids de los premios cosméticos. Solo tipos: los usan el catálogo (`catalog.ts`, que tiene los
 * nombres, los requisitos y el orden), las paletas, los sonidos, los efectos y los fondos. Se
 * guardan en `tb_set1` y en las claves de las celebraciones: no se renombran (la paleta
 * "Amistad" conserva su id `constancia`).
 */
export type PaletteId =
  | 'clasica'
  | 'contraste'
  | 'pastel'
  | 'neon'
  | 'tenue'
  | 'cristal'
  | 'retro'
  | 'boton'
  | 'contorno'
  | 'degrade'
  | 'dorado'
  | 'esmerilado'
  | 'diamante'
  | 'constancia';

/** Cómo se dibuja un bloque con la paleta. */
export type PaletteStyle = 'solid' | 'soft' | 'glass' | 'outline' | 'gradient' | 'frosted' | 'inset';

export type SoundId =
  | '8bits'
  | 'suave'
  | 'marimba'
  | 'palitos'
  | 'electronico'
  | 'viento'
  | 'piano'
  | 'guitarra'
  | 'futurista';

export type EffectId =
  | 'normal'
  | 'chispas'
  | 'emojis'
  | 'confeti'
  | 'burbujas'
  | 'ondas'
  | 'rayos'
  | 'monedas'
  | 'pixeles'
  | 'fugaces'
  | 'fuegos'
  | 'corazones';

export type BackgroundId =
  | 'liso'
  | 'grilla'
  | 'rayas'
  | 'estrellas'
  | 'puntos'
  | 'circuito'
  | 'aurora'
  | 'hexagonos'
  | 'atardecer'
  | 'topografia'
  | 'oceano'
  | 'ciudad'
  | 'cristales'
  | 'lluvia'
  | 'nebulosa'
  | 'nieve'
  | 'luciernagas'
  | 'vitral'
  | 'galaxia'
  | 'bosque';
