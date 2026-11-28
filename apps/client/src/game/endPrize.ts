import type { TierStep } from '@tb/engine';
import type { Me } from '@/api/types';
import { catalogStatsFor } from '@/cosmetics/active';
import { CATALOG, type CatalogItem, type CatalogStats, type CosmeticType, meets, tierIndexOfStats, tierUp } from '@/cosmetics/catalog';
import { type LocalStats, type RunSummary, withRun } from '@/lib/stats';

/**
 * Premio de la pantalla final (plan, 2.5): si la partida subió de insignia se celebra primero;
 * si desbloqueó algo, "¡Desbloqueaste Neón!" con "Probar ahora". Es una sola tarjeta corta dentro
 * de la pantalla (nada de ventanas que haya que cerrar).
 */
export interface EndPrize {
  /** Insignia nueva (null si no subió). */
  tier: TierStep | null;
  /** Es su primera insignia (todavía no tenía ninguna). */
  firstTier: boolean;
  /** Premios que esta partida desbloqueó, en el orden del catálogo. */
  items: CatalogItem[];
}

/** Qué funciones existen hoy (para no anunciar premios que todavía no se pueden usar o ganar). */
export interface PrizeContext {
  accounts: boolean;
  daily: boolean;
}

/** Estadísticas de una partida terminada: las de antes y después para el premio, y la mejor duración previa. */
export interface EndStats {
  before: CatalogStats;
  after: CatalogStats;
  /** Su partida más larga antes de esta (ticks; camino de etapas): el máximo entre el dispositivo y la cuenta. */
  prevBestTicks: number;
}

/**
 * Estadísticas de antes y después de una partida para el premio y el camino de etapas.
 *
 * Con sesión, el catálogo usa el máximo campo a campo entre el dispositivo y la cuenta
 * (`catalogStatsFor`). Si la cuenta tiene más (jugó en otro dispositivo), sumar la partida solo a
 * las locales dejaría "después" igual a "antes" y no se anunciaría lo desbloqueado (p. ej. una
 * paleta por nivel). Por eso, si la partida cuenta en la cuenta (`countsOnAccount`: partida del
 * servidor con sesión), también se suma a `Me.stats` al calcular "después", con la misma regla
 * que aplicará el servidor (`withRun`). `me` es el usuario de ANTES de enviar la partida.
 */
export function endStats(
  local: { before: LocalStats; after: LocalStats },
  me: Me | null | undefined,
  run: RunSummary,
  opts: {
    normal: boolean;
    countsOnAccount: boolean;
    dailyBestBefore?: number;
    dailyBestAfter?: number;
    /** `bestPct` de este dispositivo (como invitado solo dice si participó; ver `catalogStatsFor`). */
    dailyPct?: number | null;
  },
): EndStats {
  const meAfter = me?.stats && opts.countsOnAccount ? { ...me, stats: withRun(me.stats, run, opts.normal, 'totalRuns') } : me;
  return {
    before: catalogStatsFor(local.before, me, { streakBest: opts.dailyBestBefore, bestPct: opts.dailyPct }),
    after: catalogStatsFor(local.after, meAfter, { streakBest: opts.dailyBestAfter, bestPct: opts.dailyPct }),
    prevBestTicks: Math.max(local.before.bestTicks, me?.stats?.bestTicks ?? 0),
  };
}

/** Premio de una partida comparando las estadísticas de antes y de después, o null si no hubo. */
export function endPrize(before: CatalogStats, after: CatalogStats, ctx: PrizeContext): EndPrize | null {
  const tier = tierUp(before, after);
  // `meets` y no `isUnlocked`: el APK de prueba lo desbloquea todo, pero igual celebra lo que se gana
  const items = CATALOG.filter((i) => !meets(i.req, before) && meets(i.req, after)).filter(
    (i) => !(i.requires === 'accounts' && !ctx.accounts) && !(i.requires === 'daily' && !ctx.daily),
  );
  if (!tier && !items.length) return null;
  return { tier, firstTier: !!tier && tierIndexOfStats(before) < 0, items };
}

const NEW_LABEL: Record<CosmeticType, string> = {
  palette: 'Paleta nueva',
  sound: 'Sonido nuevo',
  effect: 'Efecto nuevo',
  background: 'Fondo nuevo',
};

/** "Neón", "Neón y Chispas", "Neón, Chispas y Grilla". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** "Llegar a las sumas y restas" (motor) → "Llegaste a las sumas y restas". */
const reachedText = (t: TierStep) => t.goal.replace(/^Llegar\b/, 'Llegaste');

/** Título y bajada de la tarjeta. */
export function prizeTexts(p: EndPrize): { title: string; sub: string } {
  if (p.tier) {
    const title = p.firstTier ? `¡Tu primera insignia: ${p.tier.name}!` : `¡Subiste a ${p.tier.name}!`;
    const sub = p.items.length ? `Desbloqueaste ${joinNames(p.items.map((i) => i.name))}` : reachedText(p.tier);
    return { title, sub };
  }
  const first = p.items[0];
  const more = p.items.length - 1;
  return {
    title: `¡Desbloqueaste ${first.name}!`,
    sub: `${NEW_LABEL[first.type]}${more > 0 ? ` · y ${more} más en la Colección` : ''}`,
  };
}
