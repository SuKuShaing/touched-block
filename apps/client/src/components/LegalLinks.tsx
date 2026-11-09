import { StyleSheet, Text, View } from 'react-native';
import { type LegalPage, openLegal } from '@/lib/legal';
import { C } from '@/theme';

function LegalLink({ page, children, small }: { page: LegalPage; children: string; small?: boolean }) {
  return (
    <Text accessibilityRole="link" onPress={() => openLegal(page)} style={[styles.link, small && styles.small]} suppressHighlighting>
      {children}
    </Text>
  );
}

/** "Al entrar aceptas las Condiciones y la Política de privacidad" (junto a las opciones de login). */
export function LegalConsent() {
  return (
    <Text style={styles.consent}>
      Al entrar aceptas las <LegalLink page="condiciones-del-servicio">Condiciones</LegalLink> y la{' '}
      <LegalLink page="politica-de-privacidad">{'Política de privacidad'}</LegalLink>.
    </Text>
  );
}

/** Enlaces discretos a las dos páginas legales (al pie del Perfil). */
export function LegalLinks() {
  return (
    <View style={styles.row}>
      <LegalLink small page="condiciones-del-servicio">Condiciones del servicio</LegalLink>
      <Text style={styles.dot}>·</Text>
      <LegalLink small page="politica-de-privacidad">Política de privacidad</LegalLink>
    </View>
  );
}

const styles = StyleSheet.create({
  consent: { color: C.text, opacity: 0.6, fontSize: 12, lineHeight: 17, textAlign: 'center', maxWidth: 300 },
  link: { color: C.accent, textDecorationLine: 'underline' },
  small: { fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, opacity: 0.75 },
  dot: { color: C.text, opacity: 0.5, fontSize: 12 },
});
