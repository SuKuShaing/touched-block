/**
 * Filtro de nombres de usuario (guía 1.2 de Apple: contenido generado por usuarios). Los nombres
 * son lo único que un jugador escribe y otros ven (rankings, perfiles, búsqueda).
 *
 * Bloquea groserías, insultos y términos de odio (español, con chilenismos, e inglés) y nombres
 * que se hacen pasar por el juego, su equipo o una marca. Antes de comparar normaliza:
 * minúsculas, sin tildes, separadores (`.`, `_`, dígitos sueltos), sustituciones típicas
 * (0→o, 1→i/l, 3→e, 4→a, 5→s, 7→t, @→a, $→s) y letras repetidas ("puuuta").
 *
 * Para no bloquear palabras inocentes que contienen una grosería ("computadora", "Vergara",
 * "badminton", "pineapple", "therapist", "Yamashita"), cada término está en una de tres listas:
 * - `SUBSTR`: términos largos o inequívocos; se buscan en cualquier parte del nombre.
 * - `WORDS`: palabras cortas o con otros significados; solo cuentan como palabra completa (un
 *   trozo entre separadores, o el nombre entero sin separadores), con un artículo delante
 *   opcional ("el", "la", "tu"…) y un plural o diminutivo detrás opcional.
 * - `EDGE`: cuentan al principio o al final de una palabra ("admin123", "seba_admin").
 * Los tests (`username-filter.spec.ts`) tienen casos de los dos lados; al agregar un término,
 * agrega también un caso negativo si se parece a una palabra común.
 */

export type NameProblemKind = 'offensive' | 'impersonation';

// ---------------------------------------------------------------- listas

/** Groserías, insultos y odio que se buscan en cualquier parte. */
const OFFENSIVE_SUBSTR = [
  // español
  'mierda',
  'conchetu',
  'conchatu',
  'conchesu',
  'conchasu',
  'conchadesu',
  'chuchetu',
  'culiao',
  'culiau',
  'culiado',
  'culiada',
  'qliao',
  'qliado',
  'aweonao',
  'aweonado',
  'aweona',
  'maricon',
  'mariposon',
  'pendej',
  'cabron',
  'hijodeputa',
  'hijadeputa',
  'hijoeputa',
  'hijueputa',
  'hijaeputa',
  'putamadre',
  'chupala',
  'chupalo',
  'chupame',
  'chupapico',
  'chupapija',
  'chupapinga',
  'chupapolla',
  'chupaverga',
  'comepico',
  'comeverga',
  'mamapico',
  'mamaverga',
  'mamahuevo',
  'malparid',
  'gonorrea',
  'imbecil',
  'estupid',
  'retrasad',
  'subnormal',
  'mongolic',
  'sudaca',
  'negrata',
  'tortillera',
  'violador',
  'pedofil',
  'pederast',
  'zoofil',
  'necrofil',
  'matajudio',
  'matanegro',
  'matagay',
  'matamaricon',
  'matamujer',
  'terrorist',
  'hitler',
  'siegheil',
  'heilhitler',
  // inglés
  'fuck',
  'fvck',
  'phuck',
  'motherf',
  'bullshit',
  'shithead',
  'shitty',
  'bitch',
  'biatch',
  'asshole',
  'arsehole',
  'bastard',
  'dickhead',
  'cocksuck',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'whore',
  'wanker',
  'porn',
  'hentai',
  'dildo',
  'jizz',
  'pedophil',
  'paedophil',
  'wetback',
  'tranny',
  'killyourself',
];

/** Palabras que solo cuentan completas (con artículo delante y plural o diminutivo detrás opcionales). */
const OFFENSIVE_WORDS_ES = [
  'puta',
  'puto',
  'putita',
  'putito',
  'verga',
  'pija',
  'pinga',
  'polla',
  'pene',
  'culo',
  'culia',
  'teta',
  'tetona',
  'orto',
  'chucha',
  'zorra',
  'maraco',
  'weon',
  'weona',
  'hueon',
  'hueona',
  'huevon',
  'huevona',
  'gueon',
  'mamon',
  'jodete',
  'follar',
  'idiota',
  'joto',
  'travelo',
  'bollera',
  'nazi',
  'ctm',
  'csm',
  'hdp',
  'ql',
];
const OFFENSIVE_WORDS_EN = [
  'shit',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'slut',
  'fag',
  'rape',
  'rapist',
  'penis',
  'vagina',
  'anal',
  'boob',
  'tits',
  'twat',
  'chink',
  'spic',
  'dyke',
  'kys',
];

/** Suplantación del juego, su equipo o una marca: en cualquier parte. */
const IMPERSONATION_SUBSTR = [
  'touchedblock',
  'touchedblok',
  'touchblock',
  'oficial',
  'official',
  'soporte',
  'support',
  'moderador',
  'moderator',
  'administrador',
  'administrator',
  'google',
  'playstore',
  'appstore',
  'appleid',
  'applesupport',
  'verificado',
  'verified',
];
/** Suplantación: al principio o al final de una palabra. */
const IMPERSONATION_EDGE = ['admin'];
/** Suplantación: solo como palabra completa. */
const IMPERSONATION_WORDS = ['mod', 'mods', 'staff', 'root', 'sistema', 'system', 'apple', 'desarrollador', 'developer', 'owner'];

/** Artículos y muletillas que pueden ir pegados delante de una palabra ("elputo", "soyadmin"). */
const PREFIXES = ['el', 'la', 'lo', 'los', 'las', 'tu', 'su', 'soy'];
const SUFFIXES_ES = ['s', 'es', 'ito', 'ita', 'itos', 'itas', 'on', 'ona', 'azo', 'aza'];
const SUFFIXES_EN = ['s', 'z'];

/** Términos que no se comparan con letras repetidas ("kkkk" es una risa; "kkk" no). */
const EXACT_DIGIT_RUNS = ['1488'];

// ---------------------------------------------------------------- normalización

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' };
const SYMBOLS: Record<string, string> = { '@': 'a', $: 's', '!': 'i', '|': 'l', '€': 'e' };
const isLetter = (c: string | undefined) => !!c && c >= 'a' && c <= 'z';

/** Minúsculas, sin tildes y con @ $ ! | € cambiados por la letra que imitan. */
function baseForm(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[@$!|€]/g, (c) => SYMBOLS[c]);
}

/**
 * Cambia los dígitos pegados a una letra por la letra que imitan. Los dígitos sueltos
 * ("seba_99") quedan como separadores. `one = 'l'` solo cambia el 1 si está entre dos letras
 * ("cu1iao"), para no convertir "ana1" en otra cosa.
 */
function mapDigits(base: string, one: 'i' | 'l'): string {
  return base.replace(/\d+/g, (run, off: number) => {
    const before = isLetter(base[off - 1]);
    const after = isLetter(base[off + run.length]);
    if (!before && !after) return run;
    return [...run]
      .map((d) => {
        if (d === '1') return one === 'i' ? 'i' : before && after ? 'l' : d;
        return LEET[d] ?? d;
      })
      .join('');
  });
}

interface Form {
  /** Trozos de letras entre separadores. */
  tokens: string[];
  /** Todas las letras seguidas (sin separadores). */
  joined: string;
}

/** Las formas a revisar: con 1→i, con 1→l y con los dígitos como separadores. */
function formsOf(raw: string): Form[] {
  const base = baseForm(raw);
  const variants = new Set([mapDigits(base, 'i'), mapDigits(base, 'l'), base]);
  return [...variants].map((v) => {
    const tokens = v.split(/[^a-z]+/).filter(Boolean);
    return { tokens, joined: tokens.join('') };
  });
}

// ---------------------------------------------------------------- patrones

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Cada letra puede repetirse: "puta" → p+u+t+a+ (encuentra "puuutaaa"). */
const rep = (w: string) => [...w].map((c) => escape(c) + '+').join('');
const alt = (xs: string[]) => '(?:' + xs.map(escape).join('|') + ')';

const substrRe = (words: string[]) => new RegExp(words.map(rep).join('|'));
const wordRe = (words: string[], suffixes: string[]) =>
  new RegExp('^' + alt(PREFIXES) + '?(?:' + words.map(rep).join('|') + ')' + (suffixes.length ? alt(suffixes) + '?' : '') + '$');

const RE = {
  offensiveSubstr: substrRe(OFFENSIVE_SUBSTR),
  offensiveEs: wordRe(OFFENSIVE_WORDS_ES, SUFFIXES_ES),
  offensiveEn: wordRe(OFFENSIVE_WORDS_EN, SUFFIXES_EN),
  kkk: /^kkk$/,
  impersonationSubstr: substrRe(IMPERSONATION_SUBSTR),
  impersonationEdge: new RegExp('^(?:' + IMPERSONATION_EDGE.map(rep).join('|') + ')|(?:' + IMPERSONATION_EDGE.map(rep).join('|') + ')$'),
  impersonationWords: wordRe(IMPERSONATION_WORDS, []),
};

const anyWord = (f: Form, re: RegExp) => f.tokens.some((t) => re.test(t)) || re.test(f.joined);

/**
 * Qué problema tiene un nombre según el filtro: `offensive` (grosería, insulto u odio),
 * `impersonation` (se hace pasar por el juego, su equipo o una marca) o null si pasa.
 */
export function nameFilterProblem(raw: string): NameProblemKind | null {
  if (typeof raw !== 'string' || !raw) return null;
  const forms = formsOf(raw);
  const digitRuns = baseForm(raw).match(/\d+/g) ?? [];
  if (digitRuns.some((d) => EXACT_DIGIT_RUNS.includes(d))) return 'offensive';
  for (const f of forms) {
    if (RE.offensiveSubstr.test(f.joined)) return 'offensive';
    if (anyWord(f, RE.offensiveEs) || anyWord(f, RE.offensiveEn) || anyWord(f, RE.kkk)) return 'offensive';
  }
  for (const f of forms) {
    if (RE.impersonationSubstr.test(f.joined)) return 'impersonation';
    if (anyWord(f, RE.impersonationEdge) || anyWord(f, RE.impersonationWords)) return 'impersonation';
  }
  return null;
}

/** Mensajes para el jugador (los muestra el cliente tal cual). */
export const NAME_FILTER_MESSAGES: Record<NameProblemKind, string> = {
  offensive: 'Ese nombre no está permitido: no puede tener groserías, insultos ni lenguaje ofensivo. Elige otro.',
  impersonation: 'Ese nombre no está permitido: no puede hacerse pasar por Touched Block, su equipo ni otra marca. Elige otro.',
};
