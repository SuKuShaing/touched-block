import { storage } from '@/platform/storage';

/** Marca de "ya vio el onboarding". */
export const ONB_KEY = 'tb_onb1';

export const onboardingSeen = () => storage.get(ONB_KEY) === '1';
export const markOnboardingSeen = () => storage.set(ONB_KEY, '1');

// "¡Jugar!" en la última slide vuelve al inicio y empieza una partida al tiro.
let pendingStart = false;
export const requestStart = () => {
  pendingStart = true;
};
export const consumeStartRequest = () => {
  const p = pendingStart;
  pendingStart = false;
  return p;
};
