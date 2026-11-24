import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { TierRef } from '@tb/engine';
import { BADGE_PX, TierBadge } from '@/components/TierBadge';
import { tierStepOf } from '@/cosmetics/tiers';
import { C } from '@/theme';

const GAP = 10;
/** Tamaño mínimo del nombre antes de cortarlo con "…". */
const MIN_FONT = 18;
/** Margen para que la medida no quede justa (redondeos y la última letra en negrita). */
const SLACK = 4;

/**
 * Cabecera de un perfil: `@usuario`, la insignia y la línea "Insignia X" (pedido del usuario):
 * 1. si cabe, la insignia va al lado del nombre;
 * 2. si no, baja y se pone al lado de "Insignia X";
 * 3. si el nombre solo tampoco cabe, se achica hasta `MIN_FONT`;
 * 4. y si aun así no cabe, se corta con "…".
 * Sin insignia se ve un hueco del mismo tamaño (como en la fila de Colección) y "Aún no tienes
 * insignia" (o "tiene", en el perfil de otro), con las mismas reglas.
 * Mide el ancho natural del nombre con un `Text` invisible, igual en la web y en la app.
 */
export function ProfileName({
  username,
  tier,
  fontSize,
  isMe,
}: {
  username: string;
  tier: TierRef | null | undefined;
  fontSize: number;
  /** Para el texto sin insignia: "Aún no tienes" (tu perfil) o "Aún no tiene" (el de otro). */
  isMe: boolean;
}) {
  const step = tierStepOf(tier);
  const badge = step ? <TierBadge tier={step} size="md" /> : <View style={styles.noBadge} accessibilityElementsHidden importantForAccessibility="no" />;
  const tierText = step ? `Insignia ${step.name}` : isMe ? 'Aún no tienes insignia' : 'Aún no tiene insignia';
  const [avail, setAvail] = useState(0);
  const [nameW, setNameW] = useState(0);
  const badgeW = BADGE_PX.md + GAP;
  const measured = avail > 0 && nameW > 0;

  const inline = !measured || nameW + badgeW + SLACK <= avail;
  const scaled = !measured || inline || nameW + SLACK <= avail ? fontSize : Math.floor((fontSize * (avail - SLACK)) / nameW);
  const size = Math.max(MIN_FONT, scaled);
  const ellipsis = measured && !inline && scaled < MIN_FONT;

  const text = '@' + username;
  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setAvail(Math.floor(e.nativeEvent.layout.width))}>
      {/* medida: ancho natural del nombre al tamaño completo, sin límite de ancho */}
      <View style={styles.measureBox} pointerEvents="none" aria-hidden>
        <Text style={[styles.title, { fontSize }]} onLayout={(e) => setNameW(Math.ceil(e.nativeEvent.layout.width))} numberOfLines={1}>
          {text}
        </Text>
      </View>
      <View style={[styles.row, !measured && styles.hidden]}>
        {/* una línea también antes de medir: así la altura no salta al aparecer */}
        <Text style={[styles.title, styles.shrink, { fontSize: size }]} accessibilityRole="header" numberOfLines={ellipsis || !measured ? 1 : undefined}>
          {text}
        </Text>
        {inline ? badge : null}
      </View>
      <View style={[styles.row, styles.tierRow, !measured && styles.hidden]}>
        {!inline ? badge : null}
        <Text style={styles.tierT}>{tierText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: 6, overflow: 'hidden' },
  // fuera de la vista y muy ancha para que el texto no se ajuste al medir
  measureBox: { position: 'absolute', left: 0, top: 0, width: 4000, opacity: 0, flexDirection: 'row', alignItems: 'flex-start' },
  hidden: { opacity: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GAP, maxWidth: '100%' },
  tierRow: { gap: 8 },
  title: { color: C.text, fontWeight: '800' },
  // minWidth 0: en la web, sin esto el nombre no se encoge y empuja la insignia fuera de la pantalla
  shrink: { flexShrink: 1, minWidth: 0, textAlign: 'center' },
  noBadge: { width: BADGE_PX.md, height: BADGE_PX.md, borderRadius: BADGE_PX.md / 2, backgroundColor: C.barBg },
  tierT: { color: C.text, opacity: 0.75, fontSize: 14, fontWeight: '600' },
});
