import { useEffect, useRef } from 'react';
import type { UseFieldTaps } from './fieldTaps.types';

/**
 * Web: un listener nativo de `pointerdown` sobre el nodo DOM del campo. Es lo de menor
 * latencia (sin esperar al click ni al sistema de responders de React Native) y cada dedo
 * genera su propio pointerdown, así que es multitáctil. El campo lleva `touch-action: none`.
 */
export const useFieldTaps: UseFieldTaps = (ref, onTap) => {
  const cb = useRef(onTap);
  cb.current = onTap;

  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      // getBoundingClientRect incluye la sacudida (transform), igual que lo que se ve.
      const r = el.getBoundingClientRect();
      cb.current(e.clientX - r.left, e.clientY - r.top);
    };
    el.style.touchAction = 'none';
    const noDbl = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', down, { passive: false });
    el.addEventListener('dblclick', noDbl);
    el.addEventListener('contextmenu', noDbl);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('dblclick', noDbl);
      el.removeEventListener('contextmenu', noDbl);
    };
  }, [ref]);

  return {};
};
