import { useCallback, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { type Notice, type NoticeTone, noticeWins } from '@/game/notices';
import { C } from '@/theme';
import { MilestoneLine } from './Hud';

/** Aviso que se está mostrando (con un id para reiniciar su animación). */
export type ShownNotice = Notice & { id: number };

/** Alto de la franja de avisos (queda fuera del campo: nunca tapa un bloque ni recibe sus toques). */
export const STRIP_H = 24;

/**
 * Avisos de la partida, de a uno. `offer` muestra el aviso si no hay otro o si el que hay es
 * igual o menos importante; si no, lo descarta (devuelve false).
 */
export function useNotices() {
  const [notice, setNotice] = useState<ShownNotice | null>(null);
  const active = useRef<{ n: ShownNotice; until: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const stopTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const offer = useCallback((n: Notice): boolean => {
    const now = Date.now();
    const cur = active.current && active.current.until > now ? active.current.n : null;
    if (!noticeWins(cur, n)) return false;
    const shown: ShownNotice = { ...n, id: ++seq.current };
    active.current = { n: shown, until: now + n.ms };
    stopTimer();
    timer.current = setTimeout(() => {
      active.current = null;
      timer.current = null;
      setNotice(null);
    }, n.ms);
    setNotice(shown);
    return true;
  }, []);

  const clear = useCallback(() => {
    stopTimer();
    active.current = null;
    setNotice(null);
  }, []);

  useEffect(() => stopTimer, []);

  return { notice, offer, clear };
}

const TONE: Record<NoticeTone, string> = { gold: C.gold, good: C.good, accent: C.accent };

/** Tamaño de letra para que el aviso quepa en una línea (estimado por largo, ~0.56 em por carácter). */
export function noticeFontSize(text: string, width: number): number {
  if (!(width > 0)) return 13;
  const fs = (width - 24) / (Math.max(1, text.length) * 0.56);
  return Math.max(10.5, Math.min(15, fs));
}

function NoticeText({ notice, width }: { notice: ShownNotice; width: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    const outAt = Math.max(0, notice.ms - 140 - 260);
    p.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: outAt }),
      withTiming(0, { duration: 260 }),
    );
  }, [p, notice.ms, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * 4 }] }));
  const fs = noticeFontSize(notice.text, width);
  return (
    <Animated.View style={[styles.noticeWrap, style]} pointerEvents="none">
      <Text
        style={[styles.notice, { color: TONE[notice.tone], fontSize: fs, lineHeight: Math.round(fs * 1.25) }]}
        selectable={false}
        numberOfLines={1}
        accessibilityLiveRegion="polite"
      >
        {notice.text}
      </Text>
    </Animated.View>
  );
}

/**
 * Franja fija y fina bajo la barra de tiempo: la línea de avance hacia el próximo hito y, encima,
 * el aviso del momento. Queda fuera del campo de juego.
 */
export function NoticeStrip({
  notice,
  ratio,
  icon,
  style,
}: {
  notice: ShownNotice | null;
  ratio: number;
  icon: string | null;
  style?: object;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  return (
    <View style={[styles.strip, style]} onLayout={onLayout} pointerEvents="none">
      <MilestoneLine ratio={ratio} icon={icon} dim={!!notice} />
      {notice ? <NoticeText key={notice.id} notice={notice} width={w} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { height: STRIP_H, justifyContent: 'center' },
  noticeWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  notice: {
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: C.bg,
    overflow: 'hidden',
    maxWidth: '100%',
  },
});
