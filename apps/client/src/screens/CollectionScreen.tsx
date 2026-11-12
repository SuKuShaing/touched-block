import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACHIEVEMENTS,
  type Achievement,
  TICKS_PER_SECOND,
  TIERS,
  type TierId,
  achievementById,
  achievementGoal,
  achievementLevel,
  achievementMaterial,
  achievementNext,
  tierIndexOf,
} from '@tb/engine';
import { useMeRefresh, useViewer } from '@/api/hooks';
import type { Me } from '@/api/types';
import { FieldBackground } from '@/components/FieldBackground';
import { TierBadge } from '@/components/TierBadge';
import { features } from '@/config';
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
import { getPalette } from '@/cosmetics/palettes';
import { TIER_LOOK } from '@/cosmetics/tiers';
import { sounds } from '@/game/sounds';
import { useDailyLocal } from '@/lib/daily';
import { levelFor, xpOf } from '@/lib/level';
import { type Settings, updateSettings } from '@/lib/settings';
import { C } from '@/theme';

/**
 * La paleta Constancia y los logros del reto diario (fase 4) solo se muestran si se puede jugar
 * el reto: necesita la API (sin ella el juego queda en modo solo invitado y local).
 */
const SHOW_DAILY = features.accounts;

const fmtInt = fmtCount;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

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

function TierCard({ stats, me }: { stats: CatalogStats; me: Me | null }) {
  const idx = tierIndexOfStats(stats);
  const cur = idx >= 0 ? TIERS[idx] : null;
  const next = idx + 1 < TIERS.length ? TIERS[idx + 1] : null;
  const best = stats.bestTicks / TICKS_PER_SECOND;
  const from = cur ? cur.at : 0;
  const ratio = next ? (best - from) / Math.max(1, next.at - from) : 1;
  // con sesión, la insignia pública es la de la cuenta (las partidas de invitado sin guardar no cuentan)
  const serverIdx = me && me.tier !== undefined ? tierIndexOf(me.tier) : null;

  return (
    <Section title="Insignia">
      <View style={styles.head}>
        {cur ? <TierBadge tier={cur} size="lg" /> : <EmptyMedal size={64} />}
        <View style={styles.flex1}>
          <Text style={styles.big}>{cur ? cur.name : 'Sin insignia'}</Text>
          <Text style={styles.muted}>{cur ? `Tu partida más larga: ${fmtSeconds(best)}` : 'Termina una partida para ganar Madera I.'}</Text>
        </View>
      </View>
      {next && cur ? (
        <View style={styles.stack}>
          <View style={styles.inline}>
            <Text style={styles.label}>Siguiente:</Text>
            <TierBadge tier={next} size="sm" />
            <Text style={[styles.label, styles.strong, styles.shrink]}>
              {next.name} <Text style={styles.normal}>· {lowerFirst(tierGoal(next))}</Text>
            </Text>
          </View>
          <Bar ratio={ratio} color={TIER_LOOK[next.tier].face} />
          <Text style={styles.small}>Te faltaron {fmtSeconds(next.at - best)} en tu mejor partida.</Text>
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

// ---------------------------------------------------------------- nivel

function LevelCard({ stats }: { stats: CatalogStats }) {
  const lv = levelFor(xpOf(stats));
  const missing = lv.next - lv.xp;
  return (
    <Section title="Nivel">
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

function Preview({ item, locked }: { item: CatalogItem; locked: boolean }) {
  const dim = locked ? styles.dim : null;
  switch (item.type) {
    case 'palette': {
      const p = getPalette(item.id);
      return (
        <View style={[styles.swatches, dim]}>
          {p.colors.map((c, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: c }]}>
              {p.shine ? <View style={styles.swatchGleam} /> : null}
            </View>
          ))}
        </View>
      );
    }
    case 'sound':
      return (
        <View style={[styles.preview, styles.round, dim]}>
          <Text style={styles.note}>♪</Text>
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
          <FieldBackground id={item.id} cell={9} />
        </View>
      );
  }
}

/** Dibujo fijo de cada efecto al destruir. */
function EffectIcon({ id }: { id: string }) {
  const c = '#0091ff';
  const at = (x: number, y: number) => ({ left: 17 + x, top: 17 + y });
  if (id === 'corazones') {
    return (
      <>
        <Text style={[styles.heart, at(-13, -14), { fontSize: 13 }]}>♥</Text>
        <Text style={[styles.heart, at(1, -9), { fontSize: 16 }]}>♥</Text>
        <Text style={[styles.heart, at(-10, 1), { fontSize: 11 }]}>♥</Text>
      </>
    );
  }
  if (id === 'chispas') {
    return (
      <>
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const r = (deg * Math.PI) / 180;
          return (
            <View
              key={deg}
              style={[
                styles.spark,
                at(Math.cos(r) * 10 - 1.5, Math.sin(r) * 10 - 5),
                { backgroundColor: i % 2 ? '#fff3b0' : c, transform: [{ rotate: `${deg + 90}deg` }] },
              ]}
            />
          );
        })}
      </>
    );
  }
  if (id === 'confeti') {
    const cols = ['#e5484d', '#e5a50a', '#30a46c', '#0091ff', '#d6409f'];
    const pos: [number, number, number][] = [
      [-12, -12, 20],
      [4, -13, -30],
      [-3, -2, 60],
      [8, 2, 15],
      [-12, 4, -50],
    ];
    return (
      <>
        {pos.map(([x, y, rot], i) => (
          <View key={i} style={[styles.confetti, at(x, y), { backgroundColor: cols[i], transform: [{ rotate: `${rot}deg` }] }]} />
        ))}
      </>
    );
  }
  const pos: [number, number][] = [
    [-12, -10],
    [4, -12],
    [-4, 0],
    [6, 4],
    [-13, 6],
  ];
  return (
    <>
      {pos.map(([x, y], i) => (
        <View key={i} style={[styles.square, at(x, y), { backgroundColor: c, opacity: 1 - i * 0.12 }]} />
      ))}
    </>
  );
}

const TYPE_WORD: Record<CosmeticType, string> = { palette: 'Paleta', sound: 'Sonido', effect: 'Efecto', background: 'Fondo' };

function ItemRow({
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
}

function listed(item: CatalogItem): boolean {
  if (item.requires === 'daily') return SHOW_DAILY;
  if (item.requires === 'accounts') return features.accounts;
  return true;
}

// ---------------------------------------------------------------- logros

/**
 * Valor de cada logro. `stats` ya trae la mejor racha de días como el máximo entre la cuenta y
 * este dispositivo (`catalogStatsFor`). El mejor porcentaje del reto es el de la cuenta con
 * sesión (lo guarda el servidor al cerrar cada día); como invitado, el de este dispositivo
 * ("habrías quedado", 0 si ese día hubo menos de 10 jugadores; null si nunca jugó).
 */
function achievementValue(a: Achievement, stats: CatalogStats, me: Me | null, localDailyPct: number | null): number | null {
  switch (a.id) {
    case 'racha':
      return stats.bestStreak;
    case 'bloques':
      return stats.totalKilled;
    case 'diasReto':
      return stats.dailyStreakBest;
    case 'mejorReto':
      return me ? (me.stats?.bestDailyPct ?? null) : localDailyPct;
  }
}

function AchievementRow({ a, value, last }: { a: Achievement; value: number | null; last: boolean }) {
  const level = achievementLevel(a.id, value);
  const mat = achievementMaterial(level);
  const next = achievementNext(a.id, value);
  const th = achievementById(a.id).thresholds;
  const prev = level > 0 ? th[level - 1] : 0;
  const v = value ?? 0;
  const ratio = next === null ? 1 : (v - prev) / Math.max(1, next - prev);
  const pct = a.id === 'mejorReto';
  return (
    <View style={[styles.item, last && styles.itemLast]}>
      {mat ? (
        <TierBadge tier={{ tier: mat.toLowerCase() as TierId, step: 1 }} size="md" glyph={mat === 'Diamante' ? undefined : '★'} label={`Logro ${mat}`} />
      ) : (
        <View style={styles.medalBox}>
          <EmptyMedal size={32} />
        </View>
      )}
      <View style={styles.itemText}>
        <Text style={styles.itemName}>
          {a.name}
          {mat ? <Text style={styles.matT}> · {mat}</Text> : null}
        </Text>
        <Bar ratio={ratio} color={mat ? TIER_LOOK[mat.toLowerCase() as TierId].face : C.accent} />
        <Text style={styles.small}>
          {next === null
            ? '¡Nivel máximo!'
            : `${achievementGoal(a.id, level + 1)}${value !== null ? ` · llevas ${fmtInt(v)}${pct ? ' %' : ''}` : ''}`}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- pantalla

/**
 * `/coleccion`: insignia y la siguiente, nivel, premios por tipo (tocar uno desbloqueado lo
 * activa) y logros. Las estadísticas son las de este dispositivo y, con sesión, el máximo con
 * las del servidor (`cosmetics/active.ts`).
 */
export function CollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewer = useViewer();
  useMeRefresh(); // con sesión, trae las estadísticas del servidor al día
  const active = useActiveCosmetics();
  const stats = active.stats;
  const me = viewer.loggedIn ? viewer.user : null;
  const dailyLocal = useDailyLocal();

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const pick = (item: CatalogItem) => {
    const key = SETTING_KEY[item.type];
    const patch: Partial<Settings> = {};
    patch[key] = item.id;
    updateSettings(patch);
    if (item.type === 'sound') sounds.preview(item.id);
  };

  const achievements = ACHIEVEMENTS.filter((a) => SHOW_DAILY || (a.id !== 'diasReto' && a.id !== 'mejorReto'));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={10} onPress={back} style={styles.backBtn}>
          <Text style={styles.backT}>‹ Volver</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}>
        <Text style={styles.title} accessibilityRole="header">
          Colección
        </Text>
        <Text style={styles.intro}>Tus premios cambian cómo se ve y suena el juego, nunca las reglas.</Text>

        <TierCard stats={stats} me={me} />
        <LevelCard stats={stats} />

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

        <Section title="Logros">
          <View style={styles.list}>
            {achievements.map((a, i) => (
              <AchievementRow key={a.id} a={a} value={achievementValue(a, stats, me, dailyLocal.bestPct)} last={i === achievements.length - 1} />
            ))}
          </View>
        </Section>

        <Text style={styles.foot}>Lo que eliges se guarda en este dispositivo.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  top: { height: 52, justifyContent: 'center', paddingHorizontal: 12 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 6 },
  backT: { color: C.accent, fontSize: 17, fontWeight: '600' },
  content: { alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 4 },
  title: { color: C.text, fontSize: 28, fontWeight: '800' },
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
  preview: { width: 36, height: 36, borderRadius: 8, backgroundColor: C.panel, overflow: 'hidden' },
  round: { borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.barBg },
  note: { color: C.text, fontSize: 18, fontWeight: '800' },
  bgPreview: { borderWidth: 1, borderColor: C.panelBorder, backgroundColor: C.bg },
  swatches: { width: 36, height: 36, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  swatch: { width: 10.6, height: 10.6, borderRadius: 3, overflow: 'hidden' },
  swatchGleam: { position: 'absolute', top: 1.5, left: 1.5, width: 4, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.6)' },
  heart: { position: 'absolute', color: '#d6409f', fontWeight: '800' },
  spark: { position: 'absolute', width: 3, height: 10, borderRadius: 2 },
  confetti: { position: 'absolute', width: 5, height: 9, borderRadius: 1 },
  square: { position: 'absolute', width: 8, height: 8, borderRadius: 2.5 },
  medalBox: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  foot: { color: C.text, opacity: 0.45, fontSize: 12, textAlign: 'center' },
});
