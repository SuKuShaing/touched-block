import { useIsFocused, useRouter } from 'expo-router';
import { memo, type ReactNode, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementId,
  COLORS,
  TICKS_PER_SECOND,
  TIERS,
  achievementById,
  achievementGoal,
  achievementLevel,
  achievementMaterial,
  achievementNext,
  tierIndexOf,
} from '@tb/engine';
import { useMeRefresh, useViewer } from '@/api/hooks';
import type { Me } from '@/api/types';
import { AchievementIcon } from '@/components/AchievementIcon';
import { EffectIcon } from '@/components/EffectIcon';
import { FieldBackground } from '@/components/FieldBackground';
import { SmallButton } from '@/components/form';
import { galleryStats } from '@/components/galleryStats';
import { PaletteSwatch } from '@/components/PaletteSwatch';
import { PreviewPanel } from '@/components/PreviewPanel';
import { PrizeModal, type PrizeRef } from '@/components/PrizeModal';
import { BADGE_PX, TierBadge } from '@/components/TierBadge';
import { config, features } from '@/config';
import { useActiveCosmetics } from '@/cosmetics/active';
import {
  CATALOG,
  type CatalogItem,
  type CatalogStats,
  type CosmeticType,
  SETTING_KEY,
  TYPE_LABEL,
  TYPE_ORDER,
  fmtCount,
  fmtSeconds,
  isUnlocked,
  missingText,
  tierGoal,
  tierIndexOfStats,
} from '@/cosmetics/catalog';
import { MATERIAL_COLOR, tierColor } from '@/cosmetics/tiers';
import { sounds } from '@/game/sounds';
import { useMarkCollectionSeen } from '@/lib/collectionNews';
import { achievementValues } from '@/lib/achievementValues';
import { levelFor, xpOf } from '@/lib/level';
import { type Settings, updateSettings } from '@/lib/settings';
import { useTabBarSpace } from '@/lib/tabBar';
import { C } from '@/theme';

/**
 * Los logros del reto diario (fase 4) y sus premios solo se muestran si se puede jugar
 * el reto: necesita la API (sin ella el juego queda en modo solo invitado y local).
 */
const SHOW_DAILY = features.accounts;

const fmtInt = fmtCount;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** Lado de las miniaturas de las filas y de sus nueve muestras de paleta (3 × 3 con 3 px entre ellas). */
const THUMB_PX = 44;
const SWATCH_PX = 12.6;
/** Lado del dibujo en la línea "Premio: …" de un logro y del icono del logro que pide un premio. */
const MINI_PX = 22;
const REQ_ICON_PX = 26;
/** Medallas de la galería del APK de prueba. */
const GALLERY_PX = 48;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Bar({ ratio, color = C.accent }: { ratio: number; color?: string }) {
  return (
    <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp01(ratio) * 100) }}>
      <View style={[styles.barFill, { width: `${clamp01(ratio) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Hueco gris del tamaño de una medalla (todavía sin insignia o sin logro). */
function EmptyMedal({ size }: { size: number }) {
  return <View style={[styles.emptyMedal, { width: size, height: size, borderRadius: size / 2 }]} />;
}

// ---------------------------------------------------------------- insignia

function TierCard({ stats, me, onOpen }: { stats: CatalogStats; me: Me | null; onOpen: (prize: PrizeRef) => void }) {
  const idx = tierIndexOfStats(stats);
  const cur = idx >= 0 ? TIERS[idx] : null;
  const next = idx + 1 < TIERS.length ? TIERS[idx + 1] : null;
  const best = stats.bestTicks / TICKS_PER_SECOND;
  const from = cur ? cur.at : 0;
  const ratio = next ? (best - from) / Math.max(1, next.at - from) : 1;
  const first = TIERS[0];
  const name = cur ? `Insignia ${cur.name}` : 'Sin insignia';
  const detail = cur ? `Tu partida más larga: ${fmtSeconds(best)}` : `${tierGoal(first)} para ganar ${first.name}.`;
  // con sesión, la insignia pública es la de la cuenta (las partidas de invitado sin guardar no cuentan)
  const serverIdx = me && me.tier !== undefined ? tierIndexOf(me.tier) : null;

  return (
    <Section title="Insignia">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${detail.replace(/\.$/, '')}. Ver en grande`}
        onPress={() => onOpen({ kind: 'tier', index: idx })}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}
      >
        {cur ? <TierBadge tier={cur} size="lg" /> : <EmptyMedal size={BADGE_PX.lg} />}
        <View style={styles.flex1}>
          <Text style={styles.big}>{cur ? cur.name : 'Sin insignia'}</Text>
          <Text style={styles.muted}>{detail}</Text>
        </View>
      </Pressable>
      {next ? (
        <View style={styles.stack}>
          <View style={styles.inline}>
            <Text style={styles.label}>Siguiente:</Text>
            <TierBadge tier={next} size="sm" />
            <Text style={[styles.label, styles.strong, styles.shrink]}>
              {next.name} <Text style={styles.normal}>· {lowerFirst(tierGoal(next))}</Text>
            </Text>
          </View>
          <Bar ratio={ratio} color={tierColor(next)} />
          <Text style={styles.small}>
            {best > 0 ? `Te faltaron ${fmtSeconds(next.at - best)} en tu mejor partida.` : `Te faltan ${fmtSeconds(next.at)}.`}
          </Text>
        </View>
      ) : null}
      {!next ? <Text style={[styles.label, styles.gold]}>¡Tienes la insignia más alta!</Text> : null}
      {serverIdx !== null && serverIdx < idx ? (
        <Text style={styles.small}>
          En tu perfil público se ve {serverIdx >= 0 ? TIERS[serverIdx].name : 'sin insignia'}: ahí solo cuentan las partidas guardadas
          en tu cuenta.
        </Text>
      ) : null}
    </Section>
  );
}

// ---------------------------------------------------------------- experiencia

function LevelCard({ stats }: { stats: CatalogStats }) {
  const lv = levelFor(xpOf(stats));
  const missing = lv.next - lv.xp;
  return (
    <Section title="Experiencia">
      <View style={styles.head}>
        <View style={styles.levelBubble}>
          <Text style={styles.levelN}>{lv.level}</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.big}>Nivel {lv.level}</Text>
          <Text style={styles.muted}>
            {fmtInt(lv.xp)} {lv.xp === 1 ? 'bloque destruido' : 'bloques destruidos'}
          </Text>
        </View>
      </View>
      <Bar ratio={lv.progress} />
      <Text style={styles.small}>
        {missing === 1 ? 'Te falta 1 bloque' : `Te faltan ${fmtInt(missing)} bloques`} para el nivel {lv.level + 1}.
      </Text>
    </Section>
  );
}

// ---------------------------------------------------------------- premios

/** Miniatura de un premio en su fila. Memorizada: son 55 y varias dibujan un SVG. */
const Preview = memo(function Preview({ item, locked }: { item: CatalogItem; locked: boolean }) {
  const dim = locked ? styles.dim : null;
  switch (item.type) {
    case 'palette':
      return (
        <View style={[styles.swatches, dim]}>
          {COLORS.map((c, i) => (
            <PaletteSwatch key={c} paletteId={item.id} index={i} size={SWATCH_PX} radius={3} />
          ))}
        </View>
      );
    case 'sound':
      return (
        <View style={[styles.preview, dim]}>
          <Text style={styles.note} allowFontScaling={false}>
            ♪
          </Text>
        </View>
      );
    case 'effect':
      return (
        <View style={[styles.preview, dim]}>
          <EffectIcon id={item.id} />
        </View>
      );
    case 'background':
      return (
        <View style={[styles.preview, styles.bgPreview, dim]}>
          {/* siempre quieto: hay una miniatura por cada fondo */}
          <FieldBackground id={item.id} cell={9} thumb paused />
        </View>
      );
  }
});

const TYPE_WORD: Record<CosmeticType, string> = { palette: 'Paleta', sound: 'Sonido', effect: 'Efecto', background: 'Fondo' };

const ItemRow = memo(function ItemRow({
  item,
  stats,
  selected,
  loggedIn,
  last,
  onPick,
}: {
  item: CatalogItem;
  stats: CatalogStats;
  selected: boolean;
  loggedIn: boolean;
  last: boolean;
  onPick: (item: CatalogItem) => void;
}) {
  const unlocked = isUnlocked(item, stats);
  const miss = unlocked ? null : item.requires === 'accounts' && !loggedIn ? 'necesitas una cuenta' : missingText(item, stats);
  const req = unlocked ? null : `${item.goal}${miss ? ` · ${miss}` : ''}`;
  const status = selected ? 'En uso' : unlocked ? (item.note ?? null) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !unlocked }}
      accessibilityLabel={`${TYPE_WORD[item.type]} ${item.name}${selected ? ', en uso' : unlocked ? '' : `, bloqueado: ${lowerFirst(req ?? '')}`}`}
      disabled={!unlocked}
      onPress={() => onPick(item)}
      style={({ pressed }) => [styles.item, last && styles.itemLast, selected && styles.itemOn, pressed && styles.pressed]}
    >
      <Preview item={item} locked={!unlocked} />
      <View style={styles.itemText}>
        <Text style={[styles.itemName, !unlocked && styles.lockedT]}>{item.name}</Text>
        {req ? (
          <View style={styles.reqRow}>
            {item.req.kind === 'tier' ? <TierBadge tier={TIERS[item.req.index]} size="sm" /> : null}
            {item.req.kind === 'achievement' ? <AchievementIcon id={item.req.id} level={item.req.level} size={REQ_ICON_PX} /> : null}
            <Text style={[styles.small, styles.flex1]}>{req}</Text>
          </View>
        ) : status ? (
          <Text style={[styles.small, selected && styles.onT]}>{status}</Text>
        ) : null}
        {selected && item.note ? <Text style={styles.small}>{item.note}</Text> : null}
      </View>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
});

function listed(item: CatalogItem): boolean {
  if (item.requires === 'daily') return SHOW_DAILY;
  if (item.requires === 'accounts') return features.accounts;
  return true;
}

// ---------------------------------------------------------------- logros

/** Premio (efecto o fondo) que entrega el escalón `level` (1 = Papel) de un logro, si se muestra. */
function prizeOfStep(id: AchievementId, level: number): CatalogItem | undefined {
  return CATALOG.find((i) => i.req.kind === 'achievement' && i.req.id === id && i.req.level === level && listed(i));
}

/** "Premio: …" del siguiente escalón, con el icono del efecto o la miniatura del fondo. */
function PrizeLine({ item }: { item: CatalogItem }) {
  return (
    <View style={styles.prize}>
      {item.type === 'effect' ? (
        <EffectIcon id={item.id} size={MINI_PX} />
      ) : (
        <View style={styles.mini}>
          {/* la miniatura de la fila a media escala */}
          <View style={styles.miniScaled}>
            <Preview item={item} locked={false} />
          </View>
        </View>
      )}
      <Text style={styles.prizeT}>Premio: {item.name}</Text>
    </View>
  );
}

function AchievementRow({
  a,
  value,
  last,
  onOpen,
}: {
  a: Achievement;
  value: number | null;
  last: boolean;
  onOpen: (prize: PrizeRef) => void;
}) {
  const level = achievementLevel(a.id, value);
  const mat = achievementMaterial(level);
  const next = achievementNext(a.id, value);
  const th = achievementById(a.id).thresholds;
  const prev = level > 0 ? th[level - 1] : 0;
  const v = value ?? 0;
  const ratio = next === null ? 1 : (v - prev) / Math.max(1, next - prev);
  const pct = a.id === 'mejorReto';
  const detail =
    next === null
      ? '¡Nivel máximo!'
      : `${achievementGoal(a.id, level + 1)}${value !== null ? ` · llevas ${fmtInt(v)}${pct ? ' %' : ''}` : ''}`;
  const prize = next === null ? undefined : prizeOfStep(a.id, level + 1);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Logro ${a.name}, ${mat ?? 'sin material'}. ${detail}${prize ? `. Premio: ${prize.name}` : ''}. Ver en grande`}
      onPress={() => onOpen({ kind: 'achievement', id: a.id, level })}
      style={({ pressed }) => [styles.item, last && styles.itemLast, pressed && styles.pressed]}
    >
      <AchievementIcon id={a.id} level={level} size="md" />
      <View style={styles.itemText}>
        <Text style={styles.itemName}>
          {a.name}
          {mat ? <Text style={styles.matT}> · {mat}</Text> : null}
        </Text>
        <Bar ratio={ratio} color={mat ? MATERIAL_COLOR[mat] : C.accent} />
        <Text style={styles.small}>{detail}</Text>
        {prize ? <PrizeLine item={prize} /> : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- galería (APK de prueba)

function GalleryCell({ caption, label, onPress, children }: { caption: string; label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Ver en grande`}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      {children}
      <Text style={styles.caption}>{caption}</Text>
    </Pressable>
  );
}

/** Todas las insignias y los materiales de cada logro (también vacíos), para verlos en grande y compartirlos. */
function TestGallery({ onOpen }: { onOpen: (prize: PrizeRef) => void }) {
  return (
    <Section title="Galería de prueba">
      <Text style={styles.small}>Solo en esta versión de prueba. Toca uno para verlo en grande y compartirlo.</Text>
      <Text style={styles.itemName}>Insignias</Text>
      <View style={styles.gallery}>
        {TIERS.map((t) => (
          <GalleryCell key={t.name} caption={t.name} label={`Insignia ${t.name}`} onPress={() => onOpen({ kind: 'tier', index: t.index })}>
            <TierBadge tier={t} size={GALLERY_PX} />
          </GalleryCell>
        ))}
      </View>
      {ACHIEVEMENTS.map((a) => (
        <View key={a.id} style={styles.stack}>
          <Text style={styles.itemName}>{a.name}</Text>
          <View style={styles.gallery}>
            {/* 0 = vacío; 1 … 7 = Papel … Diamante */}
            {[0, ...a.thresholds.map((_, i) => i + 1)].map((level) => {
              const caption = achievementMaterial(level) ?? 'Vacío';
              return (
                <GalleryCell
                  key={level}
                  caption={caption}
                  label={`Logro ${a.name}, ${caption}`}
                  onPress={() => onOpen({ kind: 'achievement', id: a.id, level })}
                >
                  <AchievementIcon id={a.id} level={level} size={GALLERY_PX} />
                </GalleryCell>
              );
            })}
          </View>
        </View>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------- pantalla

/**
 * `/coleccion` (pestaña): insignia y la siguiente, experiencia, logros, premios por tipo (tocar uno
 * desbloqueado lo activa) y la vista previa de lo equipado. Tocar la insignia o un logro lo muestra
 * en grande (`PrizeModal`). Las estadísticas son las de este dispositivo y, con sesión, el máximo
 * con las del servidor (`cosmetics/active.ts`). Sin sesión, un aviso invita a iniciarla para
 * guardar los logros. Sin API no hay barra de pestañas: se llega desde el Perfil y tiene botón
 * Volver. El APK de prueba (`config.unlockAll`) lo dice arriba y añade una galería de premios.
 */
export function CollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewer = useViewer();
  useMeRefresh(); // con sesión, trae las estadísticas del servidor al día
  const active = useActiveCosmetics();
  const stats = active.stats;
  const me = viewer.loggedIn ? viewer.user : null;
  const tabSpace = useTabBarSpace();
  useMarkCollectionSeen(useIsFocused());

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const pick = useCallback((item: CatalogItem) => {
    const key = SETTING_KEY[item.type];
    const patch: Partial<Settings> = {};
    patch[key] = item.id;
    updateSettings(patch);
    if (item.type === 'sound') sounds.preview(item.id);
  }, []);

  // lo que se está viendo en grande; `demo` = abierto desde la galería de prueba
  const [shown, setShown] = useState<{ prize: PrizeRef; demo: boolean } | null>(null);
  const open = (prize: PrizeRef) => setShown({ prize, demo: false });
  const openDemo = (prize: PrizeRef) => setShown({ prize, demo: true });

  const achievements = ACHIEVEMENTS.filter((a) => SHOW_DAILY || (a.id !== 'diasReto' && a.id !== 'mejorReto'));
  const values = achievementValues(stats);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {features.accounts ? null : (
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={10} onPress={back} style={styles.backBtn}>
            <Text style={styles.backT}>‹ Volver</Text>
          </Pressable>
        </View>
      )}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: features.accounts ? 24 : 4, paddingBottom: 28 + insets.bottom + tabSpace }]}
      >
        <Text style={styles.title} accessibilityRole="header">
          Colección
        </Text>
        <Text style={styles.intro}>Tus premios cambian cómo se ve y suena el juego, nunca las reglas.</Text>
        {config.unlockAll ? <Text style={styles.testMode}>MODO PRUEBA</Text> : null}

        {features.accounts && !viewer.loggedIn ? (
          <View style={styles.guest}>
            <Text style={[styles.label, styles.flex1]}>
              Inicia sesión para guardar tus logros. Lo que ganes como invitado queda solo en este dispositivo.
            </Text>
            <SmallButton title="Iniciar sesión" onPress={() => router.navigate('/perfil')} />
          </View>
        ) : null}

        <TierCard stats={stats} me={me} onOpen={open} />
        <LevelCard stats={stats} />

        <Section title="Logros">
          <View style={styles.list}>
            {achievements.map((a, i) => (
              <AchievementRow key={a.id} a={a} value={values[a.id]} last={i === achievements.length - 1} onOpen={open} />
            ))}
          </View>
        </Section>

        {TYPE_ORDER.map((type) => {
          const items = CATALOG.filter((i) => i.type === type && listed(i));
          const chosen = active[SETTING_KEY[type]];
          return (
            <Section key={type} title={TYPE_LABEL[type]}>
              <View style={styles.list}>
                {items.map((it, i) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    stats={stats}
                    selected={chosen === it.id}
                    loggedIn={viewer.loggedIn}
                    last={i === items.length - 1}
                    onPick={pick}
                  />
                ))}
              </View>
            </Section>
          );
        })}

        <PreviewPanel />

        {config.unlockAll ? <TestGallery onOpen={openDemo} /> : null}

        <Text style={styles.foot}>Lo que eliges se guarda en este dispositivo.</Text>
      </ScrollView>
      <PrizeModal prize={shown?.prize ?? null} stats={shown?.demo ? galleryStats(shown.prize) : stats} onClose={() => setShown(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { height: 52, justifyContent: 'center', paddingHorizontal: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 6 },
  backT: { color: C.accent, fontSize: 17, fontWeight: '600' },
  content: { alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  guest: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 16,
    padding: 14,
  },
  title: { color: C.text, fontSize: 28, fontWeight: '800' },
  testMode: {
    color: C.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  intro: { color: C.text, opacity: 0.7, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 340, marginTop: -6 },
  section: { width: '100%', maxWidth: 480, backgroundColor: C.panel, borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: { color: C.text, opacity: 0.6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.9 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex1: { flex: 1, gap: 2 },
  shrink: { flexShrink: 1 },
  stack: { gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  big: { color: C.text, fontSize: 22, fontWeight: '800' },
  muted: { color: C.text, opacity: 0.65, fontSize: 14, lineHeight: 20 },
  label: { color: C.text, opacity: 0.85, fontSize: 14 },
  strong: { fontWeight: '800', opacity: 1 },
  normal: { fontWeight: '400', opacity: 0.8 },
  gold: { color: C.gold, fontWeight: '800', opacity: 1 },
  small: { color: C.text, opacity: 0.6, fontSize: 13, lineHeight: 18 },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.barBg, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  emptyMedal: { borderWidth: 2, borderColor: C.panelBorder, borderStyle: 'dashed', backgroundColor: C.bg },
  levelBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.accentSoft,
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelN: { color: C.accent, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  list: { backgroundColor: C.bg, borderRadius: 12, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.rowBorder,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  itemLast: { borderBottomWidth: 0 },
  itemOn: { backgroundColor: C.accentSoft, borderLeftColor: C.accent },
  pressed: { opacity: 0.7 },
  itemText: { flex: 1, gap: 4 },
  itemName: { color: C.text, fontSize: 16, fontWeight: '700' },
  lockedT: { opacity: 0.55 },
  matT: { fontWeight: '600', opacity: 0.7, fontSize: 14 },
  onT: { color: C.accent, opacity: 1, fontWeight: '700' },
  check: { color: C.accent, fontSize: 20, fontWeight: '800' },
  dim: { opacity: 0.32 },
  preview: {
    width: THUMB_PX,
    height: THUMB_PX,
    borderRadius: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  note: { color: C.text, fontSize: 22, fontWeight: '800' },
  bgPreview: { borderRadius: 10 },
  swatches: { width: THUMB_PX, height: THUMB_PX, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  prize: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: C.panelBorder,
    borderRadius: 8,
  },
  prizeT: { color: C.text, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  mini: { width: MINI_PX, height: MINI_PX, overflow: 'hidden' },
  miniScaled: {
    position: 'absolute',
    width: THUMB_PX,
    height: THUMB_PX,
    left: (MINI_PX - THUMB_PX) / 2,
    top: (MINI_PX - THUMB_PX) / 2,
    transform: [{ scale: MINI_PX / THUMB_PX }],
  },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  cell: { width: '25%', alignItems: 'center', gap: 4 },
  caption: { color: C.text, opacity: 0.6, fontSize: 12, textAlign: 'center' },
  foot: { color: C.text, opacity: 0.45, fontSize: 12, textAlign: 'center' },
});
