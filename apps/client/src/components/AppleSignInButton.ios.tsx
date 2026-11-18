import * as AppleAuthentication from 'expo-apple-authentication';
import { View } from 'react-native';
import type { AppleSignInButtonProps } from './AppleSignInButton';

/**
 * Botón oficial de Sign in with Apple (ASAuthorizationAppleIDButton, ya aprobado por Apple y
 * traducido por el sistema). Blanco porque el fondo de la app es oscuro (guía de Apple), con el
 * mismo tamaño y forma de píldora que el de Google.
 */
export function AppleSignInButton({ onPress, disabled, width, height }: AppleSignInButtonProps) {
  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.6 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={height / 2}
        style={{ width, height }}
        onPress={onPress}
      />
    </View>
  );
}
