import { useRouter } from 'expo-router';
import { type ComponentType, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import {
  BASE_LIVES,
  BOMB_PENALTY,
  COMBO_CYCLE,
  MAX_LIVES_CAP,
  MISS_MULT_ADDSUB,
  MISS_MULT_MULDIV,
  MISS_MULT_NUM,
  START_TIME,
} from '@tb/engine';
import { MainButton } from '@/components/ui';
import { features } from '@/config';
import { markOnboardingSeen, requestStart } from '@/lib/onboarding';
import { C } from '@/theme';
import {
  DemoCombo,
  DemoEscape,
  DemoGain,
  DemoInvite,
  DemoMiss,
  DemoOps,
  DemoPositive,
  type DemoProps,
  DemoRanking,
  DemoTap,
  DemoTrap,
} from './demos';

function B({ children }: { children: ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

function Red({ children }: { children: ReactNode }) {
  return <Text style={styles.red}>{children}</Text>;
}

interface Slide {
  key: string;
  Demo: ComponentType<DemoProps>;
  text: ReactNode;
  note?: ReactNode;
  /** Solo con cuentas (features.accounts). */
  accounts?: boolean;
}

// Los números salen de las constantes del motor: si cambia el balance, el texto se actualiza solo.
const ALL_SLIDES: Slide[] = [
  {
    key: 'tocar',
    Demo: DemoTap,
    text: (
      <>
        Toca cada bloque <B>tantas veces</B> como diga su número.
      </>
    ),
  },
  {
    key: 'tiempo',
    Demo: DemoGain,
    text: (
      <>
        Empiezas con <B>{START_TIME} s</B>. Completar un bloque te <B>suma</B> su número en segundos.
      </>
    ),
  },
  {
    key: 'escapa',
    Demo: DemoEscape,
    text: (
      <>
        Si un bloque se escapa, te <B>resta</B> su número ×{MISS_MULT_NUM}.
      </>
    ),
    note: `Un 3 que se escapa = −${3 * MISS_MULT_NUM} s. Las operaciones restan su resultado ×${MISS_MULT_ADDSUB} (+ −) o ×${MISS_MULT_MULDIV} (× ÷).`,
  },
  {
    key: 'vidas',
    Demo: DemoMiss,
    text: (
      <>
        Tocar fuera de un bloque te quita <B>una vida</B>. Tienes <B>{BASE_LIVES}</B>.
      </>
    ),
  },
  {
    key: 'trampas',
    Demo: DemoTrap,
    text: (
      <>
        Hay bloques <B>trampa</B>: su número es <Red>rojo</Red>. Tocar uno te quita <B>{BOMB_PENALTY} s</B>.
      </>
    ),
    note: 'Fíjate bien: son iguales a los demás.',
  },
  {
    key: 'operaciones',
    Demo: DemoOps,
    text: (
      <>
        Más adelante llegan bloques con <B>operaciones</B>: tócalos tantas veces como su <B>resultado</B>.
      </>
    ),
    note: 'La operación no cambia mientras tocas: cuenta tú.',
  },
  {
    key: 'positivos',
    Demo: DemoPositive,
    text: (
      <>
        Solo toca <B>números</B> o resultados <B>positivos</B>. Si da 0 o menos, es trampa.
      </>
    ),
    note: `Si las dejas pasar no pasa nada. Ojo: también hay operaciones en rojo. Tocar una trampa: −${BOMB_PENALTY} s.`,
  },
  {
    key: 'combos',
    Demo: DemoCombo,
    text: (
      <>
        Destruye bloques <B>seguidos</B> sin errores y gana <B>segundos extra</B>.
      </>
    ),
    note: `Un escape, una trampa o un toque fuera cortan la racha, pero lo ganado se queda. Después de ${COMBO_CYCLE} vuelve a empezar.`,
  },
  {
    key: 'invitar',
    accounts: true,
    Demo: DemoInvite,
    text: (
      <>
        Invita amigos: <B>+1 corazón</B> por cada uno, hasta <B>{MAX_LIVES_CAP}</B>.
      </>
    ),
  },
  {
    key: 'ranking',
    accounts: true,
    Demo: DemoRanking,
    text: (
      <>
        Inicia sesión para competir en el ranking de <B>tu país</B> y del <B>mundo</B>.
      </>
    ),
  },
];

const SPRING = { duration: 280, easing: Easing.out(Easing.cubic) };

/**
 * Onboarding ("¿Cómo se juega?"): carrusel deslizable de slides animadas. Se abre solo en la
 * primera visita (marca tb_onb1) y se puede repetir desde el perfil.
 */
export function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const slides = useMemo(() => ALL_SLIDES.filter((s) => !s.accounts || features.accounts), []);
  const last = slides.length - 1;

  const W = Math.min(width, 520);
  const stageW = Math.min(W - 40, 340);
  const stageH = Math.max(200, Math.min(270, height * 0.36));

  const [index, setIndex] = useState(0);
  const idx = useSharedValue(0);
  const pos = useSharedValue(0);

  // Basta con verla una vez (o saltarla) para que no se vuelva a abrir sola.
  useEffect(() => markOnboardingSeen(), []);

  const goTo = useCallback(
    (i: number) => {
      const n = Math.max(0, Math.min(last, i));
      idx.value = n;
      pos.value = withTiming(-n * W, SPRING);
      setIndex(n);
    },
    [W, last, idx, pos],
  );

  // si cambia el ancho (rotación, ventana), recolocar sin animar
  const prevW = useRef(W);
  useEffect(() => {
    if (prevW.current !== W) {
      prevW.current = W;
      pos.value = -idx.value * W;
    }
  }, [W, idx, pos]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const play = useCallback(() => {
    requestStart();
    router.dismissTo('/');
  }, [router]);

  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      let x = -idx.value * W + e.translationX;
      // resistencia en los extremos
      if (x > 0) x = x / 3;
      const min = -last * W;
      if (x < min) x = min + (x - min) / 3;
      pos.value = x;
    },
    onDeactivate: (e) => {
      'worklet';
      let i = idx.value;
      if (e.translationX < -W * 0.2 || e.velocityX < -500) i++;
      else if (e.translationX > W * 0.2 || e.velocityX > 500) i--;
      i = Math.max(0, Math.min(last, i));
      idx.value = i;
      pos.value = withTiming(-i * W, SPRING);
      scheduleOnRN(setIndex, i);
    },
  });

  // flechas del teclado en web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(idx.value + 1);
      else if (e.key === 'ArrowLeft') goTo(idx.value - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, idx]);

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value }] }));

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.col, { width: W }]}>
        <View style={styles.top}>
          <Text style={styles.kicker}>¿Cómo se juega?</Text>
          {index < last ? (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={close} style={styles.skip}>
              <Text style={styles.skipT}>Saltar</Text>
            </Pressable>
          ) : null}
        </View>

        <GestureDetector gesture={pan}>
          <View style={styles.viewport} collapsable={false}>
            <Animated.View style={[styles.track, { width: W * slides.length }, track]}>
              {slides.map((s, i) => (
                <View key={s.key} style={[styles.slide, { width: W }]} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}>
                  <s.Demo w={stageW} h={stageH} active={i === index} reduced={reduced} />
                  <Text style={styles.text}>{s.text}</Text>
                  {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
                </View>
              ))}
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={styles.dots}>
          {slides.map((s, i) => (
            <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={`Ir a la slide ${i + 1}`} hitSlop={6} onPress={() => goTo(i)}>
              <View style={[styles.dot, i === index && styles.dotOn]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.bottom}>
          <MainButton title={index < last ? 'Siguiente' : '¡Jugar!'} onPress={index < last ? () => goTo(index + 1) : play} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, alignItems: 'center' },
  col: { flex: 1 },
  top: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  kicker: { color: C.text, opacity: 0.6, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600' },
  skip: { paddingVertical: 8, paddingHorizontal: 4 },
  skipT: { color: C.text, opacity: 0.75, fontSize: 16, fontWeight: '600' },
  viewport: { flex: 1, overflow: 'hidden' },
  track: { flex: 1, flexDirection: 'row' },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, gap: 22 },
  text: { color: C.text, fontSize: 21, lineHeight: 29, fontWeight: '600', textAlign: 'center', maxWidth: 360 },
  bold: { fontWeight: '800', color: C.accent },
  red: { fontWeight: '800', color: C.trapNumber },
  note: { color: C.text, opacity: 0.6, fontSize: 14, textAlign: 'center', marginTop: -10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.heartOff },
  dotOn: { width: 22, backgroundColor: C.accent },
  bottom: { alignItems: 'center', paddingBottom: 22 },
});
