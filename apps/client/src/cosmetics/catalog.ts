import { TICKS_PER_SECOND, TIERS, type TierId, type TierStep, tierIndexForTicks } from '@tb/engine';
import { levelStart, xpOf } from '@/lib/level';

/**
 * Catálogo de premios cosméticos (plan, fase 2.4). Ninguno da ventaja. Nada se "entrega" ni se
 * guarda como ganado: lo desbloqueado se recalcula siempre desde las estadísticas, con
 * condiciones puras. La selección del jugador vive en `tb_set1` (`lib/settings.ts`).
 *
 * Requisitos provisorios (se confirman con el usuario antes de publicar).
 */
export type CosmeticType = 'palette' | 'sound' | 'effect' | 'background';

/** Estadísticas que deciden los premios (las del dispositivo y, con sesión, el máximo con las del servidor). */
export interface CatalogStats {
  /** Duración de la partida más larga, en ticks. Define la insignia. */
  bestTicks: number;
  bestStreak: number;
  totalKilled: number;
  /** Partidas terminadas. */
  runs: number;
  /** Bloques extra para el nivel (misiones, fase 5). */
  bonusXp: number;
  /** Amigos que pusieron mi usuario en "¿Quién te invitó?" (solo con cuenta). */
  invitedCount: number;
  /** Mejor racha de días seguidos del reto diario (fase 4). */
  dailyStreakBest: number;
}

export const EMPTY_CATALOG_STATS: CatalogStats = {
  bestTicks: 0,
  bestStreak: 0,
  totalKilled: 0,
  runs: 0,
  bonusXp: 0,
  invitedCount: 0,
  dailyStreakBest: 0,
};

export type Requirement =
  | { kind: 'always' }
  /** Terminar n partidas. */
  | { kind: 'runs'; n: number }
  /** Insignia: índice en `TIERS`. */
  | { kind: 'tier'; index: number }
  /** Mejor racha ≥ n. */
  | { kind: 'streak'; n: number }
  /** Nivel ≥ n (`lib/level.ts`). */
  | { kind: 'level'; n: number }
  /** Invitar a n amigos. */
  | { kind: 'invited'; n: number }
  /** n días seguidos de reto diario. */
  | { kind: 'dailyStreak'; n: number };

export interface CatalogItem {
  id: string;
  type: CosmeticType;
  name: string;
  /** Requisito en palabras ("Llega a las sumas y restas"). */
  goal: string;
  /** Aclaración opcional ("Pensada para daltónicos"). */
  note?: string;
  req: Requirement;
  /**
   * Función que tiene que existir para poder ganarlo: `accounts` (invitar amigos) o `daily`
   * (reto diario, fase 4). Quien muestra el catálogo puede ocultar lo que todavía no existe.
   */
  requires?: 'accounts' | 'daily';
}

/** Ajuste de `tb_set1` que guarda la selección de cada tipo. */
export const SETTING_KEY = {
  palette: 'palette',
  sound: 'soundPack',
  effect: 'effect',
  background: 'background',
} as const satisfies Record<CosmeticType, string>;

export type SelectionKey = (typeof SETTING_KEY)[CosmeticType];
export type Selection = Record<SelectionKey, string>;

/** Lo que se usa si no se eligió nada (igual que `DEFAULT_SETTINGS`). */
export const DEFAULT_SELECTION: Selection = { palette: 'clasica', soundPack: '8bits', effect: 'normal', background: 'liso' };

export const TYPE_ORDER: readonly CosmeticType[] = ['palette', 'sound', 'effect', 'background'];
export const TYPE_LABEL: Record<CosmeticType, string> = {
  palette: 'Paletas',
  sound: 'Sonidos',
  effect: 'Efectos al destruir',
  background: 'Fondos del campo',
};

// ---- requisitos ----

function tierIdx(tier: TierId, step = 1): number {
  const i = TIERS.findIndex((t) => t.tier === tier && t.step === step);
  if (i < 0) throw new Error(`insignia desconocida: ${tier} ${step}`);
  return i;
}

/** "Llegar a las sumas y restas" (motor) → "Llega a las sumas y restas". */
const imperative = (goal: string) => goal.replace(/^Llegar\b/, 'Llega').replace(/^Terminar\b/, 'Termina');

/** Requisito de una insignia, dicho al jugador: "Llega a las sumas y restas". */
export const tierGoal = (t: TierStep) => imperative(t.goal);

const ALWAYS: Requirement = { kind: 'always' };
/** 1650 → "1.650" (separador de miles en español, sin depender de Intl). */
export const fmtCount = (n: number) => String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const plural = (n: number, one: string, many: string) => `${fmtCount(n)} ${n === 1 ? one : many}`;

function goalOf(req: Requirement): string {
  switch (req.kind) {
    case 'always':
      return 'Disponible desde el inicio';
    case 'runs':
      return `Termina ${plural(req.n, 'partida', 'partidas')}`;
    case 'tier':
      return imperative(TIERS[req.index].goal);
    case 'streak':
      return `Haz una racha de ${req.n}`;
    case 'level':
      return `Llega al nivel ${req.n}`;
    case 'invited':
      return `Invita a ${plural(req.n, 'amigo', 'amigos')}`;
    case 'dailyStreak':
      return `Juega el reto diario ${req.n} días seguidos`;
  }
}

function item(id: string, type: CosmeticType, name: string, req: Requirement, extra: Partial<CatalogItem> = {}): CatalogItem {
  return { id, type, name, goal: goalOf(req), req, ...extra };
}

/** Catálogo inicial (plan, tabla de 2.4, más Constancia de la fase 4). Provisorio. */
export const CATALOG: readonly CatalogItem[] = [
  // paletas
  item('clasica', 'palette', 'Clásica', ALWAYS),
  item('contraste', 'palette', 'Alto contraste', ALWAYS, { note: 'Pensada para daltónicos' }), // gratis (D9)
  item('pastel', 'palette', 'Pastel', { kind: 'tier', index: tierIdx('madera', 2) }),
  item('neon', 'palette', 'Neón', { kind: 'tier', index: tierIdx('bronce') }),
  item('retro', 'palette', 'Retro', { kind: 'tier', index: tierIdx('plata') }),
  item('dorado', 'palette', 'Dorado', { kind: 'tier', index: tierIdx('oro') }),
  item('diamante', 'palette', 'Diamante', { kind: 'tier', index: tierIdx('diamante') }, { note: 'Con brillo' }),
  item('constancia', 'palette', 'Constancia', { kind: 'dailyStreak', n: 7 }, { requires: 'daily' }), // provisorio
  // sonidos
  item('8bits', 'sound', '8 bits', ALWAYS),
  item('suave', 'sound', 'Suave', { kind: 'runs', n: 1 }),
  item('marimba', 'sound', 'Marimba', { kind: 'tier', index: tierIdx('plata') }),
  // efectos al destruir
  item('normal', 'effect', 'Clásico', ALWAYS),
  item('chispas', 'effect', 'Chispas', { kind: 'tier', index: tierIdx('madera', 3) }),
  item('confeti', 'effect', 'Confeti', { kind: 'streak', n: 25 }),
  item('corazones', 'effect', 'Corazones', { kind: 'invited', n: 1 }, { requires: 'accounts' }),
  // fondos del campo
  item('liso', 'background', 'Liso', ALWAYS),
  item('grilla', 'background', 'Grilla', { kind: 'level', n: 5 }),
  item('estrellas', 'background', 'Estrellas', { kind: 'level', n: 10 }),
  item('aurora', 'background', 'Aurora', { kind: 'level', n: 20 }),
];

/** Premio por tipo e id (o undefined). */
export function findItem(type: CosmeticType, id: string | null | undefined): CatalogItem | undefined {
  return CATALOG.find((i) => i.type === type && i.id === id);
}

export function itemsOfType(type: CosmeticType): CatalogItem[] {
  return CATALOG.filter((i) => i.type === type);
}

// ---- estadísticas → insignia ----

/** Índice en TIERS de la insignia (−1 si todavía no terminó ninguna partida). */
export function tierIndexOfStats(s: Pick<CatalogStats, 'bestTicks' | 'runs'>): number {
  return s.runs > 0 || s.bestTicks > 0 ? tierIndexForTicks(s.bestTicks) : -1;
}

/** Insignia nueva si la partida la subió (para celebrarla antes que el resto), o null. */
export function tierUp(before: CatalogStats, after: CatalogStats): TierStep | null {
  const a = tierIndexOfStats(after);
  return a > tierIndexOfStats(before) ? TIERS[a] : null;
}

// ---- condiciones ----

export function meets(req: Requirement, s: CatalogStats): boolean {
  switch (req.kind) {
    case 'always':
      return true;
    case 'runs':
      return s.runs >= req.n;
    case 'tier':
      return tierIndexOfStats(s) >= req.index;
    case 'streak':
      return s.bestStreak >= req.n;
    case 'level':
      return xpOf(s) >= levelStart(req.n);
    case 'invited':
      return s.invitedCount >= req.n;
    case 'dailyStreak':
      return s.dailyStreakBest >= req.n;
  }
}

export function isUnlocked(item: CatalogItem, s: CatalogStats): boolean {
  return meets(item.req, s);
}

/** Ids desbloqueados, como `tipo:id` (los ids se repiten entre tipos solo por casualidad). */
export function unlockedIds(s: CatalogStats): string[] {
  return CATALOG.filter((i) => isUnlocked(i, s)).map((i) => `${i.type}:${i.id}`);
}

/** Premios que se desbloquearon entre dos momentos (para la tarjeta "¡Desbloqueaste Neón!"). */
export function newlyUnlocked(before: CatalogStats, after: CatalogStats): CatalogItem[] {
  return CATALOG.filter((i) => !isUnlocked(i, before) && isUnlocked(i, after));
}

// ---- cuánto falta ----

/** "28 s", "4 min", "6 min 30 s". */
export function fmtSeconds(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/**
 * Cuánto falta para un premio bloqueado, en minúsculas para ir después del requisito:
 * "te faltaron 28 s", "te faltan 120 bloques", "te faltan 2 partidas". null si ya está
 * desbloqueado, o si todavía no hay avance y solo repetiría el requisito ("Invita a 1 amigo ·
 * te falta 1 amigo").
 */
export function missingText(item: CatalogItem, s: CatalogStats): string | null {
  const req = item.req;
  if (meets(req, s)) return null;
  switch (req.kind) {
    case 'always':
      return null;
    case 'runs': {
      const n = req.n - s.runs;
      if (s.runs <= 0) return null;
      return `te ${n === 1 ? 'falta' : 'faltan'} ${plural(n, 'partida', 'partidas')}`;
    }
    case 'tier': {
      const missing = (TIERS[req.index].at * TICKS_PER_SECOND - s.bestTicks) / TICKS_PER_SECOND;
      return `${s.bestTicks > 0 ? 'te faltaron' : 'te faltan'} ${fmtSeconds(missing)}`;
    }
    case 'streak': {
      if (s.bestStreak <= 0) return null;
      return `te faltaron ${plural(req.n - s.bestStreak, 'bloque seguido', 'bloques seguidos')}`;
    }
    case 'level': {
      const n = levelStart(req.n) - xpOf(s);
      return `te ${n === 1 ? 'falta' : 'faltan'} ${plural(n, 'bloque', 'bloques')}`;
    }
    case 'invited': {
      if (s.invitedCount <= 0) return null;
      const n = req.n - s.invitedCount;
      return `te ${n === 1 ? 'falta' : 'faltan'} ${plural(n, 'amigo', 'amigos')}`;
    }
    case 'dailyStreak': {
      if (s.dailyStreakBest <= 0) return null;
      return `te faltaron ${plural(req.n - s.dailyStreakBest, 'día', 'días')}`;
    }
  }
}

/** "Neón: llega a las sumas y restas · te faltaron 28 s". */
export function lockedLine(item: CatalogItem, s: CatalogStats): string {
  const goal = item.goal.charAt(0).toLowerCase() + item.goal.slice(1);
  const miss = missingText(item, s);
  return `${item.name}: ${goal}${miss ? ` · ${miss}` : ''}`;
}

// ---- selección ----

/**
 * Lo que de verdad se usa: lo elegido en `tb_set1` si existe y está desbloqueado; si no, el
 * valor por defecto de su tipo.
 */
export function resolveSelection(settings: Partial<Selection>, s: CatalogStats): Selection {
  const out = { ...DEFAULT_SELECTION };
  for (const type of TYPE_ORDER) {
    const key = SETTING_KEY[type];
    const it = findItem(type, settings[key]);
    if (it && isUnlocked(it, s)) out[key] = it.id;
  }
  return out;
}
