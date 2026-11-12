import { getActiveCosmetics } from '@/cosmetics/active';
import { fx } from '@/platform/fx';
import type { Wave } from '@/platform/fx.types';

/**
 * Sonidos del juego por paquete (premio cosmético). Todos se generan con WebAudio (`fx.beep`),
 * sin archivos de audio. `fx` ya respeta los ajustes de sonido y vibración y nunca lanza.
 *
 * Uso (desde GameScreen):
 *   sounds.play('start')            // dentro del toque de "Jugar" (iOS solo habilita el audio en un gesto)
 *   sounds.play('hit', toquesDados) // toques dados al bloque (b.total − b.left)
 *   sounds.play('combo', ev.bonus)  // segundos de premio
 *   sounds.play('kill' | 'trap' | 'heal' | 'expire' | 'miss' | 'end' | 'milestone')
 *
 * El paquete es el elegido en la Colección (`tb_set1.soundPack`, validado contra lo desbloqueado;
 * desconocido → `8bits`). La vibración es la misma en todos los paquetes.
 */
export type SoundName = 'start' | 'hit' | 'kill' | 'trap' | 'heal' | 'expire' | 'miss' | 'combo' | 'end' | 'milestone';
export type SoundPackId = '8bits' | 'suave' | 'marimba';

type Pack = Record<SoundName, (arg: number) => void>;

const beep = (f: number, d: number, type?: Wave, v?: number) => fx.beep(f, d, type, v);
const after = (ms: number, fn: () => void) => setTimeout(fn, ms);
/** Notas seguidas: la primera al tiro, las demás cada `gap` ms. */
function arpeggio(notes: readonly number[], gap: number, play: (f: number) => void) {
  notes.forEach((f, i) => (i === 0 ? play(f) : after(i * gap, () => play(f))));
}

// ---- 8 bits: los tonos de siempre (los mismos valores que tenía GameScreen) ----
const bits8: Pack = {
  start: () => beep(520, 0.1, 'triangle', 0.08),
  // tono que sube con cada toque, con tope para que los bloques largos (25 toques) no chillen
  hit: (n) => fx.beep(300 + Math.min(n, 12) * 70, 0.07),
  kill: () => beep(880, 0.15, 'triangle', 0.09),
  trap: () => beep(90, 0.4, 'sawtooth', 0.12),
  heal: () => [660, 880, 1320].forEach((f, i) => after(i * 70, () => beep(f, 0.1, 'triangle', 0.07))),
  expire: () => beep(150, 0.15, 'sawtooth', 0.05),
  miss: () => beep(120, 0.25, 'sawtooth', 0.08),
  // arpegio corto y agradable para los premios de combo (más notas cuanto mayor el premio)
  combo: (bonus) => arpeggio([660, 830, 990, 1320, 1660].slice(0, Math.min(5, bonus + 2)), 65, (f) => beep(f, 0.09, 'triangle', 0.06)),
  end: () => beep(200, 0.5, 'sawtooth', 0.08),
  milestone: () => arpeggio([523, 659, 784], 90, (f) => beep(f, 0.12, 'triangle', 0.07)),
};

// ---- Suave: ondas senoidales, notas más graves y volumen más bajo ----
const soft = (f: number, d = 0.12, v = 0.06) => beep(f, d, 'sine', v);
const suave: Pack = {
  start: () => soft(440, 0.12, 0.07),
  hit: (n) => soft(330 + Math.min(n, 12) * 35, 0.08, 0.06),
  kill: () => {
    soft(660, 0.12, 0.07);
    after(60, () => soft(990, 0.14, 0.05));
  },
  trap: () => beep(110, 0.45, 'triangle', 0.12),
  heal: () => arpeggio([523, 659, 784], 80, (f) => soft(f, 0.12)),
  expire: () => soft(196, 0.18, 0.05),
  miss: () => beep(147, 0.25, 'triangle', 0.07),
  combo: (bonus) => arpeggio([523, 587, 659, 784, 880].slice(0, Math.min(5, bonus + 2)), 70, (f) => soft(f, 0.1, 0.05)),
  end: () => arpeggio([392, 330, 262], 140, (f) => soft(f, 0.25)),
  milestone: () => arpeggio([392, 523, 659, 784], 100, (f) => soft(f, 0.14)),
};

// ---- Marimba: golpe de mazo (fundamental + un armónico muy corto) sobre una escala pentatónica ----
const SCALE = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319];
function mallet(f: number, d = 0.22, v = 0.08) {
  beep(f, d, 'sine', v);
  beep(f * 4, 0.05, 'sine', v * 0.35);
}
const marimba: Pack = {
  start: () => mallet(523),
  hit: (n) => mallet(SCALE[Math.min(Math.max(0, n), 12)], 0.16, 0.07),
  kill: () => {
    mallet(784, 0.25, 0.09);
    after(70, () => mallet(1047, 0.2, 0.06));
  },
  trap: () => {
    mallet(131, 0.5, 0.14);
    after(90, () => mallet(123, 0.45, 0.1));
  },
  heal: () => arpeggio([784, 988, 1175], 70, (f) => mallet(f, 0.18, 0.07)),
  expire: () => mallet(196, 0.2, 0.05),
  miss: () => mallet(165, 0.3, 0.08),
  combo: (bonus) => arpeggio([659, 784, 880, 1047, 1319].slice(0, Math.min(5, bonus + 2)), 65, (f) => mallet(f, 0.14, 0.06)),
  end: () => arpeggio([523, 392, 330, 262], 150, (f) => mallet(f, 0.3, 0.08)),
  milestone: () => arpeggio([523, 659, 784, 1047], 90, (f) => mallet(f, 0.18, 0.07)),
};

export const SOUND_PACKS: Record<SoundPackId, Pack> = { '8bits': bits8, suave, marimba };
export const DEFAULT_SOUND_PACK: SoundPackId = '8bits';

/** Vibración de cada sonido (ms; 0 = sin vibración). Igual en todos los paquetes. */
export const BUZZ: Record<SoundName, number> = {
  start: 0,
  hit: 10,
  kill: 30,
  trap: 250,
  heal: 40,
  expire: 0,
  miss: 80,
  combo: 25,
  end: 150,
  milestone: 30,
};

function packOf(id: string | null | undefined): Pack {
  return id && Object.prototype.hasOwnProperty.call(SOUND_PACKS, id) ? SOUND_PACKS[id as SoundPackId] : SOUND_PACKS[DEFAULT_SOUND_PACK];
}

export const sounds = {
  /**
   * Toca un sonido con el paquete en uso (o con `packId`, para escucharlo en la Colección).
   * `arg`: toques dados al bloque en `hit`, segundos de premio en `combo`.
   */
  play(name: SoundName, arg = 0, packId?: string) {
    try {
      packOf(packId ?? getActiveCosmetics().soundPack)[name](arg);
    } catch {}
    const ms = BUZZ[name];
    if (ms > 0) fx.buzz(ms);
  },
  /** Muestra corta de un paquete (al elegirlo en la Colección): golpes, destruir y un combo. */
  preview(packId: string) {
    try {
      const p = packOf(packId);
      p.hit(1);
      after(110, () => p.hit(2));
      after(220, () => p.kill(0));
      after(480, () => p.combo(1));
    } catch {}
  },
};
