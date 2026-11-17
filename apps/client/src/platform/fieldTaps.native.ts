import { useCallback, useRef } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import type { UseFieldTaps } from './fieldTaps.types';

/**
 * Nativo (mínimo): onTouchStart del campo con `changedTouches` (multitáctil). Las
 * coordenadas se calculan con pageX/pageY menos la posición del campo en la página (measure:
 * mismo sistema que pageX/pageY; measureInWindow puede diferir en Android según la barra de
 * estado), porque locationX/Y son relativas al hijo tocado (un bloque).
 */
export const useFieldTaps: UseFieldTaps = (ref, onTap, opts) => {
  const cb = useRef(onTap);
  cb.current = onTap;
  const offX = useRef(opts?.offsetX);
  offX.current = opts?.offsetX;
  const origin = useRef({ x: 0, y: 0 });

  const measure = useCallback(() => {
    try {
      ref.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        origin.current = { x: pageX, y: pageY };
      });
    } catch {}
  }, [ref]);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    let dx = 0;
    try {
      dx = offX.current?.() ?? 0;
    } catch {}
    for (const t of e.nativeEvent.changedTouches) {
      cb.current(t.pageX - origin.current.x - dx, t.pageY - origin.current.y);
    }
  }, []);

  return {
    onTouchStart,
    onLayout: (_e: LayoutChangeEvent) => measure(),
  };
};
