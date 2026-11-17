// Config plugin (Android): firma el build "release" con la clave de subida de Touched Block.
//
// La clave NUNCA va en el repo (es público). Gradle la busca así:
//   1. variables de entorno TB_UPLOAD_STORE_FILE, TB_UPLOAD_STORE_PASSWORD, TB_UPLOAD_KEY_ALIAS,
//      TB_UPLOAD_KEY_PASSWORD (p. ej. en CI), o
//   2. el archivo ~/.touched-block/keystore.properties (mismas claves), en la máquina del autor.
// Si no encuentra nada, el release queda firmado con la clave debug (solo sirve para probar) y
// Gradle lo avisa. Si faltan solo algunas claves o el keystore no existe, el build falla.
// La huella SHA-1 de la clave está registrada en Google Cloud (cliente OAuth "Android release
// APK"): si se cambia la clave, el login con Google deja de funcionar hasta registrar la nueva.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// tb: release-signing';
const SIGNING = `
${MARK}
android {
    def tbProps = new Properties()
    def tbPropsFile = new File(System.getProperty("user.home"), ".touched-block/keystore.properties")
    if (tbPropsFile.exists()) tbPropsFile.withInputStream { tbProps.load(it) }
    def tb = { String k -> System.getenv(k) ?: tbProps.getProperty(k) }
    def tbKeys = ["TB_UPLOAD_STORE_FILE", "TB_UPLOAD_STORE_PASSWORD", "TB_UPLOAD_KEY_ALIAS", "TB_UPLOAD_KEY_PASSWORD"]
    def tbMissing = tbKeys.findAll { !tb(it) }
    if (tbMissing.size() > 0 && tbMissing.size() < tbKeys.size()) {
        throw new GradleException("Firma de release incompleta: faltan \${tbMissing.join(', ')} (variables de entorno o ~/.touched-block/keystore.properties)")
    }
    def tbStore = tb("TB_UPLOAD_STORE_FILE") ? new File(tb("TB_UPLOAD_STORE_FILE")) : null
    // una ruta relativa se toma desde ~/.touched-block (donde vive keystore.properties)
    if (tbStore != null && !tbStore.isAbsolute()) tbStore = new File(tbPropsFile.parentFile, tb("TB_UPLOAD_STORE_FILE"))
    if (tbStore != null && !tbStore.exists()) {
        throw new GradleException("No existe el keystore de subida: \${tbStore}")
    }
    if (tbStore == null) {
        gradle.taskGraph.whenReady { graph ->
            if (graph.allTasks.any { it.name.toLowerCase().contains("release") }) {
                logger.warn("AVISO: sin la clave de subida de Touched Block; el release queda firmado con la clave DEBUG (solo para probar: no actualiza el APK repartido y el login con Google falla).")
            }
        }
    }
    if (tbStore != null) {
        signingConfigs {
            tbRelease {
                storeFile tbStore
                storePassword tb("TB_UPLOAD_STORE_PASSWORD")
                keyAlias tb("TB_UPLOAD_KEY_ALIAS")
                keyPassword tb("TB_UPLOAD_KEY_PASSWORD")
            }
        }
        buildTypes.release.signingConfig signingConfigs.tbRelease
    }
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let s = cfg.modResults.contents;
    // bloque android { } propio al final: Gradle lo suma al del template (ya definió buildTypes).
    // Si ya estaba (prebuild sin --clean), se reemplaza desde la marca para tomar cambios del bloque.
    const at = s.indexOf(MARK);
    if (at >= 0) s = s.slice(0, at).replace(/\n$/, '');
    s += SIGNING;
    cfg.modResults.contents = s;
    return cfg;
  });
};
