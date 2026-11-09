import { useSyncExternalStore } from 'react';

/** "Hay una partida en curso": las pestañas se esconden para evitar toques accidentales. */
let playing = false;
const listeners = new Set<() => void>();

export function setPlaying(v: boolean) {
  if (playing === v) return;
  playing = v;
  listeners.forEach((l) => l());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const get = () => playing;

export const usePlaying = () => useSyncExternalStore(subscribe, get, get);
