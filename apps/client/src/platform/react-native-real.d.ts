// 'react-native-real': el 'react-native' de verdad, para el sustituto de Android
// (rnText.android.tsx). Lo resuelve metro.config.js; aquí solo se le dan los mismos tipos.
declare module 'react-native-real' {
  export * from 'react-native';
}
