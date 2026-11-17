// Config plugin (Android): compila el C++ de cada librería nativa en `~/.tbcxx/<hash>/<hash>`
// (carpeta del usuario, ruta corta) en vez de dentro de su carpeta de node_modules.
//
// Por qué: con pnpm las librerías viven en rutas largas
// (node_modules/.pnpm/react-native-screens@4.30.1_<hash>/node_modules/react-native-screens/android/.cxx/...)
// y en Windows superan los 260 caracteres; el ninja del CMake del SDK no las abre y la
// compilación falla con "manifest 'build.ninja' still dirty after 100 tries".
// Además, los .o llevan la ruta completa de su fuente: CMAKE_OBJECT_PATH_MAX hace que CMake
// la reemplace por un hash cuando el nombre quedaría largo ("Filename longer than 260 characters").
// Va en settings.gradle (gradle.beforeProject) porque desde el build.gradle raíz es tarde:
// algunos subproyectos ya leyeron la propiedad.
const { withSettingsGradle } = require('expo/config-plugins');

const MARK = '// tb: short-cxx-path';
const SNIPPET = `
${MARK}
gradle.beforeProject { p ->
  // google-signin: su codegen C++ va a android/build/gsi (ruta corta); react-native.config.js
  // le indica al autolinking que su CMakeLists está ahí.
  if (p.projectDir.path.replace('\\\\', '/').endsWith('@react-native-google-signin/google-signin/android')) {
    p.layout.buildDirectory.set(new File(p.rootDir, "build/gsi"))
  }
  ['com.android.library', 'com.android.application'].each { id ->
    p.plugins.withId(id) {
      p.android.externalNativeBuild.cmake.buildStagingDirectory = new File(System.getProperty("user.home"), ".tbcxx/" + Integer.toHexString(p.rootDir.path.hashCode()) + "/" + Integer.toHexString(p.name.hashCode()))
      p.android.defaultConfig.externalNativeBuild.cmake.arguments("-DCMAKE_OBJECT_PATH_MAX=250")
    }
  }
}
`;

module.exports = function withShortCxxPath(config) {
  return withSettingsGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARK)) cfg.modResults.contents += SNIPPET;
    return cfg;
  });
};
