import { useCallback, useRef } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import type { UseFieldTaps } from './fieldTaps.types';

/**
 * Nativo (mínimo): onTouchStart del campo con `changedTouches` (multitáctil). Las
 * coordenadas se calculan con pageX/pageY menos la posición del campo en la ventana,
 * porque locationX/Y son relativas al hijo tocado (un bloque).
 */
export const useFieldTaps: UseFieldTaps = (ref, onTap) => {
  const cb = useRef(onTap);
  cb.current = onTap;
  const origin = useRef({ x: 0, y: 0 });

  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y) => {
      origin.current = { x, y };
    });
  }, [ref]);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    for (const t of e.nativeEvent.changedTouches) {
      cb.current(t.pageX - origin.current.x, t.pageY - origin.current.y);
    }
  }, []);

  return {
    onTouchStart,
    onLayout: (_e: LayoutChangeEvent) => measure(),
  };
};
