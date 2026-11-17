/** Datos de idioma/región del dispositivo que el motor JS no siempre trae (Hermes no tiene Intl.DisplayNames ni Intl.Locale). */
export interface DeviceLocale {
  /** Regiones del dispositivo en orden de preferencia ("CL", …), sin validar. En la web, vacío: se usan navigator.languages e Intl. */
  regions(): string[];
  /** Nombre en español de un país ISO-2 cuando Intl.DisplayNames no existe; null si no hay respaldo. */
  countryNameFallback(code: string): string | null;
}
