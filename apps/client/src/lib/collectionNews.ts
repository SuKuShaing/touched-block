import { useEffect } from 'react';
import { useActiveCosmetics } from '@/cosmetics/active';
import { collectionScore, hasCollectionNews, seenAfterViewing } from './collectionScore';
import { getSettings, updateSettings, useSettings } from './settings';

/**
 * Punto de novedad de la pestaña Colección: aparece cuando hay algo que el jugador todavía no vio
 * ahí (insignia, premio, logro que sube de material o nivel nuevo).
 *
 * Se mide con un solo número, "cuánto hay" (`collectionScore`), guardado en los ajustes
 * (`tb_set1` → `seenScore`; no hace falta otra clave local). Al abrir la Colección se guarda
 * el máximo entre lo guardado y lo actual: así cerrar sesión (las estadísticas bajan) y volver a
 * entrar no enciende el punto por cosas que ya se habían visto. La primera vez se siembra con lo
 * actual, sin punto, para que quien ya jugaba no lo vea por todo lo que ganó antes.
 */
function useScore(): number {
  const { stats } = useActiveCosmetics();
  return collectionScore(stats);
}

/** Hook de la barra: true si la pestaña Colección debe mostrar el punto. */
export function useCollectionNews(): boolean {
  const score = useScore();
  const { seenScore } = useSettings();
  useEffect(() => {
    if (getSettings().seenScore < 0) updateSettings({ seenScore: score });
  }, [score]);
  return hasCollectionNews(score, seenScore);
}

/** Hook de la Colección: mientras está a la vista, marca como visto todo lo que hay. */
export function useMarkCollectionSeen(visible: boolean) {
  const score = useScore();
  useEffect(() => {
    if (!visible) return;
    const seen = getSettings().seenScore;
    const next = seenAfterViewing(score, seen);
    if (next !== seen) updateSettings({ seenScore: next });
  }, [visible, score]);
}
