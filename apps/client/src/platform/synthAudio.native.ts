import { OfflineAudioContext as NativeOfflineContext } from 'react-native-audio-api';
import { liveContext } from './fx.native';
import type { SynthAudio } from './synthAudio.types';

// react-native-audio-api implementa la Web Audio API, pero con sus propios tipos: de ahí los
// `as unknown as` (las voces de game/synth usan solo lo que la librería tiene).

export const synthAudio: SynthAudio = {
  live() {
    try {
      return liveContext() as unknown as BaseAudioContext | null;
    } catch {
      return null;
    }
  },
  offline(length, sampleRate) {
    try {
      return new NativeOfflineContext(1, length, sampleRate) as unknown as OfflineAudioContext;
    } catch {
      return null;
    }
  },
  release(ctx) {
    // react-native-audio-api 1.0.0: cada contexto registra en un registro nativo un aviso de
    // `statechange` que apunta a sí mismo y nunca se quita, así que sin esto no se libera nunca
    // (con sus búferes e hilos). `stateChangeSubscription` es privado de la librería: revisar al
    // actualizarla.
    try {
      const c = ctx as unknown as { onstatechange: unknown; stateChangeSubscription?: { remove(): void } };
      c.onstatechange = null;
      c.stateChangeSubscription?.remove();
    } catch {}
  },
};
