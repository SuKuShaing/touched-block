/** Almacenamiento clave/valor síncrono. Nunca lanza: si falla, devuelve null o no guarda. */
export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
