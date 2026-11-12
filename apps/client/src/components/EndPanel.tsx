import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { type TierRef, tierRefForTicks } from '@tb/engine';
import { errorMessage, isApiError } from '@/api/client';
import { type DailyRunResult, isAccountDaily } from '@/api/daily';
import { claimRun } from '@/api/endpoints';
import { applyRunStats, useInvalidate, useViewer } from '@/api/hooks';
import { session } from '@/api/session';
import type { RunResult } from '@/api/types';
import { type RunMode, type RunOptions, submitRun } from '@/game/rankedRun';
import type { GameResult } from '@/game/types';
import { countryName, flag } from '@/lib/countries';
import { markDailyClaimed } from '@/lib/daily';
import { SITE_URL, inviteText, resultText, stageText } from '@/lib/shareText';
import { useLocalStats } from '@/lib/stats';
import { share } from '@/platform/share';
import type { ShareOutcome } from '@/platform/share.types';
import { C } from '@/theme';
import { AccountPrompt } from './AccountPrompt';
import { ChallengeResult } from './ChallengePanel';
import { DailyResult } from './DailyResult';
import { SmallButton } from './form';
import { toast } from './Toast';

/** Partida terminada: resultado local, modo (servidor o local) y el envío en curso. */
export interface EndRun {
  id: number;
  result: GameResult;
  mode: RunMode;
  /** POST /runs/:id/finish (null si la partida fue local). */
  finish: Promise<RunResult> | null;
  /** Reto diario: fecha del reto que se jugó. */
  dailyDate?: string;
}

type Phase =
  | { k: 'local'; reason: 'off' | 'offline' | 'outdated' }
  | { k: 'sending' }
  | { k: 'error'; msg: string }
  | { k: 'rejected' }
  | { k: 'ranked'; res: RunResult; owner: string | null }
  | { k: 'guest'; res: RunResult }
  | { k: 'guestDeclined'; res: RunResult }
  | { k: 'claiming'; res: RunResult }
  | { k: 'claimError'; msg: string; res: RunResult };

/** Errores al reclamar con los que la partida de invitado ya no se puede reclamar. */
const FINAL_CLAIM_ERRORS = new Set([
  'run_already_claimed',
  'run_not_finished',
  'run_not_valid',
  'run_not_found',
  'claim_expired',
  'invalid_claim_token',
  'daily_attempts_exhausted',
]);

/** Mensaje al no poder reclamar: en el reto diario, que la cuenta ya lo jugó no es un error grave. */
function claimErrorText(e: unknown, daily: boolean): string {
  if (daily && isApiError(e) && e.code === 'daily_attempts_exhausted') {
    return 'Tu cuenta ya había jugado el reto de hoy, así que esta partida de invitado no se suma a ella.';
  }
  return errorMessage(e);
}

export function notifyShare(r: ShareOutcome) {
  if (r === 'copied') toast('Copiado al portapapeles');
  else if (r === 'failed') toast('No se pudo compartir');
}

/** Respuesta válida que se tiene en esta fase (para el reto: su resultado y los demás). */
const resOf = (p: Phase): RunResult | null => ('res' in p ? p.res : null);

/**
 * Parte de la pantalla final que depende de la API: ranking, login de invitado, compartir y
 * "Retar a un amigo". En una partida de reto (duel) muestra el reto en vez del ranking.
 * `onStart` empieza otra partida (un reto nuevo con "Retar a un amigo" o "Revancha").
 * `onDaily` avisa el resultado del reto diario de una cuenta (al terminar o al reclamar la
 * partida de invitado), con los intentos que le quedan de verdad.
 */
export function EndPanel({
  run,
  onStart,
  onDaily,
  challengeOffer = true,
}: {
  run: EndRun;
  onStart: (opts: RunOptions) => void;
  onDaily?: (d: DailyRunResult) => void;
  /** Mostrar "Retar a un amigo" (desde la 2.ª visita o si llegó por un enlace de reto). */
  challengeOffer?: boolean;
}) {
  const viewer = useViewer();
  const invalidate = useInvalidate();
  const local = useLocalStats();
  const [phase, setPhase] = useState<Phase>(() => (run.mode.kind === 'local' ? { k: 'local', reason: run.mode.reason } : { k: 'sending' }));
  // (el componente se monta con key = run.id: una partida nueva empieza de cero)
  const [finish, setFinish] = useState(run.finish);
  const mode = run.mode.kind === 'server' ? run.mode.mode : 'normal';
  // reto diario: fecha del reto (la manda GameScreen; si no, la de la respuesta de POST /runs)
  const dailyDate = run.mode.kind === 'server' && run.mode.mode === 'daily' ? (run.dailyDate ?? run.mode.daily?.date ?? null) : null;

  const ranked = (res: RunResult) => {
    const owner = session.get().user?.id ?? null;
    setPhase({ k: 'ranked', res, owner });
    // las estadísticas de después de la partida: Colección e insignia al día sin esperar a GET /me
    applyRunStats(res.stats, owner);
    invalidate('lb', 'myRuns', 'me', 'profile', 'challenge', 'daily', 'dailyLb', 'missions');
    if (res.daily && isAccountDaily(res.daily)) onDaily?.(res.daily);
  };

  useEffect(() => {
    if (!finish) return;
    let alive = true;
    finish.then(
      (res) => {
        if (!alive) return;
        if (!res.valid) setPhase({ k: 'rejected' });
        else if (res.claimable) setPhase({ k: 'guest', res });
        else ranked(res);
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
    const prev = resOf(phase);
    if (!prev) return;
    setPhase({ k: 'claiming', res: prev });
    try {
      const res = await claimRun(run.mode.runId, run.mode.claimToken);
      if (dailyDate) markDailyClaimed(dailyDate);
      ranked(res);
    } catch (e) {
      // ya no se puede reclamar: se olvida (si no, se volvería a intentar al iniciar sesión)
      if (dailyDate && isApiError(e) && FINAL_CLAIM_ERRORS.has(e.code)) markDailyClaimed(dailyDate);
      setPhase({ k: 'claimError', msg: claimErrorText(e, !!dailyDate), res: prev });
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
  const ranks = phase.k === 'ranked' && mine && mode === 'normal' ? phase.res.ranks : null;
  const country = viewer.user?.country ?? null;
  // insignia de la tarjeta: con sesión, la pública (Me.tier); sin sesión, la de este dispositivo
  const tier: TierRef | null = viewer.user ? (viewer.user.tier ?? null) : local.runs > 0 ? tierRefForTicks(local.bestTicks) : null;
  // etapa alcanzada (en una partida con modificador la duración no dice en qué etapa iba)
  const stage = run.result.mods ? null : stageText(run.result.durationTicks);
  const card = useMemo(
    () => ({
      username: viewer.user?.username ?? null,
      killed: run.result.killed,
      worldRank: ranks?.world ?? null,
      countryRank: ranks?.country ?? null,
      countryName: country ? countryName(country) : null,
      tier,
      stage,
    }),
    [viewer.user?.username, run.result.killed, ranks?.world, ranks?.country, country, tier, stage],
  );
  useEffect(() => share.prepareCard(card), [card]);

  const onShare = async () => notifyShare(await share.shareResult(card, resultText(card.killed, card.worldRank), SITE_URL));
  const onInvite = async () => {
    if (viewer.user) notifyShare(await share.shareText(inviteText(viewer.user.username), SITE_URL));
  };

  const duel = run.mode.kind === 'server' && run.mode.mode === 'duel' && run.mode.challengeCode ? run.mode : null;
  const settled = phase.k !== 'sending';
  const res = resOf(phase);
  // en el reto diario, DailyResult muestra el envío, los errores y la oferta de iniciar sesión
  const daily = !!dailyDate;

  return (
    <View style={styles.wrap}>
      {phase.k === 'local' && phase.reason !== 'off' ? (
        <Text style={styles.note}>
          {phase.reason === 'outdated'
            ? 'Hay una versión nueva del juego: recarga la página para volver al ranking.'
            : 'Sin conexión con el servidor: esta partida no entra al ranking.'}
        </Text>
      ) : null}

      {(phase.k === 'sending' && !daily) || phase.k === 'claiming' ? (
        <View style={styles.row}>
          <ActivityIndicator color={C.text} size="small" />
          <Text style={styles.note}>
            {phase.k === 'sending' ? 'Guardando tu partida…' : mode === 'normal' ? 'Guardando en el ranking…' : 'Guardando en tu cuenta…'}
          </Text>
        </View>
      ) : null}

      {phase.k === 'error' && !daily ? (
        <View style={styles.box}>
          <Text style={styles.note}>{phase.msg}</Text>
          <SmallButton title="Reintentar" kind="ghost" onPress={retry} />
        </View>
      ) : null}

      {phase.k === 'claimError' ? <Text style={styles.note}>{phase.msg}</Text> : null}

      {dailyDate ? (
        <DailyResult
          date={dailyDate}
          run={run.result}
          mods={run.result.mods}
          daily={mine ? (res?.daily ?? null) : null}
          pending={phase.k === 'sending'}
          error={
            phase.k === 'error'
              ? phase.msg
              : phase.k === 'rejected'
                ? 'No pudimos validar esta partida, así que no quedó en el reto del día. El intento igual se gastó.'
                : null
          }
          onRetry={phase.k === 'error' ? retry : undefined}
          loginOffer={
            phase.k === 'guest' ? { onLoggedIn: () => {}, onGuest: () => setPhase({ k: 'guestDeclined', res: phase.res }) } : null
          }
        />
      ) : null}

      {phase.k === 'rejected' && !daily ? (
        <Text style={styles.note}>
          {mode === 'normal'
            ? 'No pudimos validar esta partida para el ranking. Igual quedó en tu historial.'
            : 'No pudimos validar esta partida, así que no quedó en el reto.'}
        </Text>
      ) : null}

      {duel ? (
        <ChallengeResult
          key={duel.challengeCode}
          code={duel.challengeCode!}
          created={!!duel.created}
          runId={duel.runId}
          me={{ killed: run.result.killed, missed: run.result.missed }}
          view={mine ? (res?.challenge ?? null) : null}
          settled={settled}
          onRematch={() => onStart({ mode: 'duel' })}
        />
      ) : null}

      {phase.k === 'ranked' && mine && mode === 'normal' ? (
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
      {phase.k === 'guest' && !daily ? (
        <AccountPrompt onLoggedIn={() => {}} onGuest={() => setPhase({ k: 'guestDeclined', res: phase.res })} />
      ) : null}
      {phase.k === 'guestDeclined' && !daily ? (
        <Text style={styles.note}>
          {mode === 'normal'
            ? 'Jugaste como invitado: esta partida no queda en el ranking.'
            : 'Jugaste como invitado: tu resultado queda en el reto sin tu nombre.'}
        </Text>
      ) : null}

      {mode === 'normal' ? (
        <View style={styles.actions}>
          <SmallButton title="Compartir" kind="ghost" onPress={onShare} />
          {challengeOffer ? <SmallButton title="Retar a un amigo" kind="ghost" onPress={() => onStart({ mode: 'duel' })} /> : null}
          {viewer.user ? <SmallButton title="Invitar amigos" kind="ghost" onPress={onInvite} /> : null}
        </View>
      ) : null}
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
