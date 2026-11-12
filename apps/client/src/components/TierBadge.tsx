import { memo } from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { TierRef } from '@tb/engine';
import { TIER_LOOK, tierGlyph, tierStepOf } from '@/cosmetics/tiers';

export type BadgeSize = 'sm' | 'md' | 'lg';

/** Diámetro de la medalla (sin el marco de Oro y Diamante). */
const PX: Record<BadgeSize, number> = { sm: 18, md: 32, lg: 64 };
/** Grosor del marco de Oro y Diamante. */
const FRAME: Record<BadgeSize, number> = { sm: 2, md: 3, lg: 5 };

/**
 * Insignia (Madera I–III, Bronce, Plata, Oro, Diamante) dibujada con `View`: medalla redonda con
 * número romano en madera y estrella en las demás; Diamante es un rombo. Oro y Diamante llevan
 * marco y brillo (el "marco en el ranking"). Tamaños: `sm` para filas de ranking, `md`, `lg`.
 * Con `tier` null o inválido no dibuja nada.
 */
export const TierBadge = memo(function TierBadge({
  tier,
  size = 'md',
  style,
  glyph: glyphOverride,
  label,
}: {
  tier: TierRef | null | undefined;
  size?: BadgeSize;
  style?: StyleProp<ViewStyle>;
  /** Otro contenido para la medalla (p. ej. los logros, que usan los mismos materiales). */
  glyph?: string;
  /** Otra etiqueta accesible (por defecto "Insignia Bronce"). */
  label?: string;
}) {
  const t = tierStepOf(tier);
  if (!t) return null;
  const look = TIER_LOOK[t.tier];
  const s = PX[size];
  const f = look.frame ? FRAME[size] : 0;
  const box = s + f * 2;
  const glyph = glyphOverride ?? tierGlyph(t);
  const fontSize = Math.max(7, s * (glyph.length >= 3 ? 0.32 : glyph.length === 2 ? 0.4 : glyph === '★' ? 0.5 : 0.48));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? `Insignia ${t.name}`}
      style={[{ width: box, height: box }, styles.center, style]}
    >
      {look.frame ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            t.tier === 'diamante' ? styles.diamondFrame : { borderRadius: box / 2 },
            { borderWidth: Math.max(1, f * 0.6), borderColor: look.frame, boxShadow: `0 0 ${f * 2.5}px ${look.glow}` },
          ]}
        />
      ) : null}
      {t.tier === 'diamante' ? (
        <View style={[styles.diamond, { width: s * 0.7, height: s * 0.7, borderRadius: s * 0.1, backgroundColor: look.rim }]}>
          <View style={[styles.diamondFace, { borderRadius: s * 0.07, backgroundColor: look.face, margin: Math.max(1, s * 0.07) }]}>
            <View style={[styles.facet, { width: '46%', height: '46%', borderTopLeftRadius: s * 0.06 }]} />
          </View>
        </View>
      ) : (
        <View style={[styles.center, { width: s, height: s, borderRadius: s / 2, backgroundColor: look.rim }]}>
          <View style={[styles.center, { width: s * 0.78, height: s * 0.78, borderRadius: s * 0.39, backgroundColor: look.face }]}>
            {size !== 'sm' ? <View style={[styles.gloss, { width: s * 0.36, height: s * 0.14, borderRadius: s * 0.07, top: s * 0.08, left: s * 0.13 }]} /> : null}
            {glyph ? (
              <Text
                style={[styles.glyph, { color: look.ink, fontSize, lineHeight: fontSize * 1.1 }]}
                selectable={false}
                accessible={false}
              >
                {glyph}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  diamond: { transform: [{ rotate: '45deg' }], overflow: 'hidden' },
  diamondFrame: { transform: [{ rotate: '45deg' }, { scale: 0.74 }], borderRadius: 4 },
  diamondFace: { flex: 1, overflow: 'hidden' },
  facet: { backgroundColor: 'rgba(255,255,255,0.55)' },
  gloss: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ rotate: '-20deg' }] },
  glyph: { fontWeight: '900', textAlign: 'center', includeFontPadding: false },
});
