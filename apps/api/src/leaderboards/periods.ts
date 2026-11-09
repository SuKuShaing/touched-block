/** Períodos de ranking. Todas las claves se calculan en UTC. */
export type Period = 'week' | 'month' | 'year' | 'all';
export const PERIODS: readonly Period[] = ['week', 'month', 'year', 'all'];

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Semana ISO 8601 (lunes a domingo, la semana 1 contiene el primer jueves): "2026-W45". */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; // lunes = 1 … domingo = 7
  t.setUTCDate(t.getUTCDate() + 4 - day); // jueves de esta semana
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${pad(week)}`;
}

/** Clave del período que contiene `d`: "2026-W45", "2026-11", "2026" o "all". */
export function periodKey(period: Period, d: Date): string {
  switch (period) {
    case 'week':
      return isoWeekKey(d);
    case 'month':
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    case 'year':
      return String(d.getUTCFullYear());
    case 'all':
      return 'all';
  }
}

/** Inicio (UTC, inclusive) del período que contiene `d`; null para "all". */
export function periodStart(period: Period, d: Date): Date | null {
  switch (period) {
    case 'week': {
      const day = d.getUTCDay() || 7;
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)));
    }
    case 'month':
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    case 'year':
      return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    case 'all':
      return null;
  }
}

/** Las 4 claves (semana, mes, año, histórico) en que cuenta un puntaje logrado en `d`. */
export function periodKeysFor(d: Date): { periodType: Period; periodKey: string }[] {
  return PERIODS.map((p) => ({ periodType: p, periodKey: periodKey(p, d) }));
}
