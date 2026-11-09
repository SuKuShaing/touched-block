/** Códigos ISO 3166-1 alfa-2 (los mismos que acepta la API: apps/api/src/common/countries.ts). */
const CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW';

export const COUNTRY_CODES: readonly string[] = CODES.split(' ');
const VALID = new Set(COUNTRY_CODES);

export const isCountry = (c: unknown): c is string => typeof c === 'string' && VALID.has(c.toUpperCase());

let names: { of(code: string): string | undefined } | null | undefined;

/** Nombre del país en español ("CL" → "Chile"); si Intl.DisplayNames no existe, el código. */
export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames(['es'], { type: 'region' });
    } catch {
      names = null;
    }
  }
  try {
    return names?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Bandera emoji a partir del código ISO-2 (indicadores regionales). */
export function flag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  const up = code.toUpperCase();
  return String.fromCodePoint(0x1f1e6 + up.charCodeAt(0) - 65, 0x1f1e6 + up.charCodeAt(1) - 65);
}

/** Países ordenados por su nombre en español. */
export function sortedCountries(): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Región del navegador ("es-CL" → "CL") si es un código ISO válido; si no, null. */
export function browserCountry(): string | null {
  try {
    const langs: string[] = [];
    if (typeof navigator !== 'undefined') {
      if (Array.isArray(navigator.languages)) langs.push(...navigator.languages);
      if (navigator.language) langs.push(navigator.language);
    }
    try {
      langs.push(Intl.DateTimeFormat().resolvedOptions().locale);
    } catch {}
    for (const l of langs) {
      let region: string | undefined;
      try {
        region = new Intl.Locale(l).region;
      } catch {
        region = /[-_]([A-Za-z]{2})(?:$|[-_])/.exec(l)?.[1];
      }
      if (region && isCountry(region)) return region.toUpperCase();
    }
  } catch {}
  return null;
}
