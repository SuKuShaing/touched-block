// Web y Android: no hay Sign in with Apple (no se exige ahí). La versión iOS está en
// AppleSignInButton.ios.tsx (Metro elige el archivo según la plataforma).
export interface AppleSignInButtonProps {
  onPress: () => void;
  disabled: boolean;
  width: number;
  height: number;
}

export function AppleSignInButton(_: AppleSignInButtonProps) {
  return null;
}
