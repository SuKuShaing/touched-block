import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { errorMessage, isApiError } from '@/api/client';
import { fetchChallenge } from '@/api/endpoints';
import type { ChallengeEntry, ChallengeView } from '@/api/types';
import {
  challengeHead,
  challengeLink,
  challengeShareText,
  compareText,
  inviteTitle,
  playerName,
  resultShareText,
  rivalOf,
} from '@/lib/challenge';
import { share } from '@/platform/share';
import type { ShareOutcome } from '@/platform/share.types';
import { C } from '@/theme';
import { SmallButton } from './form';
import { TierBadge } from './TierBadge';
import { toast } from './Toast';

const MAX_ROWS = 5;

/** Bloques destruidos de un resultado. */
const scoreOf = (e: { killed: number }) => String(e.killed);

/** Lista corta de resultados del reto (como en los rankings), con mi fila resaltada. */
function Entries({ entries }: { entries: ChallengeEntry[] }) {
  const mineIdx = entries.findIndex((e) => e.isMe);
  // siempre se ve mi fila, aunque esté fuera de las primeras
  const rows = entries.slice(0, MAX_ROWS).map((e, i) => ({ e, rank: i + 1 }));
  if (mineIdx >= MAX_ROWS) rows[rows.length - 1] = { e: entries[mineIdx], rank: mineIdx + 1 };
  return (
    <View style={styles.list} accessibilityLabel="Resultados del reto">
      {rows.map(({ e, rank }) => (
        <View key={`${rank}-${e.createdAt}`} style={[styles.row, e.isMe && styles.rowMe]}>
          <Text style={styles.rank}>{rank}</Text>
          <TierBadge tier={e.tier} size="sm" />
          <Text style={[styles.name, e.isMe && styles.nameMe]} numberOfLines={1}>
            {e.isMe ? 'Tú' : playerName(e.username)}
            {e.isCreator ? <Text style={styles.creator}> · creó el reto</Text> : null}
          </Text>
          <Text style={styles.score}>{scoreOf(e)}</Text>
        </View>
      ))}
      {entries.length > rows.length ? (
        <Text style={styles.more}>
          {entries.length} {entries.length === 1 ? 'jugador' : 'jugadores'} en total
        </Text>
      ) : null}
    </View>
  );
}

function notifyShare(r: ShareOutcome) {
  if (r === 'copied') toast('Enlace copiado al portapapeles');
  else if (r === 'failed') toast('No se pudo compartir');
}

/** Comparte un texto con el enlace del reto (si no se puede, lo copia). */
async function shareLink(text: string, code: string) {
  notifyShare(await share.shareText(text, challengeLink(code)));
}

/**
 * Pantalla final de una partida de reto a un amigo (modo duel). Quien lo creó recibe el enlace
 * para compartir; quien se unió ve la comparación ("Tú 52 · @seba 47. ¡Ganaste por 5!"), con
 * "Revancha" (un reto nuevo) y "Compartir resultado".
 *
 * `view` es el reto que devolvió POST /runs/:id/finish (o /claim). Si la partida no llegó a
 * validarse (`settled` sin `view`), se pide GET /challenges/:code para mostrar al resto igual.
 */
export function ChallengeResult({
  code,
  created,
  runId,
  me,
  view,
  settled,
  onRematch,
}: {
  code: string;
  /** Esta partida creó el reto. */
  created: boolean;
  runId: string;
  /** Resultado de esta partida. */
  me: { killed: number; missed: number };
  view: ChallengeView | null;
  /** El envío de la partida ya terminó (bien o mal). */
  settled: boolean;
  onRematch: () => void;
}) {
  const [fetched, setFetched] = useState<ChallengeView | null>(null);
  // GET /challenges/:code falló (sin red, servidor caído): "No se pudo cargar el reto" + "Reintentar"
  const [fetchFailed, setFetchFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (view || !settled) return;
    let alive = true;
    setFetchFailed(false);
    fetchChallenge(code, runId).then(
      (v) => {
        if (!alive) return;
        setFetched(v);
        setFetchFailed(false);
      },
      () => alive && setFetchFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [view, settled, code, runId, attempt]);

  const v = view ?? fetched;
  const entries = v?.entries ?? [];
  const rival = rivalOf(entries);
  const counted = entries.find((e) => e.isMe);
  // con cuenta, en el reto queda el primer intento: si esta partida no es esa, se avisa
  const notCounted = !!counted && settled && (counted.killed !== me.killed || counted.missed !== me.missed);

  const head = challengeHead({ settled, hasView: !!v, hasRival: !!rival, fetchFailed });

  const copy = async () => toast((await share.copyText(challengeLink(code))) ? 'Enlace copiado' : 'No se pudo copiar');

  if (created && !rival) {
    return (
      <View style={styles.box} accessibilityLabel="Tu reto">
        <Text style={styles.head}>Tu reto está listo</Text>
        <Text style={styles.note}>Tu amigo jugará exactamente la misma partida. Abre el enlace después para ver quién ganó.</Text>
        <Text style={styles.link} selectable numberOfLines={1}>
          {challengeLink(code).replace(/^https?:\/\//, '')}
        </Text>
        <View style={styles.actions}>
          <SmallButton title="Compartir reto" onPress={() => void shareLink(challengeShareText(me.killed), code)} />
          <SmallButton title="Copiar enlace" kind="ghost" onPress={() => void copy()} />
        </View>
        <SmallButton title="Otro reto" kind="ghost" onPress={onRematch} />
      </View>
    );
  }

  return (
    <View style={styles.box} accessibilityLabel="Resultado del reto">
      {head === 'compare' && rival ? (
        <Text style={styles.head} accessibilityRole="header">
          {compareText(me, rival)}
        </Text>
      ) : head === 'failed' ? (
        <>
          <Text style={styles.bad}>No se pudo cargar el reto</Text>
          <SmallButton title="Reintentar" kind="ghost" onPress={() => setAttempt((n) => n + 1)} />
        </>
      ) : head === 'loading' ? (
        <View style={styles.inline}>
          <ActivityIndicator color={C.text} size="small" />
          <Text style={styles.note}>Cargando el reto…</Text>
        </View>
      ) : (
        <Text style={styles.head}>Eres el primero en terminar este reto</Text>
      )}
      {entries.length ? <Entries entries={entries} /> : null}
      {notCounted ? (
        <Text style={styles.small}>En el reto queda tu primer intento: {counted.killed} bloques.</Text>
      ) : null}
      <View style={styles.actions}>
        <SmallButton title="Revancha" onPress={onRematch} accessibilityLabel="Revancha: un reto nuevo" />
        <SmallButton title="Compartir resultado" kind="ghost" onPress={() => void shareLink(resultShareText(me, rival), code)} />
      </View>
    </View>
  );
}

/** Estado de la invitación al abrir un enlace `?reto=`. */
export interface InviteState {
  code: string;
  view: ChallengeView | undefined;
  loading: boolean;
  /** Error al pedir el reto (GET /challenges/:code). */
  error: unknown;
  /** Mensaje del último intento de empezarlo (POST /runs), si falló. */
  startError: string | null;
  /** El reto ya no se puede jugar (no existe o venció). */
  dead: boolean;
  /** Sin API (no se puede jugar ningún reto). */
  off: boolean;
}

/**
 * Tarjeta del inicio al abrir un enlace de reto: "Reto de @seba: 47 bloques. Juega la misma
 * partida". El botón principal ("Jugar el reto") lo pone el inicio.
 */
export function ChallengeInvite({ invite, onRetry }: { invite: InviteState; onRetry: () => void }) {
  const v = invite.view;
  const creator = v?.entries.find((e) => e.isCreator) ?? null;
  const others = v ? v.entries.filter((e) => !e.isCreator && !e.isMe).length : 0;
  const mine = v?.entries.find((e) => e.isMe && !e.isCreator) ?? null;
  const notFound = isApiError(invite.error) && invite.error.code === 'challenge_not_found';
  const offline = isApiError(invite.error) && invite.error.status === 0;

  // quien va primero (si no es uno mismo): "… · va primero @ana con 52"
  const leader = v?.entries[0] && !v.entries[0].isMe ? v.entries[0] : null;
  const fetchMsg = invite.off || offline ? 'El reto necesita conexión.' : !v && invite.error ? errorMessage(invite.error) : null;

  let body: ReactNode;
  if (invite.off) body = <Text style={styles.bad}>El reto necesita conexión.</Text>;
  else if (invite.loading)
    body = (
      <View style={styles.inline}>
        <ActivityIndicator color={C.text} size="small" />
        <Text style={styles.note}>Cargando el reto…</Text>
      </View>
    );
  else if (notFound) body = <Text style={styles.bad}>Este reto no existe. Revisa el enlace.</Text>;
  else if (v && !v.playable) body = <Text style={styles.bad}>Este reto venció.</Text>;
  else if (!v)
    body = (
      <>
        <Text style={styles.bad}>{fetchMsg}</Text>
        <SmallButton title="Reintentar" kind="ghost" onPress={onRetry} />
      </>
    );
  else
    body = (
      <>
        <View style={styles.inline}>
          {creator?.tier ? <TierBadge tier={creator.tier} size="sm" /> : null}
          <Text style={styles.head}>{inviteTitle(creator)}</Text>
        </View>
        <Text style={styles.note}>Juega la misma partida: los mismos bloques, en el mismo orden.</Text>
        {mine ? <Text style={styles.small}>Ya lo jugaste: {mine.killed} bloques.</Text> : null}
        {others > 0 ? (
          <Text style={styles.small}>
            {others === 1 ? 'Ya lo jugó 1 persona más' : `Ya lo jugaron ${others} personas más`}
            {leader && leader !== creator ? ` · va primero ${playerName(leader.username)} con ${leader.killed}` : ''}
          </Text>
        ) : null}
      </>
    );

  return (
    <View style={[styles.box, styles.invite]} accessibilityLabel="Reto de un amigo">
      {body}
      {invite.startError && invite.startError !== fetchMsg ? <Text style={styles.bad}>{invite.startError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 8, backgroundColor: C.panel, borderRadius: 16, padding: 14 },
  invite: { borderWidth: 1, borderColor: 'rgba(119,204,255,0.35)' },
  head: { color: C.text, fontSize: 16, lineHeight: 21, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  note: { color: C.text, opacity: 0.75, fontSize: 14, lineHeight: 19, textAlign: 'center' },
  small: { color: C.text, opacity: 0.6, fontSize: 12.5, lineHeight: 17, textAlign: 'center' },
  bad: { color: C.bad, fontSize: 14, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  link: { color: C.accent, fontSize: 13, fontWeight: '700', maxWidth: '100%' },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  list: { alignSelf: 'stretch', backgroundColor: C.bg, borderRadius: 12, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.rowBorder,
  },
  rowMe: { backgroundColor: C.accentSoft },
  rank: { color: C.text, opacity: 0.6, fontSize: 13, minWidth: 16, fontVariant: ['tabular-nums'] },
  name: { flex: 1, color: C.text, fontSize: 14, fontWeight: '600' },
  nameMe: { color: C.accent, fontWeight: '800' },
  creator: { color: C.text, opacity: 0.55, fontWeight: '400', fontSize: 12 },
  score: { color: C.text, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  more: { color: C.text, opacity: 0.55, fontSize: 12, textAlign: 'center', paddingVertical: 5 },
});
