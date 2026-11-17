// Autolinking (app nativa).
//
// @react-native-google-signin/google-signin: su código generado (codegen) se escribe en
// `android/build/gsi` (ver plugins/withShortCxxPath.js, que le cambia el buildDir) porque
// dentro de node_modules/.pnpm su ruta pasa de 260 caracteres y en Windows no compila.
// Aquí se le indica al autolinking dónde quedó su CMakeLists (la ruta es relativa a la
// carpeta android de la librería).
const fs = require('fs');
const path = require('path');

function gsiCmakeLists() {
  try {
    const pkg = fs.realpathSync(path.dirname(require.resolve('@react-native-google-signin/google-signin/package.json')));
    const target = path.join(__dirname, 'android', 'build', 'gsi', 'generated', 'source', 'codegen', 'jni', 'CMakeLists.txt');
    return path.relative(path.join(pkg, 'android'), target);
  } catch {
    return undefined;
  }
}

module.exports = {
  dependencies: {
    '@react-native-google-signin/google-signin': {
      platforms: { android: { cmakeListsPath: gsiCmakeLists() } },
    },
  },
};
