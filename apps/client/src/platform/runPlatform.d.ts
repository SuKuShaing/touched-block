// Tipos de runPlatform.web.ts / runPlatform.native.ts (Metro elige el archivo según la plataforma).
import type { RunPlatform } from './runPlatform.types';
/** Plataforma de este dispositivo, o null si no se pudo saber. Nunca lanza. */
export declare function runPlatform(): RunPlatform | null;
