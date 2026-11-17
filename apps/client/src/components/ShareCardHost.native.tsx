import { File, Paths } from 'expo-file-system';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { type HostInstance, PixelRatio, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { TierBadge } from '@/components/TierBadge';
import { tierStepOf } from '@/cosmetics/tiers';
import { finishCardJob, getCardJob, subscribeCardJob } from '@/lib/shareCardStore';
import type { ResultCard } from '@/platform/share.types';

/**
 * Tarjeta de resultado en nativo: la misma de `platform/share.web.ts` (1080×1080, mismos colores,
 * posiciones y textos), pero con `View`/`Text` en vez de `<canvas>`. Se dibuja fuera de la
 * pantalla solo mientras hay una pedida (`lib/shareCardStore.ts`), se captura con
 * react-native-view-shot y se deja en `cache/touched-block.png` para compartirla.
 *
 * Las medidas se escriben en píxeles del canvas (0–1080) y se pasan a dp con `px()`, para que la
 * captura salga de 1080 píxeles reales en cualquier densidad de pantalla.
 */

const W = 1080;
const H = 1080;
const K = 1 / PixelRatio.get();
const px = (n: number) => n * K;

type Weight = '500' | '600' | '700' | '800';

/**
 * Una línea de texto centrada en `cx` cuya línea base queda en `y` (como `fillText`). Si no cabe
 * en `maxW`, se achica (el `fitFont` del canvas).
 */
function Line({
  text,
  y,
  size,
  weight,
  color = '#ffffff',
  opacity = 1,
  maxW = W - 240,
  cx = W / 2,
}: {
  text: string;
  y: number;
  size: number;
  weight: Weight;
  color?: string;
  opacity?: number;
  maxW?: number;
  cx?: number;
}) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.2}
      style={{
        position: 'absolute',
        left: px(cx - maxW / 2),
        width: px(maxW),
        // con lineHeight 1.2 y sin padding de fuente, la base queda ~0.95 del tamaño bajo el borde
        top: px(y - size * 0.95),
        fontSize: px(size),
        lineHeight: px(size * 1.2),
        fontWeight: weight,
        color,
        opacity,
        textAlign: 'center',
        includeFontPadding: false,
      }}
    >
      {text}
    </Text>
  );
}

function rect(x: number, y: number, w: number, h: number, r: number) {
  return { position: 'absolute' as const, left: px(x), top: px(y), width: px(w), height: px(h), borderRadius: px(r) };
}

/** Insignia arriba a la derecha: la de `TierBadge` (tamaño lg) agrandada a radio `r`, con su nombre. */
function Badge({ card, cx, cy, r }: { card: ResultCard; cx: number; cy: number; r: number }) {
  const t = tierStepOf(card.tier);
  if (!t) return null;
  const framed = t.tier === 'diamante' || t.tier === 'oro';
  const box = 80; // mayor que la caja de TierBadge lg (64 + marco)
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: px(cx) - box / 2,
          top: px(cy) - box / 2,
          width: box,
          height: box,
          alignItems: 'center',
          justifyContent: 'center',
          // la medalla lg mide 64 dp de diámetro; en la tarjeta mide 2r píxeles
          transform: [{ scale: px(2 * r) / 64 }],
        }}
      >
        <TierBadge tier={card.tier} size="lg" />
      </View>
      <Line text={t.name} y={cy + r * (framed ? 1.78 : 1.62)} size={Math.round(r * 0.46)} weight="700" opacity={0.9} maxW={300} cx={cx} />
    </>
  );
}

function Card({ card }: { card: ResultCard }) {
  const bs = 190;
  const bx = (W - bs) / 2;
  const by = 120;
  const who = card.username ? '@' + card.username : 'Invitado';
  const ranks: string[] = [];
  if (card.worldRank) ranks.push(`#${card.worldRank} en el mundo`);
  if (card.countryRank) ranks.push(`#${card.countryRank} en ${card.countryName || 'mi país'}`);

  return (
    <View style={{ width: px(W), height: px(H), backgroundColor: '#12121a' }}>
      {/* panel */}
      <View style={[rect(60, 60, W - 120, H - 120, 48), { backgroundColor: '#1c1c28' }]} />

      {/* logo: bloque azul con un 3 (el mismo del favicon) */}
      <View style={[rect(bx, by + 16, bs, bs, 44), { backgroundColor: '#000', opacity: 0.35 }]} />
      <View style={[rect(bx, by, bs, bs, 44), { backgroundColor: '#0091ff' }]} />
      <View style={[rect(bx + 24, by + bs - 36, 88, 14, 7), { backgroundColor: '#fff', opacity: 0.85 }]} />
      <Line text="3" y={by + 140} size={132} weight="800" maxW={bs} />

      <Line text="Touched Block" y={410} size={64} weight="800" maxW={W - 160} />
      <Line text={who} y={480} size={42} weight="600" color="#77ccff" />

      <Line text={String(card.killed)} y={720} size={230} weight="800" />
      <Line text={card.killed === 1 ? 'bloque' : 'bloques'} y={790} size={50} weight="600" opacity={0.85} />

      {/* etapa alcanzada (opcional) */}
      {card.stage ? <Line text={card.stage} y={858} size={40} weight="700" opacity={0.92} maxW={W - 220} /> : null}

      {ranks.length ? (
        <Line
          text={ranks.join(' · ')}
          y={card.stage ? 918 : 880}
          size={card.stage ? 38 : 42}
          weight="700"
          color="#ffd166"
          maxW={W - 220}
        />
      ) : null}

      {card.tier ? <Badge card={card} cx={W - 185} cy={182} r={64} /> : null}

      <Line text="sukushaing.github.io/touched-block" y={975} size={32} weight="500" opacity={0.6} maxW={W - 160} />
    </View>
  );
}

/** Deja la captura con un nombre legible (`touched-block.png`) en la caché de la app. */
function toNamedFile(uri: string): string {
  try {
    const dest = new File(Paths.cache, 'touched-block.png');
    if (dest.exists) dest.delete();
    new File(uri).copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

/**
 * Montado una vez en `app/_layout.tsx`. No dibuja nada hasta que `share.native.ts` pide una
 * tarjeta; entonces la pone fuera de la pantalla, la captura y avisa el resultado.
 */
export function ShareCardHost() {
  const job = useSyncExternalStore(subscribeCardJob, getCardJob, getCardJob);
  const ref = useRef<HostInstance>(null);

  useEffect(() => {
    if (!job) return;
    let alive = true;
    // dos cuadros para que la vista ya esté dibujada antes de capturarla
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        if (!alive) return;
        let uri: string | null = null;
        try {
          uri = toNamedFile(await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' }));
        } catch {
          uri = null;
        }
        finishCardJob(job.key, uri);
      }),
    );
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [job]);

  if (!job) return null;
  return (
    <View pointerEvents="none" style={styles.offscreen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={ref} collapsable={false}>
        <Card card={job.card} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // fuera de la pantalla (view-shot la dibuja igual: no necesita que se vea)
  offscreen: { position: 'absolute', left: -px(W) - 100, top: 0, width: px(W), height: px(H) },
});
