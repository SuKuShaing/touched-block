// Android: no hay Sign in with Apple (solo Google). La versión iOS está en AppleSignInButton.ios.tsx
// y la web en AppleSignInButton.web.tsx (Metro elige el archivo según la plataforma).
export interface AppleSignInButtonProps {
  onPress: () => void;
  disabled: boolean;
  width: number;
  height: number;
}

export function AppleSignInButton(_: AppleSignInButtonProps) {
  return null;
}
