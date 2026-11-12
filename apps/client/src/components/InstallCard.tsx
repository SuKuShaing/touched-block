import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { registerVisit, visitCount } from '@/lib/onboarding';
import { updateSettings, useSettings } from '@/lib/settings';
import { install } from '@/platform/install';
import type { InstallState } from '@/platform/install.types';
import { C } from '@/theme';
import { Hint, SmallButton } from './form';
import { toast } from './Toast';

/** Desde qué visita se ofrece instalar en el inicio. */
export const INSTALL_FROM_VISIT = 2;

/** Estado de instalación de la web, se vuelve a dibujar al cambiar. */
export function useInstall(): InstallState {
  return useSyncExternalStore(install.subscribe, install.get, install.get);
}

const IOS_STEPS = 'En Safari, toca Compartir y después «Agregar a inicio».';

async function doPrompt() {
  const r = await install.prompt();
  if (r === 'accepted') toast('¡Listo! Touched Block quedó en tu pantalla de inicio');
}

/**
 * ¿Se ofrece instalar en el inicio? Desde la 2.ª visita, si no se descartó, no está instalada y
 * el navegador lo permite. (El inicio muestra como máximo una tarjeta: ver `homeCard` en `lib/daily.ts`.)
 */
export function useInstallOffer(): boolean {
  const st = useInstall();
  const { installDismissed } = useSettings();
  // registerVisit es idempotente: así la visita de esta carga ya está contada al leerla
  const [visits] = useState(() => {
    registerVisit();
    return visitCount();
  });
  return !(installDismissed || st.installed || st.kind === 'none' || visits < INSTALL_FROM_VISIT);
}

/**
 * Tarjeta del inicio para instalar la web (desde la 2.ª visita). Se puede descartar para
 * siempre; no aparece si ya está instalada o si el navegador no permite instalarla.
 */
export function InstallCard() {
  const st = useInstall();
  const offer = useInstallOffer();
  if (!offer) return null;
  const dismiss = () => updateSettings({ installDismissed: true });

  return (
    <View style={styles.card} accessibilityLabel="Instalar Touched Block">
      <Text style={styles.title}>Instala Touched Block</Text>
      <Text style={styles.body}>
        {st.kind === 'ios' ? `Juega a pantalla completa desde tu pantalla de inicio. ${IOS_STEPS}` : 'Juega a pantalla completa desde tu pantalla de inicio.'}
      </Text>
      <View style={styles.actions}>
        {st.kind === 'prompt' ? (
          <>
            <SmallButton title="Instalar" onPress={() => void doPrompt()} />
            <SmallButton title="No, gracias" kind="ghost" onPress={dismiss} />
          </>
        ) : (
          <SmallButton title="Entendido" kind="ghost" onPress={dismiss} />
        )}
      </View>
    </View>
  );
}

/** Fila fija del Perfil para instalar la web (o saber que ya está instalada). Nada en la app nativa. */
export function InstallRow() {
  const st = useInstall();
  if (st.installed) return <Hint>Touched Block está instalada en este dispositivo.</Hint>;
  if (st.kind === 'prompt') {
    return (
      <View style={styles.row}>
        <Text style={[styles.body, styles.flex1]}>Instálala para jugar a pantalla completa.</Text>
        <SmallButton title="Instalar" onPress={() => void doPrompt()} />
      </View>
    );
  }
  if (st.kind === 'ios') return <Hint>Para instalarla: {IOS_STEPS}</Hint>;
  return <Hint>Para instalarla en tu celular: en Chrome, menú ⋮ y «Instalar app»; en iPhone, en Safari, Compartir y «Agregar a inicio».</Hint>;
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.panel,
    borderWidth: 1,
    borderColor: C.panelBorder,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  title: { color: C.text, fontSize: 15, fontWeight: '800' },
  body: { color: C.text, opacity: 0.75, fontSize: 14, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  flex1: { flex: 1 },
});
