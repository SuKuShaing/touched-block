import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { claimRun } from '@/api/endpoints';
import { useInvalidate, useViewer } from '@/api/hooks';
import { session } from '@/api/session';
import type { RunResult } from '@/api/types';
import { type RunMode, submitRun } from '@/game/rankedRun';
import type { GameResult } from '@/game/types';
import { countryName, flag } from '@/lib/countries';
import { SITE_URL, inviteText, resultText } from '@/lib/shareText';
import { share } from '@/platform/share';
import type { ShareOutcome } from '@/platform/share.types';
import { C } from '@/theme';
import { AccountPrompt } from './AccountPrompt';
import { SmallButton } from './form';
import { toast } from './Toast';

/** Partida terminada: resultado local, modo (servidor o local) y el envío en curso. */
export interface EndRun {
  id: number;
  result: GameResult;
  mode: RunMode;
  /** POST /runs/:id/finish (null si la partida fue local). */
  finish: Promise<RunResult> | null;
}

type Phase =
  | { k: 'local'; reason: 'off' | 'offline' | 'outdated' }
  | { k: 'sending' }
  | { k: 'error'; msg: string }
  | { k: 'rejected' }
  | { k: 'ranked'; res: RunResult; owner: string | null }
  | { k: 'guest'; res: RunResult }
  | { k: 'guestDeclined' }
  | { k: 'claiming' }
  | { k: 'claimError'; msg: string };

export function notifyShare(r: ShareOutcome) {
  if (r === 'copied') toast('Copiado al portapapeles');
  else if (r === 'failed') toast('No se pudo compartir');
}

/** Parte de la pantalla final que depende de la API: ranking, login de invitado, compartir. */
export function EndPanel({ run }: { run: EndRun }) {
  const viewer = useViewer();
  const invalidate = useInvalidate();
  const [phase, setPhase] = useState<Phase>(() => (run.mode.kind === 'local' ? { k: 'local', reason: run.mode.reason } : { k: 'sending' }));
  // (el componente se monta con key = run.id: una partida nueva empieza de cero)
  const [finish, setFinish] = useState(run.finish);

  useEffect(() => {
    if (!finish) return;
    let alive = true;
    finish.then(
      (res) => {
        if (!alive) return;
        if (!res.valid) setPhase({ k: 'rejected' });
        else if (res.claimable) setPhase({ k: 'guest', res });
        else {
          setPhase({ k: 'ranked', res, owner: session.get().user?.id ?? null });
          invalidate('lb', 'myRuns', 'me', 'profile');
        }
      },
      (e: unknown) => alive && setPhase({ k: 'error', msg: errorMessage(e) }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  const retry = () => {
    if (run.mode.kind !== 'server') return;
    setPhase({ k: 'sending' });
    setFinish(submitRun(run.mode, run.result));
  };

  const claim = async () => {
    if (run.mode.kind !== 'server' || !run.mode.claimToken) return;
    setPhase({ k: 'claiming' });
    try {
      const res = await claimRun(run.mode.runId, run.mode.claimToken);
      setPhase({ k: 'ranked', res, owner: session.get().user?.id ?? null });
      invalidate('lb', 'myRuns', 'me', 'profile');
    } catch (e) {
      setPhase({ k: 'claimError', msg: errorMessage(e) });
    }
  };

  // Si se inicia sesión desde cualquier botón (aquí, en el perfil o en rankings) mientras se
  // ofrece el ranking, la partida se reclama.
  useEffect(() => {
    if (viewer.loggedIn && phase.k === 'guest') void claim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.loggedIn, phase.k]);

  // Si después se cambió de cuenta, el resultado ya no es de quien está mirando.
  const mine = phase.k !== 'ranked' || !phase.owner || phase.owner === viewer.user?.id;
  const ranks = phase.k === 'ranked' && mine ? phase.res.ranks : null;
  const country = viewer.user?.country ?? null;
  const card = useMemo(
    () => ({
      username: viewer.user?.username ?? null,
      killed: run.result.killed,
      worldRank: ranks?.world ?? null,
      countryRank: ranks?.country ?? null,
      countryName: country ? countryName(country) : null,
    }),
    [viewer.user?.username, run.result.killed, ranks?.world, ranks?.country, country],
  );
  useEffect(() => share.prepareCard(card), [card]);

  const onShare = async () => notifyShare(await share.shareResult(card, resultText(card.killed, card.worldRank), SITE_URL));
  const onInvite = async () => {
    if (viewer.user) notifyShare(await share.shareText(inviteText(viewer.user.username), SITE_URL));
  };

  return (
    <View style={styles.wrap}>
      {phase.k === 'local' && phase.reason !== 'off' ? (
        <Text style={styles.note}>
          {phase.reason === 'outdated'
            ? 'Hay una versión nueva del juego: recarga la página para volver al ranking.'
            : 'Sin conexión con el servidor: esta partida no entra al ranking.'}
        </Text>
      ) : null}

      {phase.k === 'sending' || phase.k === 'claiming' ? (
        <View style={styles.row}>
          <ActivityIndicator color={C.text} size="small" />
          <Text style={styles.note}>{phase.k === 'sending' ? 'Guardando tu partida…' : 'Guardando en el ranking…'}</Text>
        </View>
      ) : null}

      {phase.k === 'error' ? (
        <View style={styles.box}>
          <Text style={styles.note}>{phase.msg}</Text>
          <SmallButton title="Reintentar" kind="ghost" onPress={retry} />
        </View>
      ) : null}

      {phase.k === 'claimError' ? <Text style={styles.note}>{phase.msg}</Text> : null}

      {phase.k === 'rejected' ? (
        <Text style={styles.note}>No pudimos validar esta partida para el ranking. Igual quedó en tu historial.</Text>
      ) : null}

      {phase.k === 'ranked' && mine ? (
        <View style={styles.box} accessibilityLabel="Tu posición en el ranking">
          {phase.res.isNewBest ? (
            <Text style={styles.best}>★ ¡Nuevo récord personal en el ranking!</Text>
          ) : phase.res.newBestPeriods?.includes('week') ? (
            <Text style={styles.best}>★ ¡Tu mejor puntaje de la semana!</Text>
          ) : null}
          {phase.res.ranks ? (
            <>
              <Text style={styles.cap}>Tu mejor puntaje</Text>
              <View style={styles.ranks}>
                <View style={styles.rank}>
                  <Text style={styles.rankN}>#{phase.res.ranks.world}</Text>
                  <Text style={styles.rankL}>en el mundo</Text>
                </View>
                {phase.res.ranks.country && country ? (
                  <View style={styles.rank}>
                    <Text style={styles.rankN}>#{phase.res.ranks.country}</Text>
                    <Text style={styles.rankL}>
                      en {flag(country)} {countryName(country)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : (
            <Text style={styles.note}>Partida guardada en el ranking.</Text>
          )}
        </View>
      ) : null}

      {phase.k === 'guest' ? <AccountPrompt onLoggedIn={() => {}} onGuest={() => setPhase({ k: 'guestDeclined' })} /> : null}
      {phase.k === 'guestDeclined' ? (
        <Text style={styles.note}>Jugaste como invitado: esta partida no queda en el ranking.</Text>
      ) : null}

      <View style={styles.actions}>
        <SmallButton title="Compartir" kind="ghost" onPress={onShare} />
        {viewer.user ? <SmallButton title="Invitar amigos" kind="ghost" onPress={onInvite} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { width: '100%', alignItems: 'center', gap: 8, backgroundColor: C.panel, borderRadius: 16, padding: 14 },
  note: { color: C.text, opacity: 0.7, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  best: { color: C.gold, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  cap: { color: C.text, opacity: 0.6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.9 },
  ranks: { flexDirection: 'row', gap: 22, justifyContent: 'center' },
  rank: { alignItems: 'center' },
  rankN: { color: C.accent, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankL: { color: C.text, opacity: 0.8, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
});
