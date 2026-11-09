/** Segundos → "m:ss" (redondea hacia arriba, nunca negativo), como legacy. */
export function fmtTime(s: number): string {
  const t = Math.max(0, Math.ceil(s - 1e-9));
  return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
}

const p2 = (n: number) => ('0' + n).slice(-2);

/** Fecha en ms → "dd/mm hh:mm". */
export function fmtDate(ms: number): string {
  const d = new Date(ms);
  return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}
