import { StyleSheet, Text, View } from 'react-native';
import { type LegalPage, openExternal, openLegal } from '@/lib/legal';
import { C } from '@/theme';

function LegalLink({ page, children, small }: { page: LegalPage; children: string; small?: boolean }) {
  return (
    <Text accessibilityRole="link" onPress={() => openLegal(page)} style={[styles.link, small && styles.small]} suppressHighlighting>
      {children}
    </Text>
  );
}

/** "Al entrar aceptas las Condiciones y la Política de privacidad" y la confirmación de edad para crear cuenta (13+; en Chile, bajo 14 con autorización), junto a las opciones de login. */
export function LegalConsent() {
  return (
    <Text style={styles.consent}>
      Al entrar aceptas las <LegalLink page="terminos">Condiciones</LegalLink> y la{' '}
      <LegalLink page="privacidad">{'Política de privacidad'}</LegalLink>. Al crear una cuenta confirmas tener 13 años o más (en Chile, si tienes menos de 14, con
      autorización de tu madre, padre o tutor).
    </Text>
  );
}

/** Pie del Perfil: enlaces discretos a las dos páginas legales y los créditos (los mismos que el pie de la landing). */
export function LegalLinks() {
  return (
    <View style={styles.foot}>
      <View style={styles.row}>
        <LegalLink small page="terminos">Condiciones del servicio</LegalLink>
        <Text style={styles.dot}>·</Text>
        <LegalLink small page="privacidad">Política de privacidad</LegalLink>
      </View>
      <View style={styles.credits}>
        <Text style={styles.creditLine}>Idea del juego: José Pinilla</Text>
        <Text style={styles.creditLine}>
          Desarrollo del juego y la web:{' '}
          <Text accessibilityRole="link" onPress={() => openExternal(CREDITS_URL)} style={styles.creditLink} suppressHighlighting>
            Sebastián Sanhueza
          </Text>
        </Text>
      </View>
    </View>
  );
}

const CREDITS_URL = 'https://sanhueza.pro';

const styles = StyleSheet.create({
  consent: { color: C.text, opacity: 0.6, fontSize: 12, lineHeight: 17, textAlign: 'center', maxWidth: 300 },
  link: { color: C.accent, textDecorationLine: 'underline' },
  small: { fontSize: 13 },
  foot: { alignItems: 'center', gap: 10 },
  credits: { alignItems: 'center', gap: 2, opacity: 0.6 },
  creditLine: { color: C.text, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  creditLink: { color: C.text, textDecorationLine: 'underline' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, opacity: 0.75 },
  dot: { color: C.text, opacity: 0.5, fontSize: 12 },
});
