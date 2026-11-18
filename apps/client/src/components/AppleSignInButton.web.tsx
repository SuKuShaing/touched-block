import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppleSignInButtonProps } from './AppleSignInButton';

// Logo de Apple (glifo de la manzana, viewBox 24×24).
const APPLE_LOGO =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';

/**
 * Web: botón de Sign in with Apple con el estilo oficial (guía de interfaz de Apple): fondo blanco
 * sobre la página oscura, logo y texto negros, "Iniciar sesión con Apple". Mismo tamaño y forma de
 * píldora que el botón de Google (280×40). Se dibuja aquí (y no con el botón que genera
 * appleid.auth.js) para no esperar al script y abrir la ventana de Apple directo desde el toque.
 */
export function AppleSignInButton({ onPress, disabled, width, height }: AppleSignInButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Iniciar sesión con Apple"
      style={({ pressed }) => [
        styles.btn,
        { width, height, borderRadius: height / 2 },
        (pressed || disabled) && { opacity: disabled ? 0.6 : 0.85 },
      ]}
    >
      <View style={styles.logoBox}>
        <svg width={17} height={17} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d={APPLE_LOGO} fill="#000" />
        </svg>
      </View>
      <Text style={styles.text} numberOfLines={1}>
        Iniciar sesión con Apple
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // como el de Google (GoogleButton / gNative en LoginOptions): logo a la izquierda, texto centrado
  btn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 3,
    paddingRight: 12,
  },
  logoBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  text: {
    flex: 1,
    textAlign: 'center',
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 22,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
});
