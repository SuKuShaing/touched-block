import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DAILY_ATTEMPTS_ACCOUNT, type DateKey, type GameMods } from '@tb/engine';
import { type DailyRunInfo, isAccountDaily } from '@/api/daily';
import { useDailyStatus } from '@/api/dailyHooks';
import { useViewer } from '@/api/hooks';
import type { LoginResponse } from '@/api/types';
import {
  attemptDots,
  attemptsText,
  bestRunOf,
  dailyStatus,
  friendsText,
  localRuns,
  positionText,
  streakText,
  useDailyLocal,
} from '@/lib/daily';
import { dailyShareText } from '@/lib/dailyShare';
import { share } from '@/platform/share';
import { C } from '@/theme';
import { AccountPrompt } from './AccountPrompt';
import { SmallButton } from './form';
import { toast } from './Toast';
import { WeekStrip } from './WeekStrip';

/** La partida que se acaba de jugar (lo que hace falta de `GameResult`). */
export interface DailyRunSummary {
  killed: number;
  missed: number;
  bestStreak: number;
  durationTicks: number;
}

export interface DailyResultProps {
  /** Fecha del reto que se jugó. */
  date: DateKey;
  run: DailyRunSummary;
  /** Modificadores con que se jugó (para la tira de compartir). */
  mods?: GameMods | null;
  /** `daily` de la respuesta de terminar o reclamar; null mientras no llega, si falló o si se rechazó. */
  daily: DailyRunInfo | null;
  /** Se está enviando la partida. */
  pending?: boolean;
  /** Por qué no hay resultado (sin conexión, partida rechazada…). */
  error?: string | null;
  onRetry?: () => void;
  /**
   * Invitado: oferta de iniciar sesión para guardar la partida (se reclama con el mecanismo de
   * siempre). null u omitido: no se ofrece (ya la rechazó, o tiene sesión).
   */
  loginOffer?: { onLoggedIn: (r: LoginResponse) => void | Promise<void>; onGuest: () => void } | null;
}

/**
 * Contenido de la pantalla final de una partida del reto diario: el mejor del día, intentos que
 * quedan, porcentaje o posición, amigos superados, racha, la semana y "Compartir" (texto sin
 * spoilers). Como invitado: "Habrías quedado 12.º" y la oferta de iniciar sesión.
 */
export function DailyResult({ date, run, mods, daily, pending, error, onRetry, loginOffer }: DailyResultProps) {
  const viewer = useViewer();
  const local = useDailyLocal();
  const { status: current } = useDailyStatus(date);
  const account = daily && isAccountDaily(daily) ? daily : null;
  const guest = !!daily && !account;
  // Partida de invitado: racha y semana de este dispositivo, aunque después se haya iniciado
  // sesión con una cuenta que ya había jugado el reto (y la partida no se pudo sumar a ella).
  const deviceStatus = useMemo(() => dailyStatus({ date, loggedIn: false, server: null, local }), [date, local]);
  const status = guest ? deviceStatus : current;

  const attemptsLeft = account ? account.attemptsLeft : status.attemptsLeft;
  const attemptsMax = account ? DAILY_ATTEMPTS_ACCOUNT : status.attemptsMax;
  const streak = account ? account.streak : status.streak;
  const best = status.best;
  const played = status.played;

  // Se comparte la mejor partida del día en este dispositivo (la posición es la del mejor del día).
  const shared = useMemo(() => {
    const b = bestRunOf(localRuns(local, date));
    const pick = b && (b.k > run.killed || (b.k === run.killed && b.m < run.missed)) ? b : null;
    return dailyShareText({
      number: daily?.number ?? status.number,
      killed: pick ? pick.k : run.killed,
      bestStreak: pick ? pick.s : run.bestStreak,
      durationTicks: pick ? pick.t : run.durationTicks,
      mods: mods ?? status.mods,
      position: daily ? { rank: daily.rank, total: daily.total, betterThanPct: daily.betterThanPct } : null,
    });
  }, [local, date, run, mods, daily, status.number, status.mods]);

  const onShare = async () => {
    const r = await share.shareText(shared.text, shared.url);
    if (r === 'copied') toast('Copiado al portapapeles');
    else if (r === 'failed') toast('No se pudo compartir');
  };

  const friends = account ? friendsText(account.friends) : null;
  const streakLine = streakText(streak.current);

  return (
    <View style={styles.wrap}>
      <View style={styles.box} accessibilityLabel={`Reto de hoy número ${daily?.number ?? status.number}`}>
        <Text style={styles.cap}>Reto de hoy #{daily?.number ?? status.number}</Text>

        {account?.isBestToday ? <Text style={styles.best}>★ ¡Tu mejor resultado de hoy!</Text> : null}
        {account && !account.isBestToday && best ? (
          <Text style={styles.body}>
            Tu mejor de hoy: <Text style={styles.strong}>{best.killed}</Text> {best.killed === 1 ? 'bloque' : 'bloques'}
          </Text>
        ) : null}

        {daily ? <Text style={styles.position}>{positionText(daily, guest)}</Text> : null}
        {pending && !daily ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={C.text} />
            <Text style={styles.note}>Calculando tu posición…</Text>
          </View>
        ) : null}
        {error && !daily ? (
          <View style={styles.errBox}>
            <Text style={styles.note}>{error}</Text>
            {onRetry ? <SmallButton title="Reintentar" kind="ghost" onPress={onRetry} /> : null}
          </View>
        ) : null}

        {friends ? <Text style={styles.body}>{friends}</Text> : null}

        {account || !guest ? (
          <View style={styles.row}>
            <Text style={styles.dots} accessible={false}>
              {attemptDots(attemptsLeft, attemptsMax)}
            </Text>
            <Text style={styles.body}>{attemptsLeft > 0 ? attemptsText(attemptsLeft) : 'Vuelve mañana para un reto nuevo'}</Text>
          </View>
        ) : null}

        {streakLine ? <Text style={styles.streak}>{streakLine}</Text> : null}
        <WeekStrip today={date} played={played} />

        <SmallButton title="Compartir" kind="ghost" onPress={() => void onShare()} />
      </View>

      {guest && !viewer.loggedIn ? (
        <>
          <Text style={styles.note}>
            Como invitado tu partida no queda en el ranking del día. Con una cuenta se guarda y tienes {DAILY_ATTEMPTS_ACCOUNT} intentos cada
            día.
          </Text>
          {loginOffer ? <AccountPrompt onLoggedIn={loginOffer.onLoggedIn} onGuest={loginOffer.onGuest} /> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 10 },
  box: { width: '100%', alignItems: 'center', gap: 8, backgroundColor: C.panel, borderRadius: 16, padding: 14 },
  cap: { color: C.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9 },
  best: { color: C.gold, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  position: { color: C.accent, fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 28 },
  body: { color: C.text, opacity: 0.85, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  strong: { fontWeight: '800', color: C.accent },
  note: { color: C.text, opacity: 0.7, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errBox: { alignItems: 'center', gap: 8 },
  dots: { color: C.accent, fontSize: 15, letterSpacing: 2 },
  streak: { color: C.gold, fontSize: 14, fontWeight: '800' },
});
