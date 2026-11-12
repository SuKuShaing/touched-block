import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { CatalogItem } from '@/cosmetics/catalog';
import { getPalette } from '@/cosmetics/palettes';
import { type EndPrize, prizeTexts } from '@/game/endPrize';
import { C } from '@/theme';
import { SmallButton } from './form';
import { TierBadge } from './TierBadge';

/** Ícono chico del premio: cuatro colores de la paleta, o un símbolo según el tipo. */
function ItemIcon({ item }: { item: CatalogItem }) {
  if (item.type === 'palette') {
    const cols = getPalette(item.id).colors;
    return (
      <View style={[styles.icon, styles.swatches]}>
        {[cols[2], cols[4], cols[0], cols[6]].map((c, i) => (
          <View key={i} style={[styles.swatch, { backgroundColor: c }]} />
        ))}
      </View>
    );
  }
  const glyph = item.type === 'sound' ? '♪' : item.type === 'effect' ? '✦' : '▦';
  return (
    <View style={styles.icon}>
      <Text style={styles.glyph} selectable={false}>
        {glyph}
      </Text>
    </View>
  );
}

/**
 * Tarjeta corta de la pantalla final: insignia nueva (se celebra primero) y/o premio desbloqueado,
 * con "Probar ahora" (activa el premio y empieza otra partida). Es parte de la pantalla, no una
 * ventana: no hay que cerrarla. Aparece con una animación breve (sin animación con movimiento reducido).
 */
export function PrizeCard({ prize, onTry }: { prize: EndPrize; onTry: (item: CatalogItem) => void }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) p.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.6)) });
  }, [p, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 1.4), transform: [{ scale: 0.92 + 0.08 * p.value }] }));

  const { title, sub } = prizeTexts(prize);
  const item = prize.items[0] ?? null;
  return (
    <Animated.View style={[styles.card, prize.tier && styles.cardTier, anim]} accessibilityLabel={`${title} ${sub}`} accessibilityLiveRegion="polite">
      {prize.tier ? <TierBadge tier={prize.tier} size="md" /> : item ? <ItemIcon item={item} /> : null}
      <View style={styles.texts}>
        <Text style={[styles.title, prize.tier && styles.titleTier]} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.subRow}>
          <Text style={styles.sub} numberOfLines={2}>
            {sub}
          </Text>
          {item ? <SmallButton title="Probar ahora" onPress={() => onTry(item)} accessibilityLabel={`Probar ahora ${item.name}`} /> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: 'rgba(119,204,255,0.35)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardTier: { borderColor: 'rgba(255,209,102,0.45)' },
  texts: { flex: 1, gap: 4 },
  title: { color: C.accent, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  titleTier: { color: C.gold },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { flex: 1, color: C.text, opacity: 0.8, fontSize: 13, lineHeight: 17 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', padding: 3, gap: 2 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  glyph: { color: C.accent, fontSize: 18, fontWeight: '800', lineHeight: 22 },
});
