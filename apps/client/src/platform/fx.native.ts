import { AppState, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AudioContext, AudioManager } from 'react-native-audio-api';
import { getSettings } from '@/lib/settings';
import type { Fx, Wave } from './fx.types';

// Sonido: react-native-audio-api implementa la Web Audio API, así que el pitido es el mismo
// grafo que en fx.web.ts (oscilador → ganancia con caída exponencial → salida) y suena igual.
// Vibración: expo-haptics para los toques cortos (más nítidos que un motor encendido N ms) y
// Vibration.vibrate(ms) para los largos. Todo en try/catch: nunca lanza. Respetan los ajustes
// del dispositivo (Perfil → En este dispositivo): sonido y vibración.
let ac: AudioContext | null = null;
let lifecycleHooked = false;

function context(): AudioContext {
  if (!ac) {
    try {
      // iOS: categoría "ambient" + mezclar con otras apps, como en la web: respeta el modo
      // silencio y no corta la música que el jugador tenga sonando. Android lo ignora.
      AudioManager.setSystemOptions({ ios: { category: 'ambient', options: ['mixWithOthers'] } });
    } catch {}
    ac = new AudioContext();
    if (!lifecycleHooked) {
      lifecycleHooked = true;
      try {
        // Al pasar a segundo plano se suspende el contexto (no deja el flujo de audio abierto
        // gastando batería); el siguiente pitido lo reanuda.
        AppState.addEventListener('change', (s) => {
          try {
            if (s !== 'active' && ac && ac.state === 'running') ac.suspend().catch(() => {});
          } catch {}
        });
      } catch {}
    }
  }
  return ac;
}

function vibrate(ms: number) {
  try {
    Vibration.vibrate(ms);
  } catch {}
}

/**
 * Duración pedida (ms, la misma que en la web: ver `BUZZ` en src/game/sounds.ts y el
 * interruptor de vibración del Perfil) → háptica nativa:
 *
 *   ≤ 15 ms  (golpe a un bloque, 10)                  → impacto Light (muy frecuente: liviano)
 *   ≤ 35 ms  (combo 25, destruir/hito/interruptor 30) → impacto Medium
 *   ≤ 50 ms  (vida recuperada, 40)                    → notificación Success
 *   ≤ 99 ms  (bloque escapado, 80)                    → notificación Error (doble pulso)
 *   ≥ 100 ms (fin de partida 150, trampa 250)          → Vibration.vibrate(ms): vibración larga,
 *                                                       igual que navigator.vibrate en la web
 *
 * Si expo-haptics falla (dispositivo sin soporte), se cae a Vibration.vibrate(ms).
 */
function haptic(ms: number) {
  if (ms >= 100) return vibrate(ms);
  try {
    let p: Promise<void>;
    if (ms <= 15) p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (ms <= 35) p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (ms <= 50) p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else p = Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    p.catch(() => vibrate(ms));
  } catch {
    vibrate(ms);
  }
}

export const fx: Fx = {
  beep(f: number, d: number, type: Wave = 'square', v = 0.05) {
    try {
      if (!getSettings().sound) return;
      const c = context();
      if (c.state === 'suspended') c.resume().catch(() => {});
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      // En la web `g.gain.value = v` fija el punto de partida de la rampa; aquí se agenda
      // explícitamente en el instante actual para que la curva sea idéntica.
      const t = c.currentTime;
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + d);
    } catch {}
  },
  buzz(ms: number) {
    try {
      if (!getSettings().haptics) return;
      if (!(ms > 0)) return;
      haptic(ms);
    } catch {}
  },
};
