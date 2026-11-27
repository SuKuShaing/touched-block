import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { type AchievementId, TIERS } from '@tb/engine';
import { useViewer } from '@/api/hooks';
import type { CatalogStats } from '@/cosmetics/catalog';
import { SITE_URL, prizeDetail, prizeShareText } from '@/lib/shareText';
import { share } from '@/platform/share';
import type { PrizeShareCard, PrizeShareItem } from '@/platform/share.types';
import { C } from '@/theme';
import { AchievementIcon } from './AchievementIcon';
import { TierBadge } from './TierBadge';

/** Qué se mira en grande: una insignia (−1 = todavía ninguna) o un escalón de un logro (0 = vacío). */
export type PrizeRef =
  | { kind: 'tier'; index: number }
  | { kind: 'achievement'; id: AchievementId; level: number };

// ---------------------------------------------------------------- compartir

/** Icono de compartir: una flecha que sale de una caja (el mismo trazo que los de las pestañas). */
export function ShareIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M8.5 10H6.5A1.5 1.5 0 0 0 5 11.5V19A1.5 1.5 0 0 0 6.5 20.5H17.5A1.5 1.5 0 0 0 19 19V11.5A1.5 1.5 0 0 0 17.5 10H15.5M12 14.5V3.5M8.5 7L12 3.5L15.5 7"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Lo que dura el aviso bajo los botones (como el toast de la app). */
const NOTICE_MS = 2600;

/**
 * Compartir un premio desde una ventana. La imagen se prepara al mostrarlo (en la web, para no
 * perder el gesto del usuario al compartir) y los avisos van **dentro** de la ventana: el toast de
 * la app quedaría detrás. La tarjeta lleva el usuario solo con cuenta.
 */
export function usePrizeShare(item: PrizeShareItem | null) {
  const username = useViewer().user?.username ?? null;
  const key = item ? JSON.stringify({ ...item, username }) : null;
  // la clave lleva todos los datos: la tarjeta cambia solo cuando cambia ella
  const card = useMemo(() => (key ? (JSON.parse(key) as PrizeShareCard) : null), [key]);
  useEffect(() => {
    if (card) share.preparePrize(card);
  }, [card]);

  const [notice, setNotice] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);

  /** Premio que se está compartiendo (para no abrir dos hojas con un toque doble). */
  const busy = useRef<string | null>(null);
  const run = async () => {
    if (!card || !key || busy.current === key) return;
    busy.current = key;
    try {
      const r = await share.sharePrize(card, prizeShareText(card), SITE_URL);
      if (r === 'copied') setNotice({ key, text: 'Copiado al portapapeles' });
      else if (r === 'failed') setNotice({ key, text: 'No se pudo compartir' });
    } catch {
      setNotice({ key, text: 'No se pudo compartir' });
    } finally {
      if (busy.current === key) busy.current = null;
    }
  };

  return { share: () => void run(), notice: notice && notice.key === key ? notice.text : null };
}

// ---------------------------------------------------------------- ventana

/** Lado de la insignia o del icono del logro en la ventana (el de la tarjeta de resultado). */
const ART_PX = 170;

/** "#ffd166" + alfa → "rgba(255,209,102,a)". */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function Art({ prize }: { prize: PrizeRef }) {
  if (prize.kind === 'achievement') return <AchievementIcon id={prize.id} level={prize.level} size={ART_PX} />;
  const tier = TIERS[prize.index];
  return tier ? <TierBadge tier={tier} size={ART_PX} /> : <View style={styles.empty} />;
}

function Window({ prize, stats, onClose }: { prize: PrizeRef; stats: CatalogStats; onClose(): void }) {
  const d = prizeDetail(prize, stats);
  const { share: onShare, notice } = usePrizeShare(d.share);
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.card, { borderColor: d.color ? rgba(d.color, 0.45) : C.panelBorder }]} accessibilityViewIsModal>
          <Text style={[styles.kicker, { color: d.color ?? C.text }, !d.color && styles.dim]}>{d.kicker}</Text>
          <View style={styles.art}>
            <Art prize={prize} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {d.title}
          </Text>
          {d.material ? <Text style={[styles.material, { color: d.color ?? C.text }]}>{d.material}</Text> : null}
          {d.status ? <Text style={styles.status}>{d.status}</Text> : null}
          <Text style={styles.goal}>{d.goal}</Text>
          {d.ratio !== null ? (
            <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(d.ratio * 100) }}>
              <View style={[styles.barFill, { width: `${d.ratio * 100}%`, backgroundColor: d.color ?? C.accent }]} />
            </View>
          ) : null}
          {d.progress ? <Text style={styles.small}>{d.progress}</Text> : null}
          {d.next ? <Text style={styles.small}>{d.next}</Text> : null}

          {d.share ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compartir"
              onPress={onShare}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <ShareIcon color={C.bg} size={20} />
              <Text style={styles.primaryT}>Compartir</Text>
            </Pressable>
          ) : null}
          {notice ? (
            <Text style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={onClose}
            style={({ pressed }) => [styles.ghost, !d.share && styles.ghostAlone, pressed && styles.pressed]}
          >
            <Text style={styles.ghostT}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Ventana de una insignia o un logro en grande, con compartir (`prize` null = cerrada). Es una
 * consulta, no una celebración: sin confeti ni rayos. Se cierra con "Cerrar", tocando fuera o con
 * "atrás" en Android. Sin el premio todavía, la silueta y "Todavía no lo tienes", sin compartir.
 */
export function PrizeModal({ prize, stats, onClose }: { prize: PrizeRef | null; stats: CatalogStats; onClose(): void }) {
  return prize ? <Window prize={prize} stats={stats} onClose={onClose} /> : null;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.66)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: 320,
    maxWidth: '100%',
    backgroundColor: C.panel,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 6,
  },
  kicker: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  dim: { opacity: 0.6 },
  art: { height: ART_PX + 12, alignItems: 'center', justifyContent: 'center' },
  empty: { width: ART_PX, height: ART_PX, borderRadius: ART_PX / 2, borderWidth: 2, borderColor: C.panelBorder, borderStyle: 'dashed', backgroundColor: C.bg },
  title: { color: C.text, fontSize: 24, lineHeight: 30, fontWeight: '900', textAlign: 'center' },
  material: { fontSize: 18, lineHeight: 24, fontWeight: '800', textAlign: 'center', marginTop: -4 },
  status: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  goal: { color: C.text, opacity: 0.88, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  bar: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: C.barBg, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 4 },
  small: { color: C.text, opacity: 0.6, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  primary: {
    alignSelf: 'stretch',
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: C.accent,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryT: { color: C.bg, fontWeight: '900', fontSize: 17 },
  notice: { color: C.text, opacity: 0.85, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  ghost: { alignSelf: 'stretch', minHeight: 44, borderRadius: 14, backgroundColor: C.barBg, alignItems: 'center', justifyContent: 'center' },
  ghostAlone: { marginTop: 10 },
  ghostT: { color: C.text, fontWeight: '800', fontSize: 15 },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
});
