import { liveContext } from './fx.web';
import type { SynthAudio } from './synthAudio.types';

export const synthAudio: SynthAudio = {
  live() {
    try {
      return liveContext(); // solo si ya nació en un gesto (ver fx.web.ts)
    } catch {
      return null;
    }
  },
  offline(length, sampleRate) {
    try {
      // un OfflineAudioContext no reproduce nada: no necesita gesto
      const w = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
      const Ctor = w.OfflineAudioContext || w.webkitOfflineAudioContext;
      return Ctor ? new Ctor(1, length, sampleRate) : null;
    } catch {
      return null;
    }
  },
  release() {}, // el navegador lo libera solo
};
