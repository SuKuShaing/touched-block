import type { Fx, Wave } from './fx.types';

// WebAudio + navigator.vibrate, igual que legacy/game.js. Todo en try/catch porque puede
// no estar disponible (Safari antiguo, navegadores sin audio, iOS sin vibración).
let ac: AudioContext | null = null;

export const fx: Fx = {
  beep(f: number, d: number, type: Wave = 'square', v = 0.05) {
    try {
      if (!ac) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac = new Ctor();
      }
      if (ac.state === 'suspended') void ac.resume();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.value = v;
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + d);
    } catch {}
  },
  buzz(ms: number) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  },
};
