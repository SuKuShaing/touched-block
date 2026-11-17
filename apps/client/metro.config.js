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
// incluida en el APK (ver src/components/appFont.ts). Solo src/: las librerías y el propio
// sustituto siguen usando el 'react-native' real.
const srcDir = path.resolve(__dirname, 'src') + path.sep;
const rnTextShim = path.resolve(__dirname, 'src/platform/rnText.android.tsx');

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tb/engine') return { type: 'sourceFile', filePath: engineEntry };
  if (
    moduleName === 'react-native' &&
    platform === 'android' &&
    context.originModulePath.startsWith(srcDir) &&
    path.resolve(context.originModulePath) !== rnTextShim
  ) {
    return { type: 'sourceFile', filePath: rnTextShim };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
