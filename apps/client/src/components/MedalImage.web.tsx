import { medalDataUri, type MedalSpec } from '@/cosmetics/medal';

/**
 * Medalla en la web: el SVG de `cosmetics/medal.ts` como imagen (data URI). Cada imagen es su
 * propio documento, así que los ids de los degradados no chocan entre medallas, y el navegador
 * la decodifica una vez para todas las filas iguales de un ranking.
 */
export function MedalImage({ spec, size }: { spec: MedalSpec; size: number }) {
  return (
    <img
      src={medalDataUri(spec)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ display: 'block', width: size, height: size, pointerEvents: 'none', userSelect: 'none' }}
    />
  );
}
