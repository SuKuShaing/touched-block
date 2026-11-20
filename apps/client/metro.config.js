// Metro para el monorepo pnpm. Expo (SDK 52+) configura solo watchFolders y node_modules
// del monorepo; aquí se agregan dos cosas: `@tb/engine` se resuelve SIEMPRE a su
// código fuente TypeScript (packages/engine/src), en web y en nativo. Así ni el
// desarrollo ni el build de CI necesitan compilar el motor antes (su `dist/` es para
// Node/la API). Metro web no usa el campo "react-native" del package.json del motor.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const engineEntry = path.resolve(__dirname, '../../packages/engine/src/index.ts');

// En Android, el código de src/ recibe un 'react-native' cuyo Text y TextInput usan la Roboto
// incluida en el APK (ver src/components/appFont.ts). Las librerías siguen con el real.
//
// El sustituto importa el real como 'react-native-real' y no como 'react-native'. Antes se
// excluía por ruta de archivo, pero Metro guarda la resolución de un nombre por CARPETA (no por
// archivo): según qué archivo de src/platform/ se resolvía primero, el sustituto podía recibirse
// a sí mismo y la app release se cerraba al abrir (APK 0.2.0 y 0.3.0; ver historia-y-decisiones).
// Con un nombre distinto la decisión ya no depende del archivo.
const srcDir = path.resolve(__dirname, 'src') + path.sep;
const rnTextShim = path.resolve(__dirname, 'src/platform/rnText.android.tsx');

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (moduleName === '@tb/engine') return { type: 'sourceFile', filePath: engineEntry };
  if (moduleName === 'react-native-real') return resolve(context, 'react-native', platform);
  if (moduleName === 'react-native' && platform === 'android' && context.originModulePath.startsWith(srcDir)) {
    return { type: 'sourceFile', filePath: rnTextShim };
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
