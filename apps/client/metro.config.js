// Metro para el monorepo pnpm. Expo (SDK 52+) configura solo watchFolders y node_modules
// del monorepo; aquí solo se agrega una cosa: `@tb/engine` se resuelve SIEMPRE a su
// código fuente TypeScript (packages/engine/src), en web y en nativo. Así ni el
// desarrollo ni el build de CI necesitan compilar el motor antes (su `dist/` es para
// Node/la API). Metro web no usa el campo "react-native" del package.json del motor.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const engineEntry = path.resolve(__dirname, '../../packages/engine/src/index.ts');

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tb/engine') return { type: 'sourceFile', filePath: engineEntry };
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
