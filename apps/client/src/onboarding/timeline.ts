import { useEffect, useRef, useState } from 'react';

/**
 * Tiempo (ms) dentro de un bucle de `period` ms, actualizado con requestAnimationFrame
 * mientras `active`. Con `frozenAt` (movimiento reducido) queda fijo en ese cuadro.
 */
export function useLoopTime(period: number, active: boolean, frozenAt: number | null): number {
  const [t, setT] = useState(frozenAt ?? 0);
  useEffect(() => {
    if (frozenAt != null) {
      setT(frozenAt);
      return;
    }
    if (!active) {
      setT(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setT(Math.max(0, now - t0) % period);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [period, active, frozenAt]);
  return t;
}

/**
 * Llama `onCue(nombre)` cuando el tiempo del bucle pasa por cada marca (también al dar la
 * vuelta). Sirve para disparar efectos de una sola vez (partículas, destello, texto).
 */
export function useCues<K extends string>(t: number, cues: Record<K, number>, onCue: (name: K) => void, enabled: boolean) {
  const prev = useRef(t);
  const cb = useRef(onCue);
  cb.current = onCue;
  useEffect(() => {
    const p = prev.current;
    prev.current = t;
    if (!enabled || t === p) return;
    for (const name of Object.keys(cues) as K[]) {
      const c = cues[name];
      const crossed = t > p ? c > p && c <= t : c > p || c <= t;
      if (crossed) cb.current(name);
    }
  }, [t, enabled, cues]);
}

/** Cuántas marcas de `marks` ya pasaron en el tiempo t. */
export const passed = (t: number, marks: readonly number[]) => marks.filter((m) => t >= m).length;
