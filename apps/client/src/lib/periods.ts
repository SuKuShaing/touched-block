import type { Period } from '@/api/types';

/** Inicio (ms, UTC) del período actual, igual que la API: semana ISO (lunes), mes, año o todo. */
export function periodStart(period: Period, now = Date.now()): number {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  if (period === 'year') return Date.UTC(y, 0, 1);
  if (period === 'month') return Date.UTC(y, d.getUTCMonth(), 1);
  if (period === 'week') {
    const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
    return Date.UTC(y, d.getUTCMonth(), d.getUTCDate() - dow);
  }
  return 0;
}

export const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

export const PERIOD_EMPTY: Record<Period, string> = {
  week: 'esta semana',
  month: 'este mes',
  year: 'este año',
  all: 'todavía',
};
