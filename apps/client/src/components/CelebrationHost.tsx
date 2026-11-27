import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewer } from '@/api/hooks';
import { features } from '@/config';
import { catalogStatsFor, useActiveCosmetics } from '@/cosmetics/active';
import { disarmCelebrations, dropCelebrations, observeCelebrations, useCelebrationQueue } from '@/game/celebrationQueue';
import { ownedKeys } from '@/game/celebrations';
import type { PrizeContext } from '@/game/endPrize';
import { playFanfare } from '@/game/fanfare';
import { localStreakBest, useDailyLocal } from '@/lib/daily';
import { useLocalStats } from '@/lib/stats';
import { CelebrationModal } from './CelebrationModal';

/** Qué funciones existen (igual que el premio de la pantalla final). */
export const CELEBRATION_CTX: PrizeContext = { accounts: features.accounts, daily: features.accounts };

/**
 * Muestra la cola de celebraciones (`game/celebrationQueue.ts`) en la pantalla de juego, nunca
 * en medio de una partida (`blocked`) ni con otra pantalla encima (tutorial, Colección…): espera
 * a que se vuelva al inicio o a la pantalla final. Toca la fanfarria al aparecer.
 *
 * También le pasa a `observeCelebrations` lo que el jugador tiene cada vez que cambia: así se
 * siembra `tb_cele2` la primera vez (sin celebrar lo que ya tenía), se celebra lo que llega tarde
 * por una partida de este dispositivo (un fondo por los bloques extra de una misión, el mejor
 * resultado de un reto como invitado) y se registra sin celebrar lo que llega de la cuenta.
 */
export function CelebrationHost({ blocked }: { blocked: boolean }) {
  const queue = useCelebrationQueue();
  const focused = useIsFocused();
  const viewer = useViewer();
  const { stats } = useActiveCosmetics();
  const daily = useDailyLocal();

  // solo los datos de este dispositivo (los de la cuenta pueden venir de otro, o llegar tarde)
  const localStats = useLocalStats();
  const local = useMemo(
    () => catalogStatsFor(localStats, null, { streakBest: localStreakBest(daily), bestPct: daily.bestPct }),
    [localStats, daily],
  );

  // ---- registro de lo que ya tiene, y lo que llega tarde por una partida ----
  useEffect(() => {
    observeCelebrations({ viewer: viewer.key, local, owned: () => ownedKeys(stats) }, CELEBRATION_CTX);
  }, [stats, viewer.key, local]);
  // otra partida: lo que cambie desde ahora ya no es de la anterior
  useEffect(() => {
    if (blocked) disarmCelebrations();
  }, [blocked]);

  // ---- cuándo se muestra ----
  const [, setTick] = useState(0);
  const wait = queue.items.length ? queue.readyAt - Date.now() : 0;
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setTick((n) => n + 1), wait + 16);
    return () => clearTimeout(t);
  }, [wait, queue]);
  const visible = queue.items.length > 0 && !blocked && focused && wait <= 0;

  const [index, setIndex] = useState(0);
  const shownKey = queue.items[index]?.key ?? null;
  const played = useRef<string | null>(null);
  const firstOfBatch = useRef(true);
  useEffect(() => {
    if (!visible || !shownKey || played.current === shownKey) return;
    played.current = shownKey;
    playFanfare(!firstOfBatch.current);
    firstOfBatch.current = false;
  }, [visible, shownKey]);

  if (!visible) return null;
  const close = () => {
    dropCelebrations(queue.items.length);
    setIndex(0);
    played.current = null;
    firstOfBatch.current = true;
  };
  return (
    <CelebrationModal
      items={queue.items}
      index={Math.min(index, queue.items.length - 1)}
      onNext={() => setIndex((i) => Math.min(i + 1, queue.items.length - 1))}
      onClose={close}
    />
  );
}
