import {
  type AchievementId,
  TICKS_PER_SECOND,
  TIERS,
  type TierStep,
  achievementById,
  achievementGoal,
  achievementLevel,
  achievementMaterial,
  tierIndexForTicks,
} from '@tb/engine';
import { config } from '@/config';
import { achievementValues } from '@/lib/achievementValues';
import { levelStart, xpOf } from '@/lib/level';
import type { BackgroundId, EffectId, PaletteId, SoundId } from './ids';

/**
 * Catálogo de premios cosméticos (plan, fase 2.4). Ninguno da ventaja. Nada se "entrega" ni se
 * guarda como ganado: lo desbloqueado se recalcula siempre desde las estadísticas, con
 * condiciones puras. La selección del jugador vive en `tb_set1` (`lib/settings.ts`).
 *
 * El orden de `CATALOG` es el de las filas de la Colección y el de las celebraciones. Paletas por
 * nivel, sonidos por insignia, efectos y fondos por logro (uno por escalón de cada logro) y tres
 * premios por invitar amigos.
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
  /**
   * Mejor "mejor que el X %" en un reto diario; null si nunca participó (participar con 0 % ya
   * cuenta). Con sesión es el de la cuenta; como invitado, el de este dispositivo.
   */
  bestDailyPct: number | null;
}

export const EMPTY_CATALOG_STATS: CatalogStats = {
  bestTicks: 0,
  bestStreak: 0,
  totalKilled: 0,
  runs: 0,
  bonusXp: 0,
  invitedCount: 0,
  dailyStreakBest: 0,
  bestDailyPct: null,
};

export type Requirement =
  | { kind: 'always' }
  /** Terminar n partidas. */
  | { kind: 'runs'; n: number }
  /** Insignia: índice en `TIERS`. */
  | { kind: 'tier'; index: number }
  /** Nivel de experiencia ≥ n (`lib/level.ts`). */
  | { kind: 'level'; n: number }
  /** Invitar a n amigos. */
  | { kind: 'invited'; n: number }
  /** Escalón de un logro: 1 = Papel … 7 = Diamante (umbrales en el motor). */
  | { kind: 'achievement'; id: AchievementId; level: AchievementStep };

/** Escalón de un logro que puede pedir un premio. */
export type AchievementStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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

/** "Llegar a las sumas y restas" (motor) → "Llega a las sumas y restas". */
const imperative = (goal: string) => goal.replace(/^Llegar\b/, 'Llega').replace(/^Terminar\b/, 'Termina');

/** Requisito de una insignia, dicho al jugador: "Llega a las sumas y restas". */
export const tierGoal = (t: TierStep) => imperative(t.goal);

const ALWAYS: Requirement = { kind: 'always' };
/** 1650 → "1.650" (separador de miles en español, sin depender de Intl). */
export const fmtCount = (n: number) => String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const plural = (n: number, one: string, many: string) => `${fmtCount(n)} ${n === 1 ? one : many}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function goalOf(req: Requirement): string {
  switch (req.kind) {
    case 'always':
      return 'Disponible desde el inicio';
    case 'runs':
      return `Termina ${plural(req.n, 'partida', 'partidas')}`;
    case 'tier': {
      const t = TIERS[req.index];
      return `Insignia ${t.name} · ${tierGoal(t)}`;
    }
    case 'level':
      return `Llega al nivel ${req.n}`;
    case 'invited':
      return `Invita a ${plural(req.n, 'amigo', 'amigos')}`;
    case 'achievement':
      return `Logro ${achievementById(req.id).name} · ${achievementMaterial(req.level)} (${lowerFirst(achievementGoal(req.id, req.level))})`;
  }
}

/** Lo que tiene que existir para ganarlo: cuentas (invitar) o el reto diario (sus dos logros). */
function requiresOf(req: Requirement): CatalogItem['requires'] {
  if (req.kind === 'invited') return 'accounts';
  if (req.kind === 'achievement' && (req.id === 'diasReto' || req.id === 'mejorReto')) return 'daily';
  return undefined;
}

function item(id: string, type: CosmeticType, name: string, req: Requirement, note?: string): CatalogItem {
  const requires = requiresOf(req);
  return { id, type, name, goal: goalOf(req), req, ...(note ? { note } : {}), ...(requires ? { requires } : {}) };
}

// uno por tipo, para que un id mal escrito no compile
const palette = (id: PaletteId, name: string, req: Requirement, note?: string) => item(id, 'palette', name, req, note);
const sound = (id: SoundId, name: string, req: Requirement, note?: string) => item(id, 'sound', name, req, note);
const effect = (id: EffectId, name: string, req: Requirement, note?: string) => item(id, 'effect', name, req, note);
const background = (id: BackgroundId, name: string, req: Requirement, note?: string) => item(id, 'background', name, req, note);

const tier = (index: number): Requirement => ({ kind: 'tier', index });
const level = (n: number): Requirement => ({ kind: 'level', n });
const invited = (n: number): Requirement => ({ kind: 'invited', n });
const ach = (id: AchievementId, step: AchievementStep): Requirement => ({ kind: 'achievement', id, level: step });

/** Los 55 premios, en el orden en que se muestran. */
export const CATALOG: readonly CatalogItem[] = [
  // paletas: por nivel (Amistad, invitando)
  palette('clasica', 'Clásica', ALWAYS),
  palette('contraste', 'Alto contraste', ALWAYS, 'Pensada para daltónicos'), // gratis (D9)
  palette('pastel', 'Pastel', level(3)),
  palette('neon', 'Neón', level(7)),
  palette('tenue', 'Tenue', level(9), 'Relleno atenuado, borde intenso'),
  palette('cristal', 'Cristal', level(12), 'Translúcida, con brillo'),
  palette('retro', 'Retro', level(15)),
  palette('boton', 'Botón', level(16), 'Relieve interior de botón'),
  palette('contorno', 'Contorno', level(18), 'Borde intenso, relleno translúcido'),
  palette('degrade', 'Degradé', level(22), 'Degradé sutil, relleno opaco'),
  palette('dorado', 'Dorado', level(25)),
  palette('esmerilado', 'Esmerilado', level(27), 'Vidrio esmerilado, color insinuado'),
  palette('diamante', 'Diamante', level(30), 'Con brillo'),
  palette('constancia', 'Amistad', invited(2)),
  // sonidos: desde Marimba, uno por insignia
  sound('8bits', '8 bits', ALWAYS),
  sound('suave', 'Suave', { kind: 'runs', n: 1 }),
  sound('marimba', 'Marimba', tier(0)),
  sound('palitos', 'Palitos', tier(1), 'Dos palitos de madera que chocan'),
  sound('electronico', 'Electrónico', tier(2), 'Sintetizador: sierras con filtro que se cierra'),
  sound('viento', 'Viento', tier(3), 'Flauta: soplo suave con vibrato'),
  sound('piano', 'Piano', tier(4), 'Piano sintético: cuerdas y golpe de martillo'),
  sound('guitarra', 'Guitarra eléctrica', tier(5), 'Distorsionada: toque con la palma, acorde al destruir'),
  sound('futurista', 'Futurista', tier(6), 'Tonos metálicos que suben, con eco'),
  // efectos al destruir: por logro (Corazones, invitando)
  effect('normal', 'Clásico', ALWAYS),
  effect('chispas', 'Chispas', ach('partidas', 1)),
  effect('emojis', 'Emojis', ach('diasReto', 1), 'Emojis que saltan: 🎉 ⭐ 🔥 💥 😎 😍 💯 ✨'),
  effect('confeti', 'Confeti', ach('racha', 2)),
  effect('burbujas', 'Burbujas', ach('mejorReto', 2), 'Burbujas con reflejo que suben y revientan'),
  effect('ondas', 'Ondas', ach('diasReto', 3), 'Anillos que se expanden y gotas'),
  effect('rayos', 'Rayos', ach('racha', 4), 'Rayos en zigzag con un destello'),
  effect('monedas', 'Monedas', ach('partidas', 4), 'Monedas que giran y caen'),
  effect('pixeles', 'Píxeles', ach('racha', 7), 'El bloque se rompe en píxeles que saltan y caen, como en 8 bits'),
  effect('fugaces', 'Estrellas fugaces', ach('diasReto', 7), 'Estrellas con estela que cruzan el bloque en diagonal'),
  effect('fuegos', 'Fuegos artificiales', ach('mejorReto', 7), 'Un cohete sube y estalla en chispas'),
  effect('corazones', 'Corazones', invited(1)),
  // fondos del campo: por logro (Bosque nocturno, invitando)
  background('liso', 'Liso', ALWAYS),
  background('grilla', 'Grilla', ach('racha', 1)),
  background('rayas', 'Rayas', ach('mejorReto', 1), 'Rayas diagonales violetas, del morado al azul'),
  background('estrellas', 'Estrellas', ach('partidas', 2)),
  background('puntos', 'Puntos', ach('diasReto', 2), 'Puntos violetas y celestes sobre azul índigo'),
  background('circuito', 'Circuito', ach('racha', 3), 'Pistas de placa electrónica sobre verde azulado'),
  background('aurora', 'Aurora', ach('partidas', 3)),
  background('hexagonos', 'Hexágonos', ach('mejorReto', 3), 'Panal de líneas celestes sobre azul'),
  background('atardecer', 'Atardecer', ach('diasReto', 4), 'Del azul índigo al ámbar, con el sol tras los montes'),
  background('topografia', 'Topografía', ach('mejorReto', 4), 'Curvas de nivel doradas sobre verde oliva'),
  background('oceano', 'Océano', ach('racha', 5), 'Agua azul con rayos de luz y burbujas'),
  background('ciudad', 'Ciudad nocturna', ach('partidas', 5), 'Rascacielos con ventanas encendidas'),
  background('cristales', 'Cristales', ach('diasReto', 5), 'Cuarzos turquesas y violetas'),
  background('lluvia', 'Lluvia', ach('mejorReto', 5), 'Lluvia azul acero que cae (animado)'),
  background('nebulosa', 'Nebulosa', ach('racha', 6), 'Nubes de gas violetas, turquesas y magentas'),
  background('nieve', 'Nieve', ach('partidas', 6), 'Copos que bajan sobre lomas nevadas (animado)'),
  background('luciernagas', 'Luciérnagas', ach('diasReto', 6), 'Luces que laten sobre el pasto (animado)'),
  background('vitral', 'Vitral', ach('mejorReto', 6), 'Vidrios de colores con uniones de plomo'),
  background('galaxia', 'Galaxia', ach('partidas', 7), 'Una galaxia espiral que gira muy lento (animado)'),
  background('bosque', 'Bosque nocturno', invited(3), 'Pinos verdes bajo la luna'),
];

/** Premio por tipo e id (o undefined). */
export function findItem(type: CosmeticType, id: string | null | undefined): CatalogItem | undefined {
  return CATALOG.find((i) => i.type === type && i.id === id);
}

export function itemsOfType(type: CosmeticType): CatalogItem[] {
  return CATALOG.filter((i) => i.type === type);
}

// ---- estadísticas → insignia ----

/** Índice en TIERS de la insignia (−1 sin partidas o si la mejor no llega a la primera, Papel). */
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
    case 'level':
      return xpOf(s) >= levelStart(req.n);
    case 'invited':
      return s.invitedCount >= req.n;
    case 'achievement':
      return achievementLevel(req.id, achievementValues(s)[req.id]) >= req.level;
  }
}

/** Si el premio se puede usar. En el APK de prueba (`config.unlockAll`) están todos. */
export function isUnlocked(item: CatalogItem, s: CatalogStats): boolean {
  return config.unlockAll || meets(item.req, s);
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
 * te falta 1 amigo"). El porcentaje del reto no dice cuánto falta.
 */
export function missingText(item: CatalogItem, s: CatalogStats): string | null {
  const req = item.req;
  if (isUnlocked(item, s)) return null;
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
    case 'level': {
      const n = levelStart(req.n) - xpOf(s);
      return `te ${n === 1 ? 'falta' : 'faltan'} ${plural(n, 'bloque', 'bloques')}`;
    }
    case 'invited': {
      if (s.invitedCount <= 0) return null;
      const n = req.n - s.invitedCount;
      return `te ${n === 1 ? 'falta' : 'faltan'} ${plural(n, 'amigo', 'amigos')}`;
    }
    case 'achievement': {
      // sin avance (o sin un número que decir) queda solo el requisito
      const value = achievementValues(s)[req.id] ?? 0;
      if (req.id === 'mejorReto' || value <= 0) return null;
      const n = achievementById(req.id).thresholds[req.level - 1] - value;
      if (req.id === 'partidas') return `te ${n === 1 ? 'falta' : 'faltan'} ${plural(n, 'partida', 'partidas')}`;
      const verb = n === 1 ? 'te faltó' : 'te faltaron';
      return `${verb} ${req.id === 'racha' ? plural(n, 'bloque seguido', 'bloques seguidos') : plural(n, 'día', 'días')}`;
    }
  }
}

/** "Neón: llega a las sumas y restas · te faltaron 28 s". */
export function lockedLine(item: CatalogItem, s: CatalogStats): string {
  const miss = missingText(item, s);
  return `${item.name}: ${lowerFirst(item.goal)}${miss ? ` · ${miss}` : ''}`;
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
