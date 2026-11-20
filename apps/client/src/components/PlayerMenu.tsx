import { type ReactNode, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type PointerEvent,
  Modal,
  Platform,
  Pressable,
  type PressableProps,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { errorMessage, isApiError } from '@/api/client';
import { blockUser, reportUser, unblockUser } from '@/api/endpoints';
import { useApiFeatures, useBlocks, useInvalidate, useViewer } from '@/api/hooks';
import type { ReportReason } from '@/api/types';
import { features } from '@/config';
import { LONG_PRESS_MS, MODERATION_SOON, REPORT_DETAILS_MAX, REPORT_REASONS, REPORT_REVIEW_HOURS, moderationUnavailable, truncateChars } from '@/lib/moderation';
import { fx } from '@/platform/fx';
import { C } from '@/theme';
import { LoginOptions } from './LoginOptions';
import { toast } from './Toast';

/**
 * Menú de un jugador (guía 1.2 de Apple): "Reportar nombre" y "Bloquear jugador". No se ve por
 * defecto: en la web con mouse aparece un botón "⋯" al pasar por encima (`PlayerHoverArea`); con
 * el dedo (app y web táctil), con un toque sostenido de ~500 ms sobre el nombre. Solo aparece si la
 * API ya tiene moderación (`useApiFeatures`): la web se publica antes que la API.
 */

export interface PlayerRef {
  username: string;
  /** Si ya se sabe que lo bloqueaste (perfil público): se usa mientras carga la lista de bloqueados. */
  isBlocked?: boolean;
}

export interface PlayerMenu {
  /** La API tiene moderación y hay cuentas: se puede abrir el menú. */
  enabled: boolean;
  /** Se puede abrir para este jugador (no para uno mismo). */
  canOpen: (u: PlayerRef | null | undefined) => boolean;
  open: (u: PlayerRef) => void;
  /**
   * Props de toque sostenido para un Pressable: al cumplirse el tiempo vibra, y el menú se abre al
   * soltar (si se abriera durante el toque, al soltar el dedo el navegador "tocaría" el fondo del
   * menú recién abierto y lo cerraría).
   */
  longPress: (u: PlayerRef) => Partial<PressableProps>;
  /** Los modales: renderizar una vez en la pantalla. */
  node: ReactNode;
}

type Mode = 'menu' | 'login' | 'report' | 'block';

/** Estado y modales del menú de un jugador. */
export function usePlayerMenu(): PlayerMenu {
  const { moderation } = useApiFeatures();
  const viewer = useViewer();
  const enabled = features.accounts && moderation;
  const [target, setTarget] = useState<PlayerRef | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const blocks = useBlocks(enabled && mode !== null);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  // lo que eligió antes de tener que iniciar sesión (reportar o bloquear), para seguir con eso después
  const afterLogin = useRef<Mode | null>(null);

  const myName = viewer.user?.username?.toLowerCase();
  const canOpen = (u: PlayerRef | null | undefined) => enabled && !!u && u.username.toLowerCase() !== myName;
  // momento en que se abrió: los toques de los primeros ms son el mismo dedo que lo abrió
  const openedAt = useRef(0);
  const armed = useRef<PlayerRef | null>(null);
  const open = (u: PlayerRef) => {
    if (!canOpen(u)) return;
    armed.current = null;
    openedAt.current = Date.now();
    setTarget(u);
    setErr(null);
    setMode('menu');
  };
  const longPress = (u: PlayerRef): Partial<PressableProps> =>
    canOpen(u)
      ? {
          delayLongPress: LONG_PRESS_MS,
          onLongPress: () => {
            armed.current = u;
            fx.buzz(15);
          },
          onPressOut: () => {
            if (armed.current) open(armed.current);
          },
        }
      : {};
  /** Ignora el toque que llega justo al abrir (el mismo dedo al soltar). */
  const settled = () => Date.now() - openedAt.current > OPEN_GUARD_MS;
  const close = () => {
    if (busy || !settled()) return;
    afterLogin.current = null;
    setMode(null);
    setErr(null);
    setReason(null);
    setDetails('');
  };

  const name = target?.username ?? '';
  const lname = name.toLowerCase();
  const isBlocked = blocks.data ? blocks.data.users.some((b) => b.username.toLowerCase() === lname) : !!target?.isBlocked;
  // con sesión, mientras carga la lista no se sabe si ofrecer bloquear o desbloquear (salvo la pista del perfil)
  const blocksLoading = viewer.loggedIn && !blocks.data && !blocks.isError && target?.isBlocked === undefined;
  const needLogin = (next: Mode) => {
    if (viewer.loggedIn) return setMode(next);
    afterLogin.current = next;
    setMode('login');
  };
  /** Tras iniciar sesión dentro del menú: sigue con lo que eligió, salvo que haya entrado con la cuenta de ese jugador. */
  const onLoggedIn = (r: { user: { username: string } }) => {
    const next = afterLogin.current ?? 'menu';
    afterLogin.current = null;
    if (r.user.username.toLowerCase() === lname) {
      setMode(null);
      setErr(null);
      return;
    }
    // si cerró el menú mientras iniciaba sesión, no se vuelve a abrir solo
    setMode((m) => (m === 'login' ? next : m));
  };
  const refresh = () => invalidate('blocks', 'lb', 'dailyLb', 'following', 'profile', 'search', 'me');

  const fail = (e: unknown) => setErr(moderationUnavailable(e) ? MODERATION_SOON : errorMessage(e));

  const sendReport = async () => {
    if (!target || !reason) return;
    setBusy(true);
    setErr(null);
    try {
      await reportUser(target.username, reason, truncateChars(details, REPORT_DETAILS_MAX));
      setBusy(false);
      close();
      toast(`Gracias. Revisaremos el reporte dentro de ${REPORT_REVIEW_HOURS} horas.`);
    } catch (e) {
      setBusy(false);
      if (isApiError(e) && e.code === 'already_reported') {
        close();
        toast(e.message);
      } else fail(e);
    }
  };

  const doBlock = async () => {
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      await blockUser(target.username);
      setBusy(false);
      close();
      refresh();
      toast(`Bloqueaste a @${target.username}`);
    } catch (e) {
      setBusy(false);
      fail(e);
    }
  };

  const doUnblock = async () => {
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      await unblockUser(target.username);
      setBusy(false);
      close();
      refresh();
      toast(`Desbloqueaste a @${target.username}`);
    } catch (e) {
      setBusy(false);
      fail(e);
    }
  };

  const node = (
    <>
      <Modal visible={mode !== null} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cerrar" />
          <View style={styles.card} accessibilityViewIsModal>
            {mode === 'menu' ? (
              <>
                <Text style={styles.title} numberOfLines={1}>
                  @{name}
                </Text>
                <MenuItem label="Reportar nombre" disabled={busy} onPress={() => settled() && needLogin('report')} />
                {blocksLoading ? (
                  <MenuItem label="Bloquear jugador" busy onPress={() => {}} />
                ) : isBlocked ? (
                  <MenuItem label="Desbloquear jugador" onPress={() => settled() && void doUnblock()} busy={busy} />
                ) : (
                  <MenuItem label="Bloquear jugador" danger onPress={() => settled() && needLogin('block')} />
                )}
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <MenuItem label="Cancelar" muted disabled={busy} onPress={close} />
              </>
            ) : mode === 'login' ? (
              <>
                <Text style={styles.title}>Inicia sesión</Text>
                <Text style={styles.msg}>Para reportar o bloquear a @{name} necesitas una cuenta.</Text>
                <LoginOptions onLoggedIn={onLoggedIn} />
                <MenuItem label="Cancelar" muted onPress={close} />
              </>
            ) : mode === 'report' ? (
              <ScrollView contentContainerStyle={styles.reportBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.title} numberOfLines={1}>
                  Reportar a @{name}
                </Text>
                <Text style={styles.msg}>¿Qué pasa con este jugador?</Text>
                <View accessibilityRole="radiogroup" style={styles.reasons}>
                  {REPORT_REASONS.map((r) => {
                    const on = reason === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        onPress={() => setReason(r.value)}
                        style={({ pressed }) => [styles.reason, on && styles.reasonOn, pressed && styles.pressed]}
                      >
                        <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                        <Text style={styles.reasonT}>{r.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={details}
                  onChangeText={(t) => setDetails(truncateChars(t, REPORT_DETAILS_MAX))}
                  placeholder="Cuéntanos más (opcional)"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  multiline
                  maxLength={REPORT_DETAILS_MAX}
                  accessibilityLabel="Detalles del reporte (opcional)"
                  style={styles.details}
                />
                <Text style={styles.note}>
                  Revisamos cada reporte dentro de {REPORT_REVIEW_HOURS} horas. Si el nombre no cumple las reglas, lo cambiamos o
                  eliminamos la cuenta.
                </Text>
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={close}
                    disabled={busy}
                    style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]}
                  >
                    <Text style={styles.cancelT}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !reason || busy }}
                    onPress={() => void sendReport()}
                    disabled={!reason || busy}
                    style={({ pressed }) => [styles.btn, styles.ok, (!reason || busy) && styles.off, pressed && styles.pressed]}
                  >
                    <Text style={styles.okT}>{busy ? 'Enviando…' : 'Enviar reporte'}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : mode === 'block' ? (
              <>
                <Text style={styles.title} numberOfLines={2}>
                  ¿Bloquear a @{name}?
                </Text>
                <Text style={styles.msg}>
                  Dejarán de seguirse y @{name} no podrá seguirte ni ver tu perfil. No lo verás en tu ranking de Amigos ni en la
                  búsqueda. Puedes desbloquearlo desde tu perfil.
                </Text>
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={close}
                    disabled={busy}
                    style={({ pressed }) => [styles.btn, styles.cancel, pressed && styles.pressed]}
                  >
                    <Text style={styles.cancelT}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void doBlock()}
                    disabled={busy}
                    style={({ pressed }) => [styles.btn, styles.danger, (pressed || busy) && styles.pressed]}
                  >
                    <Text style={styles.dangerT}>{busy ? 'Un momento…' : 'Bloquear'}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );

  return { enabled, canOpen, open, longPress, node };
}

/** Tras abrir el menú, ignora toques durante este tiempo (el dedo que lo abrió). */
const OPEN_GUARD_MS = 350;

function MenuItem({
  label,
  onPress,
  danger,
  muted,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  muted?: boolean;
  busy?: boolean;
  /** Otra acción del menú está en curso. */
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(busy || disabled), busy: !!busy }}
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <Text style={[styles.itemT, danger && styles.itemDanger, muted && styles.itemMuted]}>{busy ? 'Un momento…' : label}</Text>
    </Pressable>
  );
}

/**
 * Lo que va en un Pressable que ya existe dentro de la zona (el enlace al perfil): el toque
 * sostenido abre el menú en vez del perfil, y los lectores de pantalla tienen la acción "Más opciones".
 */
export function playerLongPress(menu: PlayerMenu, u: PlayerRef | null | undefined): Partial<PressableProps> {
  if (!u || !menu.canOpen(u)) return {};
  return {
    ...menu.longPress(u),
    accessibilityActions: [{ name: 'longpress', label: 'Reportar o bloquear' }],
    onAccessibilityAction: (e) => {
      if (e.nativeEvent.actionName === 'longpress') menu.open(u);
    },
  };
}

// en la web, el toque sostenido no debe seleccionar texto ni abrir el menú del navegador
const noSelect = (Platform.OS === 'web' ? { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } : {}) as ViewStyle;

/**
 * Zona de un jugador (fila del ranking, cabecera del perfil): con el mouse encima muestra el
 * botón "⋯"; un toque sostenido abre el menú. Si el menú no está disponible, no hace nada.
 *
 * El hover se detecta con eventos de puntero en un View que envuelve todo (no con el hover de
 * Pressable: en react-native-web un Pressable anidado, como el enlace al perfil o el propio
 * "⋯", corta el hover del de afuera). Los toques (pointerType "touch") no cuentan como hover.
 */
export function PlayerHoverArea({
  menu,
  user,
  style,
  moreStyle,
  a11yLabel,
  children,
}: {
  menu: PlayerMenu;
  user: PlayerRef | null | undefined;
  style?: StyleProp<ViewStyle>;
  /** Posición del botón "⋯" (por defecto, a la derecha y centrado en la fila). */
  moreStyle?: StyleProp<ViewStyle>;
  /**
   * Cuando dentro no hay un enlace con `playerLongPress` (p. ej. la cabecera del perfil): la zona
   * misma lleva la acción "Reportar o bloquear" para lectores de pantalla y, en la web, al llegar
   * con el teclado (Tab) muestra el "⋯".
   */
  a11yLabel?: string;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const active = !!user && menu.canOpen(user);
  if (!active) return <View style={style}>{children}</View>;
  const openIt = (e?: GestureResponderEvent) => {
    e?.stopPropagation?.();
    setHover(false);
    menu.open(user);
  };
  const isMouse = (e: PointerEvent) => e.nativeEvent.pointerType !== 'touch';
  const hoverProps =
    Platform.OS === 'web'
      ? {
          onPointerEnter: (e: PointerEvent) => isMouse(e) && setHover(true),
          onPointerLeave: () => setHover(false),
        }
      : {};
  return (
    <View style={styles.wrap} {...hoverProps}>
      <Pressable
        accessible={!!a11yLabel}
        focusable={!!a11yLabel}
        style={[style, noSelect, styles.area]}
        {...menu.longPress(user)}
        {...(a11yLabel
          ? {
              accessibilityLabel: a11yLabel,
              accessibilityActions: [{ name: 'longpress', label: 'Reportar o bloquear' }],
              onAccessibilityAction: (e: AccessibilityActionEvent) => {
                if (e.nativeEvent.actionName === 'longpress') menu.open(user);
              },
              onFocus: () => Platform.OS === 'web' && setHover(true),
            }
          : {})}
      >
        {children}
      </Pressable>
      {hover ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Más opciones para ${user.username}`}
          onPress={openIt}
          hitSlop={6}
          style={({ hovered, pressed }) => [styles.more, moreStyle, (hovered || pressed) && styles.moreOn]}
        >
          <Text style={styles.moreT} selectable={false}>
            ⋯
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  area: Platform.OS === 'web' ? ({ cursor: 'auto' } as ViewStyle) : {},
  more: {
    position: 'absolute',
    right: 6,
    top: '50%',
    marginTop: -15,
    width: 34,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.barBg,
    borderWidth: 1,
    borderColor: C.panelBorder,
  },
  moreOn: { backgroundColor: C.panelBorder },
  moreT: { color: C.text, fontSize: 18, fontWeight: '800', lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '90%',
    backgroundColor: C.panel,
    borderRadius: 18,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: C.panelBorder,
  },
  reportBody: { gap: 10 },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  msg: { color: C.text, opacity: 0.8, fontSize: 15, lineHeight: 22 },
  note: { color: C.text, opacity: 0.6, fontSize: 12, lineHeight: 17 },
  err: { color: C.bad, fontSize: 14 },
  item: { paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.barBg },
  itemT: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  itemDanger: { color: C.bad },
  itemMuted: { opacity: 0.7, fontWeight: '600' },
  reasons: { gap: 8 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: C.barBg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  reasonT: { flex: 1, color: C.text, fontSize: 15 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: C.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
  details: {
    minHeight: 64,
    color: C.text,
    fontSize: 15,
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.panelBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancel: { backgroundColor: C.barBg },
  cancelT: { color: C.text, fontWeight: '700', fontSize: 15 },
  ok: { backgroundColor: C.accent },
  okT: { color: C.bg, fontWeight: '800', fontSize: 15 },
  danger: { backgroundColor: C.danger },
  dangerT: { color: C.text, fontWeight: '800', fontSize: 15 },
  off: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
