import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '@tb/engine';
import { type CatalogItem, SETTING_KEY } from '@/cosmetics/catalog';
import { getPalette } from '@/cosmetics/palettes';
import { type Celebration, celebrationTexts, stepText } from '@/game/celebrations';
import { sounds } from '@/game/sounds';
import { BURST_LIFETIME } from '@/lib/fxShapes';
import { getSettings, updateSettings, useSettings } from '@/lib/settings';
import { shareItemOf } from '@/lib/shareText';
import { C } from '@/theme';
import { AchievementIcon } from './AchievementIcon';
import { Confetti } from './Confetti';
import { FieldBackground } from './FieldBackground';
import { Burst, type BurstEffect } from './Fx';
import { PaletteSwatch } from './PaletteSwatch';
import { ShareIcon, usePrizeShare } from './PrizeModal';
import { TierBadge } from './TierBadge';

/**
 * Ventana de celebración: lo que se ganó (insignia, premio, logro o el reto del día), con
 * confeti, rayos de luz detrás y una entrada con rebote. Varias a la vez se muestran de a una
 * ("1 de 3", "Siguiente"). Se cierra con "¡Genial!", tocando fuera o con "atrás" en Android.
 * Insignias, logros y premios se pueden compartir sin cerrar ni avanzar.
 * Con "reducir movimiento" no hay confeti, rayos ni rebote (solo aparece).
 *
 * Es solo la vista: la cola, el sonido y cuándo se muestra están en `CelebrationHost`.
 */

/** Pausa al aparecer cada celebración en la que los toques no la cierran (toques que venían de la partida). */
export const CELEBRATION_TAP_GUARD_MS = 600;

const STAGE_H = 150;

function accentOf(c: Celebration): string {
  if (c.kind === 'tier' || c.kind === 'achievement') return C.gold;
  if (c.kind === 'feature') return C.good;
  return C.accent;
}

/** "#ffd166" + alfa → "rgba(255,209,102,a)". */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------- fondo del premio

/** Rayos de luz que giran despacio detrás del premio, y un halo. */
function Rays({ color, still }: { color: string; still: boolean }) {
  const rot = useSharedValue(0);
  const show = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    show.value = withTiming(1, { duration: 500 });
    rot.value = withRepeat(withTiming(360, { duration: 16000, easing: Easing.linear }), -1, false);
  }, [rot, show, still]);
  const spin = useAnimatedStyle(() => ({ opacity: show.value, transform: [{ rotate: `${rot.value}deg` }, { scale: 0.6 + 0.4 * show.value }] }));
  const beam = `linear-gradient(to bottom, ${rgba(color, 0)} 0%, ${rgba(color, 0.32)} 50%, ${rgba(color, 0)} 100%)`;
  return (
    <>
      <View pointerEvents="none" style={[styles.halo, { backgroundImage: `radial-gradient(circle, ${rgba(color, 0.42)} 0%, ${rgba(color, 0)} 68%)` }]} />
      {still ? null : (
        <Animated.View pointerEvents="none" style={[styles.rays, spin]}>
          {[0, 30, 60, 90, 120, 150].map((deg) => (
            <View key={deg} style={[styles.beam, { backgroundImage: beam, transform: [{ rotate: `${deg}deg` }] }]} />
          ))}
        </Animated.View>
      )}
    </>
  );
}

// ---------------------------------------------------------------- vista previa

const DIGITS = [3, 7, 2, 5, 9, 4, 8, 1, 6];

function PaletteView({ id }: { id: string }) {
  return (
    <View style={styles.palette}>
      {DIGITS.map((digit, i) => (
        <PaletteSwatch key={i} paletteId={id} index={i} size={32} radius={7}>
          <Text style={styles.miniT} selectable={false}>
            {digit}
          </Text>
        </PaletteSwatch>
      ))}
    </View>
  );
}

const EFFECT_W = 240;
const BLOCK_PX = 30;
/**
 * Centro del bloque dentro de la caja del efecto según hacia dónde se abre cada uno (por defecto,
 * al medio): así los que suben (fuegos, burbujas) o caen en diagonal (fugaces) no salen cortados.
 */
const EFFECT_ORIGIN: Partial<Record<BurstEffect, { x?: number; y: number }>> = {
  burbujas: { y: 112 },
  fuegos: { y: 108 },
  emojis: { y: 85 },
  monedas: { y: 82 },
  pixeles: { y: 70 },
  fugaces: { x: 135, y: 60 },
};

/** El efecto al destruir, en bucle (un bloque que estalla cada poco más de un segundo). */
function EffectView({ id, still }: { id: string; still: boolean }) {
  const effect = id as BurstEffect;
  // cada estallido termina antes del siguiente
  const every = Math.max(1200, (BURST_LIFETIME[effect] ?? 0) + 300);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => setN((v) => v + 1), every);
    return () => clearInterval(t);
  }, [still, every]);
  const { x = EFFECT_W / 2, y = STAGE_H / 2 } = EFFECT_ORIGIN[effect] ?? {};
  // el borde de la caja (1 px) corre el origen de sus hijos
  const cx = x - 1;
  const cy = y - 1;
  return (
    <View style={[styles.box, styles.fxBox]}>
      <View style={[styles.block, { left: cx - BLOCK_PX / 2, top: cy - BLOCK_PX / 2, backgroundColor: getPalette(null).colors[4] }]} />
      {still ? null : <Burst key={n} x={cx} y={cy} color={COLORS[4]} count={14} effect={effect} />}
    </View>
  );
}

const BG_W = 160;
const BG_H = 108;

/**
 * El fondo como se ve en el campo (animado, si lo es) a media escala: se dibuja al doble del
 * tamaño de la caja y se achica. `estrellas` va sin achicar (sus puntos casi desaparecerían).
 */
function BackgroundView({ id }: { id: string }) {
  const k = id === 'estrellas' ? 1 : 0.5;
  const w = BG_W / k;
  const h = BG_H / k;
  return (
    <View style={[styles.box, styles.bgBox]}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', width: w, height: h, left: (BG_W - w) / 2 - 1, top: (BG_H - h) / 2 - 1, transform: [{ scale: k }] }}
      >
        <FieldBackground id={id} cell={14 / k} />
      </View>
      <View style={[styles.block, styles.bgBlockA, { backgroundColor: COLORS[3] }]} />
      <View style={[styles.block, styles.bgBlockB, { backgroundColor: COLORS[5] }]} />
    </View>
  );
}

function PrizeVisual({ c, still }: { c: Celebration; still: boolean }) {
  switch (c.kind) {
    case 'tier':
      return (
        <View style={styles.big}>
          <TierBadge tier={c.tier} size="lg" />
        </View>
      );
    case 'achievement':
      return (
        <View style={styles.big}>
          <AchievementIcon id={c.id} level={c.level} size="lg" />
        </View>
      );
    case 'feature':
      return (
        <View style={styles.calendar}>
          <View style={styles.calTop} />
          <Text style={styles.calT} selectable={false}>
            HOY
          </Text>
        </View>
      );
    case 'item':
      switch (c.item.type) {
        case 'palette':
          return <PaletteView id={c.item.id} />;
        case 'effect':
          return <EffectView id={c.item.id} still={still} />;
        case 'background':
          return <BackgroundView id={c.item.id} />;
        case 'sound':
          return (
            <View style={styles.note}>
              <Text style={styles.noteT} selectable={false}>
                ♪
              </Text>
            </View>
          );
      }
  }
}

// ---------------------------------------------------------------- ventana

/** Botones del premio: "Escuchar" (sonidos) y "Usar ahora" / "En uso". */
function ItemActions({ item }: { item: CatalogItem }) {
  const settings = useSettings();
  const key = SETTING_KEY[item.type];
  const inUse = settings[key] === item.id;
  return (
    <View style={styles.actions}>
      {item.type === 'sound' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Escuchar ${item.name}`}
          onPress={() => sounds.preview(item.id)}
          style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
        >
          <Text style={styles.ghostT}>▶ Escuchar</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={inUse ? `${item.name} en uso` : `Usar ahora ${item.name}`}
        accessibilityState={{ selected: inUse }}
        disabled={inUse}
        onPress={() => {
          if (getSettings()[key] === item.id) return;
          updateSettings({ [key]: item.id });
          if (item.type === 'sound') sounds.preview(item.id);
        }}
        style={({ pressed }) => [styles.ghost, inUse && styles.ghostOn, pressed && styles.pressed]}
      >
        <Text style={[styles.ghostT, inUse && styles.ghostOnT]}>{inUse ? '✓ En uso' : 'Usar ahora'}</Text>
      </Pressable>
    </View>
  );
}

/** Contenido de una celebración (se vuelve a montar con cada una: repite la entrada). */
function Slide({ c, step, still }: { c: Celebration; step: string; still: boolean }) {
  const t = celebrationTexts(c);
  const color = accentOf(c);
  const pop = useSharedValue(still ? 1 : 0);
  const rise = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    pop.value = withDelay(90, withSpring(1, { damping: 9, stiffness: 170, mass: 0.8 }));
    rise.value = withDelay(180, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [pop, rise, still]);
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: 0.2 + 0.8 * pop.value }] }));
  const riseStyle = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: 14 * (1 - rise.value) }] }));
  return (
    <>
      <View style={styles.head}>
        <Text style={[styles.kicker, { color }]}>{t.kicker}</Text>
        {step ? <Text style={styles.step}>{step}</Text> : null}
      </View>
      <View style={styles.stage}>
        <Rays color={color} still={still} />
        <Animated.View style={popStyle}>
          <PrizeVisual c={c} still={still} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.texts, riseStyle]}>
        <Text style={styles.title} accessibilityRole="header">
          {t.title}
        </Text>
        {t.name ? <Text style={[styles.name, { color }]}>{t.name}</Text> : null}
        <Text style={styles.sub}>{t.sub}</Text>
        {t.hint ? <Text style={styles.hint}>{t.hint}</Text> : null}
        {c.kind === 'item' ? <ItemActions item={c.item} /> : null}
      </Animated.View>
    </>
  );
}

export function CelebrationModal({
  items,
  index,
  onNext,
  onClose,
}: {
  items: readonly Celebration[];
  index: number;
  /** "Siguiente" (hay más). */
  onNext: () => void;
  /** "¡Genial!", tocar fuera o "atrás". */
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  // al cerrarse, si se escuchó otro paquete, el equipado vuelve a quedar listo
  useEffect(() => () => sounds.restore(), []);
  const c = items[index] ?? null;
  const last = index >= items.length - 1;
  const [cardW, setCardW] = useState<number | null>(null);
  const shareItem = c ? shareItemOf(c) : null;
  const { share: shareShown, notice } = usePrizeShare(shareItem);
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index, c?.key]);
  const ready = () => Date.now() - shownAt.current >= CELEBRATION_TAP_GUARD_MS;

  const enter = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) enter.value = withSpring(1, { damping: 12, stiffness: 180 });
  }, [enter, reduced]);
  const cardStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, enter.value * 1.6), transform: [{ scale: 0.75 + 0.25 * enter.value }] }));

  if (!c) return null;
  const primary = () => {
    if (!ready()) return;
    if (last) onClose();
    else onNext();
  };
  const dismiss = () => {
    if (ready()) onClose();
  };
  // compartir no cierra la ventana ni pasa a la siguiente
  const onShare = () => {
    if (ready()) shareShown();
  };
  const onCard = (e: LayoutChangeEvent) => setCardW(e.nativeEvent.layout.width);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Cerrar" />
        <Animated.View style={[styles.card, { borderColor: rgba(accentOf(c), 0.45) }, cardStyle]} accessibilityViewIsModal accessibilityLiveRegion="polite" onLayout={onCard}>
          <Slide key={c.key} c={c} step={stepText(index, items.length)} still={reduced} />
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={last ? (items.length > 1 ? '¡Genial! Cerrar' : '¡Genial! Seguir jugando') : 'Siguiente premio'}
              onPress={primary}
              style={({ pressed }) => [styles.primary, { backgroundColor: accentOf(c) }, pressed && styles.pressed]}
            >
              <Text style={styles.primaryT}>{last ? '¡Genial!' : 'Siguiente'}</Text>
            </Pressable>
            {shareItem ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Compartir"
                onPress={onShare}
                style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
              >
                <ShareIcon color={C.text} />
              </Pressable>
            ) : null}
          </View>
          {notice ? (
            <Text style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
          {/* sale del centro del premio */}
          {!reduced && cardW !== null ? <Confetti key={`confeti-${c.key}`} x={cardW / 2} y={PAD_TOP + HEAD_H + STAGE_H / 2} /> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const CARD_W = 320;
const PAD_TOP = 16;
/** Alto de la fila del rótulo (kicker + "1 de 3") sobre el escenario. */
const HEAD_H = 22;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.66)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: CARD_W,
    maxWidth: '100%',
    backgroundColor: C.panel,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: PAD_TOP,
    paddingBottom: 18,
    alignItems: 'center',
  },
  head: { height: HEAD_H, alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  step: { color: C.text, opacity: 0.55, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stage: { height: STAGE_H, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  rays: { position: 'absolute', width: 230, height: 230, alignItems: 'center', justifyContent: 'center' },
  beam: { position: 'absolute', width: 22, height: 230, left: 104, top: 0, borderRadius: 11 },
  texts: { alignSelf: 'stretch', alignItems: 'center', gap: 4 },
  title: { color: C.text, fontSize: 22, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  name: { fontSize: 26, lineHeight: 32, fontWeight: '900', textAlign: 'center' },
  sub: { color: C.text, opacity: 0.88, fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 2 },
  hint: { color: C.text, opacity: 0.6, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  ghost: { backgroundColor: C.barBg, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  ghostOn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.good },
  ghostT: { color: C.text, fontWeight: '800', fontSize: 14 },
  ghostOnT: { color: C.good },
  buttons: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 16 },
  primary: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  shareBtn: { width: 52, minHeight: 48, borderRadius: 14, backgroundColor: C.barBg, alignItems: 'center', justifyContent: 'center' },
  notice: { color: C.text, opacity: 0.85, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  primaryT: { color: C.bg, fontWeight: '900', fontSize: 17 },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  // vistas previas
  big: { transform: [{ scale: 1.6 }] },
  palette: { width: 108, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniT: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  box: { borderRadius: 12, backgroundColor: C.bg, borderWidth: 1, borderColor: C.panelBorder, overflow: 'hidden' },
  fxBox: { width: EFFECT_W, height: STAGE_H },
  bgBox: { width: BG_W, height: BG_H },
  block: { position: 'absolute', width: BLOCK_PX, height: BLOCK_PX, borderRadius: 7 },
  bgBlockA: { left: 28, top: 22 },
  bgBlockB: { left: 100, top: 58 },
  note: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.bg, borderWidth: 2, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  noteT: { color: C.accent, fontSize: 50, lineHeight: 58, fontWeight: '800' },
  calendar: { width: 88, height: 88, borderRadius: 16, backgroundColor: C.bg, borderWidth: 2, borderColor: C.good, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  calTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 20, backgroundColor: C.good },
  calT: { color: C.good, fontSize: 24, fontWeight: '900', marginTop: 14, letterSpacing: 1 },
});
