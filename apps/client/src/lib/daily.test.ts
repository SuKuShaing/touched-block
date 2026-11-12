import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADD_START, DAILY_ATTEMPTS_ACCOUNT, DAILY_ATTEMPTS_GUEST, DAILY_EPOCH, addDays, weekdayOf } from '@tb/engine';

// localStorage en memoria (storage.web.ts lo lee de window en cada llamada)
const mem = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
  },
});

// daily.ts guarda en memoria lo que leyó: módulo nuevo en cada test
const load = async () => {
  vi.resetModules();
  return import('./daily');
};

beforeEach(() => mem.clear());

const run = (killed: number, missed = 0, durationTicks = 600, bestStreak = 3) => ({ killed, missed, durationTicks, bestStreak });

describe('fechas', () => {
  it('fecha local del dispositivo', async () => {
    const d = await load();
    expect(d.localDateKey(new Date(2026, 10, 12, 0, 0, 0))).toBe('2026-11-12');
    expect(d.localDateKey(new Date(2026, 10, 12, 23, 59, 59))).toBe('2026-11-12');
    expect(d.localDateKey(new Date(2027, 0, 1, 0, 0, 1))).toBe('2027-01-01');
  });

  it('día local y medianoche', async () => {
    const d = await load();
    const [from, to] = d.localDayRange('2026-11-12');
    expect(from).toBe(new Date(2026, 10, 12).getTime());
    expect(to).toBe(new Date(2026, 10, 13).getTime());
    expect(d.msToNextMidnight(new Date(2026, 10, 12, 23, 59, 0))).toBe(60_000);
    expect(d.msToNextMidnight(new Date(2026, 10, 12, 0, 0, 0))).toBe(new Date(2026, 10, 13).getTime() - new Date(2026, 10, 12).getTime());
  });

  it('cuenta regresiva', async () => {
    const d = await load();
    expect(d.fmtCountdown(0)).toBe('0:00:00');
    expect(d.fmtCountdown(999)).toBe('0:00:01');
    expect(d.fmtCountdown((5 * 3600 + 12 * 60 + 33) * 1000)).toBe('5:12:33');
    expect(d.countdownWords((5 * 3600 + 12 * 60) * 1000)).toBe('5 h 12 min');
    expect(d.countdownWords(3600 * 1000)).toBe('1 h');
    expect(d.countdownWords(12 * 60_000 + 5000)).toBe('12 min');
    expect(d.countdownWords(30_000)).toBe('menos de 1 min');
  });
});

describe('textos', () => {
  it('el reto de una fecha sale del motor', async () => {
    const d = await load();
    const info = d.dailyInfo(DAILY_EPOCH);
    expect(info.number).toBe(1);
    const tuesday = addDays(DAILY_EPOCH, (1 - weekdayOf(DAILY_EPOCH) + 7) % 7);
    expect(d.dailyInfo(tuesday).mods).toEqual({ startAt: ADD_START });
    expect(d.todayLine(d.dailyInfo(tuesday).title)).toBe('Hoy: directo a las sumas');
  });

  it('intentos', async () => {
    const d = await load();
    expect(d.attemptDots(2, 3)).toBe('●●○');
    expect(d.attemptDots(0, 1)).toBe('○');
    expect(d.attemptDots(5, 3)).toBe('●●●');
    expect(d.attemptsText(1)).toBe('Te queda 1 intento');
    expect(d.attemptsText(3)).toBe('Te quedan 3 intentos');
    expect(d.attemptsText(0)).toBe('Sin intentos por hoy');
  });

  it('posición: porcentaje con 10 o más; si no, el puesto', async () => {
    const d = await load();
    expect(d.positionText({ rank: 12, total: 80, betterThanPct: 86 })).toBe('Mejor que el 86 %');
    expect(d.positionText({ rank: 2, total: 4, betterThanPct: 66 })).toBe('Vas 2.º de 4');
    expect(d.positionText({ rank: 1, total: 1, betterThanPct: 0 })).toBe('Eres el primero en jugarlo hoy');
    expect(d.positionText({ rank: 12, total: 81, betterThanPct: 86 }, true)).toBe('Habrías quedado 12.º de 81 (mejor que el 86 %)');
    expect(d.positionText({ rank: 2, total: 5, betterThanPct: 75 }, true)).toBe('Habrías quedado 2.º de 5');
  });

  it('amigos y racha', async () => {
    const d = await load();
    expect(d.friendsText({ beaten: 0, total: 0 })).toBeNull();
    expect(d.friendsText({ beaten: 2, total: 3 })).toBe('Superaste a 2 de tus 3 amigos que jugaron hoy');
    expect(d.friendsText({ beaten: 3, total: 3 })).toBe('¡Superaste a tus 3 amigos que jugaron hoy!');
    expect(d.friendsText({ beaten: 1, total: 1 })).toBe('Superaste a tu amigo que jugó hoy');
    expect(d.friendsText({ beaten: 0, total: 2 })).toBe('Tus 2 amigos que jugaron hoy van mejor que tú');
    expect(d.streakText(0)).toBeNull();
    expect(d.streakText(1)).toBe('Racha: 1 día');
    expect(d.streakText(4)).toBe('Racha: 4 días');
  });

  it('resumen de ayer', async () => {
    const d = await load();
    const y = { date: '2026-11-11', total: 80, winner: { username: 'jose', killed: 91 } };
    expect(d.yesterdayText({ ...y, rank: 12 })).toBe('Ayer quedaste 12.º de 80. Ganó @jose con 91.');
    expect(d.yesterdayText({ ...y, rank: null })).toBe('Ayer ganó @jose con 91 bloques (80 jugadores).');
    expect(d.yesterdayText({ ...y, rank: 1 })).toBe('¡Ayer ganaste el reto! Jugaron 80 jugadores.');
    expect(d.yesterdayText({ ...y, total: 1, rank: 1 })).toBe('Ayer fuiste el único en jugar el reto.');
    expect(d.yesterdayText({ ...y, total: 1, rank: null, winner: { username: 'ana', killed: 1 } })).toBe(
      'Ayer ganó @ana con 1 bloque (1 jugador).',
    );
  });
});

describe('semana', () => {
  it('de lunes a domingo, con hoy y lo jugado', async () => {
    const d = await load();
    // 2026-11-12 es jueves
    expect(weekdayOf('2026-11-12')).toBe(3);
    const w = d.weekStrip('2026-11-12', ['2026-11-09', '2026-11-11', '2026-11-12', '2026-11-02']);
    expect(w.map((x) => x.label).join('')).toBe('LMMJVSD');
    expect(w[0].date).toBe('2026-11-09');
    expect(w[6].date).toBe('2026-11-15');
    expect(w.map((x) => x.played)).toEqual([true, false, true, true, false, false, false]);
    expect(w.map((x) => x.today)).toEqual([false, false, false, true, false, false, false]);
    expect(w.map((x) => x.future)).toEqual([false, false, false, false, true, true, true]);
    expect(w[2].name).toBe('miércoles');
  });

  it('el domingo es el último día de su semana', async () => {
    const d = await load();
    const w = d.weekStrip('2026-11-15', []);
    expect(w[0].date).toBe('2026-11-09');
    expect(w[6].today).toBe(true);
  });
});

describe('tb_daily1', () => {
  it('parte vacío y tolera datos rotos', async () => {
    const d = await load();
    expect(d.loadDailyLocal()).toEqual(d.EMPTY_DAILY);
    expect(d.parseDailyLocal('no es json')).toEqual(d.EMPTY_DAILY);
    expect(d.parseDailyLocal('[1,2]')).toEqual(d.EMPTY_DAILY);
    const p = d.parseDailyLocal(
      JSON.stringify({ days: { malo: {}, '2026-11-12': { used: 2, runs: [{ k: 5 }, 'x'] } }, played: ['2026-11-12', 'x', '2026-11-12'], rulesSeen: 1 }),
    );
    expect(p.days).toEqual({ '2026-11-12': { used: 2, runs: [{ k: 5, m: 0, t: 0, s: 0, d: 0 }] } });
    expect(p.played).toEqual(['2026-11-12']);
    expect(p.rulesSeen).toBe(false);
  });

  it('el invitado tiene un intento; se gasta al empezar', async () => {
    const d = await load();
    const date = '2026-11-12';
    let st = d.dailyStatus({ date, loggedIn: false, local: d.loadDailyLocal() });
    expect(st.attemptsMax).toBe(DAILY_ATTEMPTS_GUEST);
    expect(st.attemptsLeft).toBe(1);
    expect(st.canPlay).toBe(true);
    d.markDailyStarted(date, { runId: 'r1', claimToken: 'tok' });
    st = d.dailyStatus({ date, loggedIn: false, local: d.loadDailyLocal() });
    expect(st.attemptsLeft).toBe(0);
    expect(st.canPlay).toBe(false);
    expect(st.best).toBeNull();
    // se guardó en el almacenamiento
    expect(JSON.parse(mem.get(d.DAILY_KEY)!).days[date].used).toBe(1);
  });

  it('al terminar guarda la partida, la fecha jugada y abre el plazo para reclamar', async () => {
    const d = await load();
    const date = '2026-11-12';
    d.markDailyStarted(date, { runId: 'r1', claimToken: 'tok' });
    expect(d.pendingDailyClaims(d.loadDailyLocal(), 1000)).toEqual([]); // todavía no termina
    d.recordDailyFinish(date, run(58, 4, 14_000, 31), 1000);
    const local = d.loadDailyLocal();
    expect(local.played).toEqual([date]);
    expect(d.localRuns(local, date)).toEqual([{ k: 58, m: 4, t: 14_000, s: 31, d: 1000 }]);
    expect(d.pendingDailyClaims(local, 1000 + d.CLAIM_WINDOW_MS)).toEqual([{ date, runId: 'r1', claimToken: 'tok' }]);
    expect(d.pendingDailyClaims(local, 1001 + d.CLAIM_WINDOW_MS)).toEqual([]);
    const st = d.dailyStatus({ date, loggedIn: false, local });
    expect(st.best).toEqual({ killed: 58, missed: 4 });
    expect(st.streak).toEqual({ current: 1, best: 1 });
    d.markDailyClaimed(date);
    expect(d.loadDailyLocal().days[date].claim).toBeUndefined();
    expect(d.pendingDailyClaims(d.loadDailyLocal(), 1000)).toEqual([]);
  });

  it('con cuenta no se guarda nada que reclamar', async () => {
    const d = await load();
    d.markDailyStarted('2026-11-12', { runId: 'r1' });
    d.recordDailyFinish('2026-11-12', run(10), 5);
    expect(d.loadDailyLocal().days['2026-11-12'].claim).toBeUndefined();
  });

  it('racha local del invitado', async () => {
    const d = await load();
    for (const date of ['2026-11-09', '2026-11-10', '2026-11-11']) {
      d.markDailyStarted(date);
      d.recordDailyFinish(date, run(5));
    }
    const local = d.loadDailyLocal();
    expect(d.localStreak(local, '2026-11-12')).toEqual({ current: 3, best: 3 });
    expect(d.localStreak(local, '2026-11-14')).toEqual({ current: 0, best: 3 });
    expect(d.localStreakBest(local)).toBe(3);
    expect(d.localStreakBest(d.EMPTY_DAILY)).toBe(0);
  });

  it('el mejor del día: más destruidos y, a igualdad, menos escapados', async () => {
    const d = await load();
    expect(d.bestRunOf([])).toBeNull();
    const best = d.bestRunOf([
      { k: 10, m: 3, t: 1, s: 1, d: 1 },
      { k: 12, m: 5, t: 2, s: 2, d: 2 },
      { k: 12, m: 2, t: 3, s: 3, d: 3 },
    ]);
    expect(best?.d).toBe(3);
  });

  it('guarda solo los últimos 14 días con detalle (las fechas jugadas se quedan)', async () => {
    const d = await load();
    d.markDailyStarted('2026-10-01');
    d.recordDailyFinish('2026-10-01', run(1));
    d.markDailyStarted('2026-11-12');
    const local = d.loadDailyLocal();
    expect(Object.keys(local.days)).toEqual(['2026-11-12']);
    expect(local.played).toEqual(['2026-10-01']);
  });

  it('invitado: dónde habría quedado y su mejor porcentaje (0 con menos de 10 jugadores)', async () => {
    const d = await load();
    d.recordDailyGuestResult('2026-11-11', { rank: 2, total: 4, betterThanPct: 66 });
    expect(d.loadDailyLocal().bestPct).toBe(0);
    d.recordDailyGuestResult('2026-11-12', { rank: 12, total: 81, betterThanPct: 86 });
    expect(d.loadDailyLocal().bestPct).toBe(86);
    expect(d.loadDailyLocal().days['2026-11-12'].would).toEqual({ rank: 12, total: 81, pct: 86 });
    d.recordDailyGuestResult('2026-11-13', { rank: 40, total: 81, betterThanPct: 50 });
    expect(d.loadDailyLocal().bestPct).toBe(86);
  });

  it('reglas vistas y aviso de ayer una vez por fecha', async () => {
    const d = await load();
    expect(d.loadDailyLocal().rulesSeen).toBe(false);
    d.markRulesSeen();
    expect(d.loadDailyLocal().rulesSeen).toBe(true);
    const y = { date: '2026-11-11' };
    expect(d.shouldShowYesterday(d.loadDailyLocal(), y)).toBe(true);
    d.markYesterdaySeen('2026-11-11');
    expect(d.shouldShowYesterday(d.loadDailyLocal(), y)).toBe(false);
    expect(d.shouldShowYesterday(d.loadDailyLocal(), { date: '2026-11-12' })).toBe(true);
    expect(d.shouldShowYesterday(d.loadDailyLocal(), null)).toBe(false);
    // sobrevive a recargar
    const again = await load();
    expect(again.loadDailyLocal().rulesSeen).toBe(true);
    expect(again.loadDailyLocal().yesterdaySeen).toBe('2026-11-11');
  });

  it('avisa a quien escucha', async () => {
    const d = await load();
    const fn = vi.fn();
    const off = d.subscribeDailyLocal(fn);
    const before = d.loadDailyLocal();
    d.markDailyStarted('2026-11-12');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(d.loadDailyLocal()).not.toBe(before);
    off();
    d.markDailyStarted('2026-11-12');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('dailyStatus con sesión', () => {
  const server = {
    number: 7,
    title: 'Sin trampas rojas',
    mods: { noRed: true },
    attemptsMax: DAILY_ATTEMPTS_ACCOUNT,
    attemptsUsed: 1,
    best: { killed: 40, missed: 2 },
    streak: { current: 4, best: 9 },
  };

  it('manda el servidor', async () => {
    const d = await load();
    const st = d.dailyStatus({ date: '2026-11-12', loggedIn: true, server, local: d.loadDailyLocal() });
    expect(st.number).toBe(7);
    expect(st.title).toBe('Sin trampas rojas');
    expect(st.attemptsLeft).toBe(2);
    expect(st.attemptsKnown).toBe(true);
    expect(st.best).toEqual({ killed: 40, missed: 2 });
    expect(st.streak).toEqual({ current: 4, best: 9 });
    expect(st.played).toEqual(['2026-11-12']); // tiene un mejor del día: hoy cuenta como jugado
  });

  it('la semana de la cuenta viene del servidor (week), no de este dispositivo', async () => {
    const d = await load();
    d.markDailyStarted('2026-11-10');
    d.recordDailyFinish('2026-11-10', run(3)); // jugada como invitado en este dispositivo
    const week = ['2026-11-09', '2026-11-11'];
    const st = d.dailyStatus({ date: '2026-11-12', loggedIn: true, server: { ...server, week }, local: d.loadDailyLocal() });
    expect(st.played).toEqual(['2026-11-09', '2026-11-11', '2026-11-12']);
    // sin week (API anterior): lo de este dispositivo
    const old = d.dailyStatus({ date: '2026-11-12', loggedIn: true, server: { ...server, best: null }, local: d.loadDailyLocal() });
    expect(old.played).toEqual(['2026-11-10']);
  });

  it('sin respuesta del servidor se puede intentar (el servidor decide al empezar)', async () => {
    const d = await load();
    d.markDailyStarted('2026-11-12');
    d.markDailyStarted('2026-11-12');
    d.markDailyStarted('2026-11-12');
    const st = d.dailyStatus({ date: '2026-11-12', loggedIn: true, server: null, local: d.loadDailyLocal() });
    expect(st.attemptsKnown).toBe(false);
    expect(st.canPlay).toBe(true);
    expect(st.number).toBe(d.dailyInfo('2026-11-12').number);
  });

  it('sin intentos', async () => {
    const d = await load();
    const st = d.dailyStatus({ date: '2026-11-12', loggedIn: true, server: { ...server, attemptsUsed: 3 }, local: d.loadDailyLocal() });
    expect(st.attemptsLeft).toBe(0);
    expect(st.canPlay).toBe(false);
  });

  it('cerrar sesión no da intentos nuevos: los empezados con cuenta en este dispositivo cuentan', async () => {
    const d = await load();
    d.markDailyStarted('2026-11-12', { runId: 'r1' });
    const st = d.dailyStatus({ date: '2026-11-12', loggedIn: false, local: d.loadDailyLocal() });
    expect(st.canPlay).toBe(false);
  });
});

describe('inicio', () => {
  it('el reto y las misiones desde la 2.ª visita y con la API', async () => {
    const d = await load();
    expect(d.dailyVisible({ accounts: true, visits: 1, runs: 0 })).toBe(false);
    expect(d.dailyVisible({ accounts: true, visits: 2, runs: 0 })).toBe(true);
    expect(d.dailyVisible({ accounts: false, visits: 5, runs: 9 })).toBe(false);
  });
  it('o desde la 3.ª partida, aunque sea la 1.ª visita', async () => {
    const d = await load();
    expect(d.DAILY_FROM_RUNS).toBe(3);
    expect(d.dailyVisible({ accounts: true, visits: 1, runs: 2 })).toBe(false);
    expect(d.dailyVisible({ accounts: true, visits: 1, runs: 3 })).toBe(true);
  });
  it('cuentan las partidas del dispositivo o las de la cuenta, la mayor', async () => {
    const d = await load();
    expect(d.playedRuns(1, null)).toBe(1);
    expect(d.playedRuns(1, undefined)).toBe(1);
    expect(d.playedRuns(1, {})).toBe(1);
    expect(d.playedRuns(0, { stats: { totalRuns: 40 } })).toBe(40);
    expect(d.playedRuns(5, { stats: { totalRuns: 2 } })).toBe(5);
  });
  it('aviso de cuántas partidas faltan: después de la 1.ª y hasta desbloquearlos', async () => {
    const d = await load();
    const at = (runs: number, visits = 1, accounts = true) => d.runsToUnlock({ accounts, visits, runs });
    expect(at(0)).toBeNull(); // la 1.ª partida es solo para jugar
    expect(at(1)).toBe(2);
    expect(at(2)).toBe(1);
    expect(at(3)).toBeNull();
    expect(at(1, 2)).toBeNull(); // 2.ª visita: ya se ven
    expect(at(1, 1, false)).toBeNull(); // sin API no existen
    expect(d.unlockHintText(2)).toBe('Te faltan 2 partidas para desbloquear el reto del día y las misiones.');
    expect(d.unlockHintText(1)).toBe('Te falta 1 partida para desbloquear el reto del día y las misiones.');
  });

  it('enlace ?diario=1 y botón de otro intento', async () => {
    const d = await load();
    expect(d.readDailyParam({ diario: '1' })).toBe(true);
    expect(d.readDailyParam({ diario: ['1'] })).toBe(true);
    expect(d.readDailyParam({ diario: '0' })).toBe(false);
    expect(d.readDailyParam({ reto: 'ABC' })).toBe(false);
    expect(d.readDailyParam(null)).toBe(false);
    expect(d.anotherAttemptText(2)).toBe('Otro intento (quedan 2)');
    expect(d.anotherAttemptText(1)).toBe('Otro intento (queda 1)');
  });

  it('como máximo una tarjeta a la vez', async () => {
    const d = await load();
    expect(d.homeCard({ daily: true, dailyPlayable: true, install: true })).toBe('daily');
    expect(d.homeCard({ daily: true, dailyPlayable: false, install: true })).toBe('install');
    expect(d.homeCard({ daily: true, dailyPlayable: false, install: false })).toBe('daily');
    expect(d.homeCard({ daily: false, dailyPlayable: false, install: true })).toBe('install');
    expect(d.homeCard({ daily: false, dailyPlayable: true, install: false })).toBeNull();
  });
});
