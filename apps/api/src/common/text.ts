/**
 * Recorta un texto a `max` caracteres sin partir emojis ni otros caracteres fuera del plano básico.
 * `String.slice` cuenta unidades UTF-16 y puede dejar medio par sustituto, que Postgres guarda
 * como «�»; `@MaxLength` y `VarChar(n)` cuentan caracteres reales (code points), igual que esta función.
 */
export function truncateChars(s: string, max: number): string {
  if (s.length <= max) return s; // en UTF-16 nunca hay menos unidades que caracteres
  return Array.from(s).slice(0, Math.max(0, max)).join('');
}

/** Cantidad de caracteres reales (code points). */
export const charLength = (s: string) => Array.from(s).length;
