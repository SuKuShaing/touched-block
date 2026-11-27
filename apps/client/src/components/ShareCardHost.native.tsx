import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { type HostInstance, PixelRatio, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { TIERS } from '@tb/engine';
import { AchievementIcon } from '@/components/AchievementIcon';
import { TierBadge } from '@/components/TierBadge';
import { SHARE_BADGE } from '@/cosmetics/medal';
import { tierStepOf } from '@/cosmetics/tiers';
import { finishCardJob, getCardJob, isPrizeCard, PRIZE_CARD, subscribeCardJob } from '@/lib/shareCardStore';
import { prizeCardTexts } from '@/lib/shareText';
import type { PrizeShareCard, ResultCard } from '@/platform/share.types';

/**
 * Tarjetas de compartir en nativo (resultado y premio): las mismas de `platform/share.web.ts`
 * (1080×1080, mismos colores, posiciones y textos), pero con `View`/`Text` en vez de `<canvas>`.
 * Cada una se dibuja fuera de la pantalla solo mientras está pedida (`lib/shareCardStore.ts`), se captura con
 * react-native-view-shot y se deja en `cache/touched-block-<hash>.png` para compartirla.
 *
 * Las medidas se escriben en píxeles del canvas (0–1080) y se pasan a dp con `px()`, para que la
 * captura salga de 1080 píxeles reales en cualquier densidad de pantalla.
 */

const W = 1080;
const H = 1080;
// Se calcula al dibujar y no al cargar el módulo: en el APK release, PixelRatio todavía no está
// disponible cuando expo-router carga _layout (la app se cerraba al abrir).
const px = (n: number) => n / PixelRatio.get();

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

/** Insignia arriba a la derecha: la de `TierBadge` (el mismo SVG que el canvas de la web), con su nombre. */
function Badge({ card, cx, cy }: { card: ResultCard; cx: number; cy: number }) {
  const t = tierStepOf(card.tier);
  if (!t) return null;
  const B = SHARE_BADGE.box;
  return (
    <>
      <TierBadge tier={card.tier} size={px(B)} style={{ position: 'absolute', left: px(cx - B / 2), top: px(cy - B / 2) }} />
      <Line text={t.name} y={cy + SHARE_BADGE.nameDy} size={SHARE_BADGE.nameSize} weight="700" opacity={0.9} maxW={300} cx={cx} />
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

      {card.tier ? <Badge card={card} cx={W - 185} cy={182} /> : null}

      <Line text="touchedblock.app" y={975} size={32} weight="500" opacity={0.6} maxW={W - 160} />
    </View>
  );
}

/** Tarjeta de un premio: la misma que `drawPrize` de `platform/share.web.ts`. */
function PrizeImage({ card }: { card: PrizeShareCard }) {
  const texts = prizeCardTexts(card);
  const at = card.kind === 'item' ? PRIZE_CARD.textOnly : PRIZE_CARD.withArt;
  const { box, cy } = PRIZE_CARD.art;
  const maxW = PRIZE_CARD.maxW;
  const art = rect((W - box) / 2, cy - box / 2, box, box, 0);
  return (
    <View style={{ width: px(W), height: px(H), backgroundColor: '#12121a' }}>
      {/* panel */}
      <View style={[rect(60, 60, W - 120, H - 120, 48), { backgroundColor: '#1c1c28' }]} />

      <Line text="Touched Block" {...PRIZE_CARD.brand} weight="800" maxW={maxW} />
      {card.username ? <Line text={'@' + card.username} {...PRIZE_CARD.who} weight="600" color="#77ccff" maxW={maxW} /> : null}

      {texts ? (
        <>
          <Line text={texts.kicker} {...at.kicker} weight="700" color={texts.color} maxW={maxW} />
          {card.kind === 'tier' ? <TierBadge tier={TIERS[card.index]} size={px(box)} style={art} /> : null}
          {card.kind === 'achievement' ? (
            <View style={art}>
              <AchievementIcon id={card.id} level={card.level} size={px(box)} />
            </View>
          ) : null}
          <Line text={texts.title} {...at.title} weight="800" maxW={maxW} />
          <Line text={texts.sub} {...at.sub} weight="600" opacity={0.85} maxW={maxW} />
        </>
      ) : null}

      <Line text="touchedblock.app" {...PRIZE_CARD.footer} weight="500" opacity={0.6} maxW={maxW} />
    </View>
  );
}

/** Hash corto y determinista (djb2, base 36) para distinguir el archivo de cada tarjeta. */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Nombres de las últimas tarjetas guardadas: la anterior puede estar compartiéndose aún. */
const recentNames: string[] = [];
const KEEP = 2;

/** Borra las tarjetas viejas de la caché (`touched-block*.png`), salvo las últimas `KEEP`. */
function pruneOld() {
  try {
    for (const f of new Directory(Paths.cache).list()) {
      if (f instanceof File && /^touched-block.*\.png$/.test(f.name) && !recentNames.includes(f.name)) f.delete();
    }
  } catch {}
}

/**
 * Deja la captura con un nombre legible y propio de la tarjeta (`touched-block-<hash>.png`) en la
 * caché de la app: así una captura vieja nunca pisa el archivo de otra ya entregada o compartiéndose.
 */
function toNamedFile(uri: string, key: string): string {
  try {
    const name = `touched-block-${shortHash(key)}.png`;
    const dest = new File(Paths.cache, name);
    if (dest.exists) dest.delete();
    new File(uri).copy(dest);
    const i = recentNames.indexOf(name);
    if (i >= 0) recentNames.splice(i, 1);
    recentNames.push(name);
    if (recentNames.length > KEEP) recentNames.shift();
    pruneOld();
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
          const tmp = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
          // la tarjeta cambió (o se desmontó) durante la captura: no copiar ni avisar nada; la
          // pedida vieja ya se descartó en shareCardStore (o la cierra su tiempo límite)
          if (!alive) return;
          uri = toNamedFile(tmp, job.key);
        } catch {
          if (!alive) return;
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
        {isPrizeCard(job.card) ? <PrizeImage card={job.card} /> : <Card card={job.card} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // fuera de la pantalla (view-shot la dibuja igual: no necesita que se vea)
  offscreen: { position: 'absolute', left: -px(W) - 100, top: 0, width: px(W), height: px(H) },
});
