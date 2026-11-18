import {
  ACHIEVEMENTS,
  type AchievementId,
  type AchievementMaterial,
  TIERS,
  type TierStep,
  achievementById,
  achievementGoal,
  achievementLevel,
  achievementMaterial,
} from '@tb/engine';
import {
  CATALOG,
  type CatalogItem,
  type CatalogStats,
  type CosmeticType,
  type Requirement,
  TYPE_ORDER,
  findItem,
  isUnlocked,
  tierIndexOfStats,
} from '@/cosmetics/catalog';
import type { EndPrize, PrizeContext } from './endPrize';

/**
 * Celebraciones (ventana con confeti y fanfarria) de lo que el jugador gana o desbloquea:
 *
 * - `tier`: insignia nueva (Madera I … Diamante). Se celebra antes que el resto (plan, 2.5).
 * - `item`: premio del catálogo (paleta, sonido, efecto o fondo del campo).
 * - `achievement`: logro que sube de material (Madera … Diamante).
 * - `feature`: el reto del día y las misiones, que se desbloquean una vez por dispositivo.
 *
 * Cada una tiene una clave (`tier:3`, `item:palette:neon`, `ach:racha:2`, `feature:daily`) que
 * se guarda en `tb_cele1` al anunciarla, para no celebrar lo mismo dos veces en este dispositivo
 * (p. ej. al cerrar sesión las estadísticas bajan y una partida podría "volver a desbloquear"
 * Neón). Todo aquí es puro; el almacenamiento y la cola viven en `celebrationQueue.ts`.
 */
export type Celebration =
  | { kind: 'tier'; key: string; tier: TierStep; first: boolean }
  | { kind: 'item'; key: string; item: CatalogItem }
  | { kind: 'achievement'; key: string; id: AchievementId; level: number; material: AchievementMaterial }
  | { kind: 'feature'; key: string; feature: 'daily' };

export const tierKey = (index: number) => `tier:${index}`;
export const itemKey = (i: Pick<CatalogItem, 'type' | 'id'>) => `item:${i.type}:${i.id}`;
export const achievementKey = (id: AchievementId, level: number) => `ach:${id}:${level}`;
export const FEATURE_DAILY_KEY = 'feature:daily';

/**
 * Celebración a partir de su clave (para recuperar las que quedaron sin ver al cerrar la app), o
 * null si la clave no es válida. "Tu primera insignia" no se guarda: se recupera para Madera I.
 */
export function celebrationFromKey(key: string): Celebration | null {
  const [kind, a, b] = key.split(':');
  if (kind === 'tier') {
    const i = Number(a);
    return Number.isInteger(i) && TIERS[i] && b === undefined ? tierCelebration(TIERS[i], i === 0) : null;
  }
  if (kind === 'item') {
    const type = TYPE_ORDER.find((t) => t === a);
    const it = type ? findItem(type, b) : undefined;
    return it && it.req.kind !== 'always' ? itemCelebration(it) : null;
  }
  if (kind === 'ach') {
    const a2 = ACHIEVEMENTS.find((x) => x.id === a);
    const level = Number(b);
    const material = achievementMaterial(level);
    return a2 && Number.isInteger(level) && material ? { kind: 'achievement', key: achievementKey(a2.id, level), id: a2.id, level, material } : null;
  }
  return key === FEATURE_DAILY_KEY ? { kind: 'feature', key, feature: 'daily' } : null;
}

/** Valores de los logros (los mismos que muestra la Colección). `dailyPct` null = nunca participó. */
export function achievementValues(s: CatalogStats, dailyPct: number | null): Record<AchievementId, number | null> {
  return { racha: s.bestStreak, bloques: s.totalKilled, diasReto: s.dailyStreakBest, mejorReto: dailyPct };
}

/** Logros del reto diario: solo si el reto existe (sin API el juego es solo invitado y local). */
const achievementListed = (id: AchievementId, ctx: PrizeContext) => ctx.daily || (id !== 'diasReto' && id !== 'mejorReto');
const itemListed = (i: CatalogItem, ctx: PrizeContext) => !(i.requires === 'accounts' && !ctx.accounts) && !(i.requires === 'daily' && !ctx.daily);

/**
 * Logros que subieron entre dos momentos: uno por logro, con el material más alto alcanzado
 * (una racha de 30 en la primera partida es "Bronce", no "Madera" y después "Bronce").
 */
export function achievementUps(
  before: Record<AchievementId, number | null>,
  after: Record<AchievementId, number | null>,
  ctx: PrizeContext,
  only?: readonly AchievementId[],
): Celebration[] {
  const out: Celebration[] = [];
  for (const a of ACHIEVEMENTS) {
    if (only && !only.includes(a.id)) continue;
    if (!achievementListed(a.id, ctx)) continue;
    const lb = achievementLevel(a.id, before[a.id]);
    const la = achievementLevel(a.id, after[a.id]);
    const material = achievementMaterial(la);
    if (la > lb && material) out.push({ kind: 'achievement', key: achievementKey(a.id, la), id: a.id, level: la, material });
  }
  return out;
}

const tierCelebration = (tier: TierStep, first: boolean): Celebration => ({ kind: 'tier', key: tierKey(tier.index), tier, first });
const itemCelebration = (item: CatalogItem): Celebration => ({ kind: 'item', key: itemKey(item), item });

/**
 * Lo que se celebra al terminar una partida, en orden: insignia, premios (en el orden del
 * catálogo), logros y, al final, el reto del día y las misiones si esta partida los desbloqueó.
 * `prize` es el de la tarjeta de la pantalla final (`endPrize`), así ambos dicen lo mismo.
 */
export function runCelebrations(input: {
  prize: EndPrize | null;
  before: CatalogStats;
  after: CatalogStats;
  unlockedFeature: boolean;
  ctx: PrizeContext;
}): Celebration[] {
  const { prize, before, after, ctx } = input;
  const out: Celebration[] = [];
  if (prize?.tier) out.push(tierCelebration(prize.tier, prize.firstTier));
  for (const it of prize?.items ?? []) out.push(itemCelebration(it));
  // el mejor resultado en un reto diario llega después (respuesta del servidor): no cambia aquí
  out.push(...achievementUps(achievementValues(before, null), achievementValues(after, null), ctx, ['racha', 'bloques', 'diasReto']));
  if (input.unlockedFeature) out.push({ kind: 'feature', key: FEATURE_DAILY_KEY, feature: 'daily' });
  return out;
}

/** Lo que el jugador tenía en un momento (para comparar fuera de la partida). */
export interface Snapshot {
  /** De quién son (`useViewer().key`): si cambia (inicio o cierre de sesión), no se compara. */
  viewer: string;
  stats: CatalogStats;
  /** Mejor "mejor que el X %" en un reto diario (null si nunca participó). */
  dailyPct: number | null;
}

/** Requisitos que pueden cumplirse fuera de una partida de este dispositivo. */
const OUTSIDE_KINDS: ReadonlySet<Requirement['kind']> = new Set(['invited', 'level']);

/**
 * Lo que cambió entre dos momentos del mismo jugador que no se celebró al terminar la partida:
 * - un fondo por nivel, cuando lo completan los bloques extra de una misión (llegan después de
 *   la partida, al calcular las misiones);
 * - el logro "Mejor resultado en un reto diario" (se conoce cuando el servidor responde);
 * - Corazones, si cambian los invitados.
 *
 * Lo demás (insignias, otros premios, otros logros) solo cambia con una partida y se celebra al
 * terminarla (`runCelebrations`). Si cambió el jugador, no se celebra nada.
 *
 * Ojo: `celebrationQueue.observeCelebrations` solo la usa con datos de ESTE dispositivo y justo
 * después de una partida; los datos de la cuenta que llegan del servidor (que pueden venir de otro
 * dispositivo o estar atrasados) se registran sin celebrar.
 */
export function outsideCelebrations(prev: Snapshot | null, now: Snapshot, ctx: PrizeContext): Celebration[] {
  if (!prev || prev.viewer !== now.viewer) return [];
  const out: Celebration[] = [];
  for (const it of CATALOG) {
    if (!OUTSIDE_KINDS.has(it.req.kind) || !itemListed(it, ctx)) continue;
    if (!isUnlocked(it, prev.stats) && isUnlocked(it, now.stats)) out.push(itemCelebration(it));
  }
  out.push(...achievementUps(achievementValues(prev.stats, prev.dailyPct), achievementValues(now.stats, now.dailyPct), ctx, ['mejorReto']));
  return out;
}

/**
 * Claves que quedan celebradas con una celebración: la suya y las que deja atrás (subir a
 * Bronce sin pasar por Madera III también cuenta Madera III; un logro en Bronce, también Madera).
 */
export function coveredKeys(c: Celebration): string[] {
  switch (c.kind) {
    case 'tier':
      return Array.from({ length: c.tier.index + 1 }, (_, i) => tierKey(i));
    case 'achievement':
      return Array.from({ length: c.level }, (_, i) => achievementKey(c.id, i + 1));
    default:
      return [c.key];
  }
}

/**
 * Celebraciones que faltan por mostrar: sin las ya celebradas (`seen`) ni repetidas en la lista,
 * conservando el orden. Devuelve también las claves por guardar.
 */
export function pendingCelebrations(list: readonly Celebration[], seen: ReadonlySet<string>): { show: Celebration[]; mark: string[] } {
  const taken = new Set(seen);
  const show: Celebration[] = [];
  const mark: string[] = [];
  for (const c of list) {
    if (taken.has(c.key)) continue;
    show.push(c);
    for (const k of coveredKeys(c)) {
      if (!taken.has(k)) mark.push(k);
      taken.add(k);
    }
  }
  return { show, mark };
}

/**
 * Todo lo que el jugador ya tiene, como claves: con esto se siembra `tb_cele1` la primera vez
 * (quien ya jugaba no recibe de golpe las celebraciones de todo lo que ganó antes) y se van
 * sumando, sin celebrarlos, los cambios que no se celebran (otro dispositivo, inicio de sesión).
 */
export function ownedKeys(s: CatalogStats, dailyPct: number | null): string[] {
  const keys: string[] = [];
  const t = tierIndexOfStats(s);
  for (let i = 0; i <= t; i++) keys.push(tierKey(i));
  for (const it of CATALOG) if (it.req.kind !== 'always' && isUnlocked(it, s)) keys.push(itemKey(it));
  const v = achievementValues(s, dailyPct);
  for (const a of ACHIEVEMENTS) {
    const l = achievementLevel(a.id, v[a.id]);
    for (let i = 1; i <= l; i++) keys.push(achievementKey(a.id, i));
  }
  return keys;
}

// ---------------------------------------------------------------- textos

const NEW_LABEL: Record<CosmeticType, string> = {
  palette: 'Paleta nueva',
  sound: 'Sonido nuevo',
  effect: 'Efecto nuevo',
  background: 'Fondo nuevo',
};

/** Qué cambia cada tipo de premio. */
const TYPE_HINT: Record<CosmeticType, string> = {
  palette: 'Cambia los colores de los bloques.',
  sound: 'Cambia los sonidos del juego.',
  effect: 'Cambia cómo estallan los bloques al destruirlos.',
  background: 'Cambia el fondo del campo de juego.',
};

/** Por qué se ganó un premio: "Por subir a Bronce", "Por llegar al nivel 5"… */
export function reasonText(req: Requirement): string | null {
  switch (req.kind) {
    case 'always':
      return null;
    case 'runs':
      return req.n === 1 ? 'Por terminar tu primera partida' : `Por terminar ${req.n} partidas`;
    case 'tier':
      return `Por subir a ${TIERS[req.index].name}`;
    case 'streak':
      return `Por hacer una racha de ${req.n}`;
    case 'level':
      return `Por llegar al nivel ${req.n}`;
    case 'invited':
      return req.n === 1 ? 'Porque un amigo se unió con tu invitación' : `Porque ${req.n} amigos se unieron con tu invitación`;
    case 'dailyStreak':
      return `Por jugar el reto diario ${req.n} días seguidos`;
  }
}

/** "Llegar a las sumas y restas" (motor) → "Llegaste a las sumas y restas". */
const reachedText = (t: TierStep) =>
  t.at <= 0 ? 'Terminaste tu primera partida.' : `${t.goal.replace(/^Llegar\b/, 'Llegaste').replace(/^Terminar\b/, 'Terminaste')}.`;

export interface CelebrationTexts {
  /** Rótulo chico sobre el título ("Insignia nueva"). */
  kicker: string;
  title: string;
  /** Nombre grande de lo ganado (null si el título ya lo dice). */
  name: string | null;
  /** Por qué / qué es. */
  sub: string;
  /** Línea extra opcional. */
  hint: string | null;
}

export function celebrationTexts(c: Celebration): CelebrationTexts {
  switch (c.kind) {
    case 'tier':
      return {
        kicker: 'Insignia nueva',
        title: c.first ? '¡Tu primera insignia!' : '¡Subiste de insignia!',
        name: c.tier.name,
        sub: reachedText(c.tier),
        hint: 'Tus insignias y premios están en la Colección.',
      };
    case 'item':
      return {
        kicker: NEW_LABEL[c.item.type],
        title: '¡Desbloqueaste!',
        name: c.item.name,
        sub: reasonText(c.item.req) ?? TYPE_HINT[c.item.type],
        hint: c.item.note ? `${TYPE_HINT[c.item.type]} ${c.item.note}.` : TYPE_HINT[c.item.type],
      };
    case 'achievement': {
      const a = achievementById(c.id);
      return {
        kicker: 'Logro nuevo',
        title: `¡Logro de ${c.material}!`,
        name: a.name,
        sub: `${achievementGoal(c.id, c.level)}.`,
        hint: 'Tus logros están en la Colección.',
      };
    }
    case 'feature':
      return {
        kicker: 'Desbloqueado',
        title: '¡Desbloqueaste!',
        name: 'Reto del día y misiones',
        sub: 'Un reto nuevo cada día, el mismo para todos, y misiones que suman bloques a tu nivel.',
        hint: 'Los encuentras en el inicio.',
      };
  }
}

/** "1 de 3" (nada si es una sola). */
export const stepText = (index: number, total: number) => (total > 1 ? `${index + 1} de ${total}` : '');
