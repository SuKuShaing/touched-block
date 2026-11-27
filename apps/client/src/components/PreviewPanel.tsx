import { COLORS } from '@tb/engine';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Block } from '@/components/Block';
import { FieldBackground } from '@/components/FieldBackground';
import { FxLayer, useFxList } from '@/components/Fx';
import { silentTipOnce } from '@/components/silentTip';
import { useActiveCosmetics } from '@/cosmetics/active';
import { sounds } from '@/game/sounds';
import {
  PREVIEW_RESPAWN_MS,
  type PreviewState,
  initialPreview,
  previewA11yLabel,
  previewLayout,
  previewRespawn,
  previewReviveAll,
  previewStep,
  previewText,
} from '@/lib/previewStep';
import { C } from '@/theme';

/** Vida que muestra la barra de los bloques de muestra (no corre). */
const LIFE = 0.75;
const BORDER = 1;

/**
 * Vista previa de la Colección (trae su propia tarjeta y título): un campo de 3×3 bloques para
 * probar la paleta, el fondo, el efecto y el sonido equipados, con los mismos componentes que la
 * partida (`Block`, `FieldBackground`, `useFxList` y `sounds.play`), así que se ve y suena igual y
 * cambia al momento al equipar otro premio. No usa el motor, no guarda nada ni cuenta para nada. La
 * lógica de los bloques está en `lib/previewStep.ts`.
 */
export function PreviewPanel() {
  const { soundPack } = useActiveCosmetics();
  const focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const [blocks, setBlocks] = useState(() => initialPreview(Math.random));
  const current = useRef(blocks);
  const [destroyed, setDestroyed] = useState(0);
  const { items, add, clear } = useFxList();
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const tipDone = useRef(false);

  const commit = useCallback((next: PreviewState) => {
    current.current = next;
    setBlocks(next);
  }, []);

  const stopTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  // sin la pestaña a la vista no corre nada: al volver, el campo está entero
  useEffect(() => {
    if (focused) return;
    stopTimers();
    clear();
    commit(previewReviveAll(current.current, Math.random));
    setDestroyed(0);
  }, [focused, stopTimers, clear, commit]);

  // deja el paquete listo en memoria, para que el primer toque ya suene desde ahí
  useEffect(() => {
    if (focused) sounds.prepare(soundPack);
  }, [focused, soundPack]);

  const inner = Math.max(0, width - 2 * BORDER);
  const layout = previewLayout(inner);

  const tap = (i: number) => {
    // en iPhone/iPad, quien llega aquí sin haber jugado ve una vez el aviso del modo silencio
    if (!tipDone.current) {
      tipDone.current = true;
      silentTipOnce();
      // en la web, si se entró directo aquí, el audio recién existe desde este toque
      sounds.prepare(soundPack);
    }
    const step = previewStep(current.current, i);
    if (step.state === current.current) return;
    commit(step.state);
    if (step.hit !== null) sounds.play('hit', step.hit, soundPack);
    if (!step.destroyed) return;
    sounds.play(step.destroyed, 0, soundPack);
    const r = layout.blocks[i];
    const at = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    // como en la partida: el bloque estalla con el efecto equipado; la trampa, con su estallido rojo
    add(step.destroyed === 'trap' ? { kind: 'burst', ...at, color: C.bad, count: 24 } : { kind: 'burst', ...at, color: COLORS[i] });
    setDestroyed((n) => n + 1);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      commit(previewRespawn(current.current, i, Math.random));
    }, PREVIEW_RESPAWN_MS);
    timers.current.add(timer);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        Vista previa
      </Text>
      <View style={[styles.field, { height: layout.height + 2 * BORDER }]} onLayout={onLayout}>
        <FieldBackground paused={!focused} />
        {inner > 0 ? (
          <>
            {/* el dibujo no lo lee el lector de pantalla: lo describen los botones de encima */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {blocks.map((b, i) =>
                b.alive ? (
                  <Block
                    key={`${i}-${b.gen}`}
                    {...layout.blocks[i]}
                    label={previewText(b)}
                    color={COLORS[i]}
                    red={b.kind === 'trap'}
                    life={LIFE}
                    hitKey={b.total - b.left}
                  />
                ) : null,
              )}
              <FxLayer items={items} />
            </View>
            {blocks.map((b, i) => {
              const cell = layout.cells[i];
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={previewA11yLabel(b)}
                  onPress={() => tap(i)}
                  style={[styles.touch, { left: cell.x, top: cell.y, width: cell.w, height: cell.h }]}
                />
              );
            })}
          </>
        ) : null}
        {/* región viva: el espacio que alterna hace que dos avisos seguidos se anuncien los dos */}
        <Text style={styles.live} accessibilityLiveRegion="polite">
          {destroyed ? `Bloque destruido${destroyed % 2 ? '' : ' '}` : ''}
        </Text>
      </View>
      <Text style={styles.help}>
        Toca un bloque. Un número muestra los toques que faltan; en una operación, toca tantas veces como su resultado. Así se ve y
        suena lo que llevas puesto.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // la misma tarjeta que las demás secciones de la Colección
  section: { width: '100%', maxWidth: 480, backgroundColor: C.panel, borderRadius: 16, padding: 16, gap: 12 },
  title: { color: C.text, opacity: 0.6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.9 },
  field: { backgroundColor: C.bg, borderWidth: BORDER, borderColor: C.panelBorder, borderRadius: 12, overflow: 'hidden' },
  touch: { position: 'absolute', borderRadius: 16 },
  live: { position: 'absolute', left: 0, bottom: 0, width: 1, height: 1, overflow: 'hidden', color: 'transparent' },
  help: { color: C.text, opacity: 0.6, fontSize: 13, lineHeight: 18 },
});
