// Config plugin (Android): firma el build "release" con la clave de subida de Touched Block.
//
// La clave NUNCA va en el repo (es público). Gradle la busca así:
//   1. variables de entorno TB_UPLOAD_STORE_FILE, TB_UPLOAD_STORE_PASSWORD, TB_UPLOAD_KEY_ALIAS,
//      TB_UPLOAD_KEY_PASSWORD (p. ej. en CI), o
//   2. el archivo ~/.touched-block/keystore.properties (mismas claves), en la máquina del autor.
// Si no encuentra nada, el release queda firmado con la clave debug (solo sirve para probar).
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
    if (tb("TB_UPLOAD_STORE_FILE")) {
        signingConfigs {
            tbRelease {
                storeFile file(tb("TB_UPLOAD_STORE_FILE"))
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
    // bloque android { } propio al final: Gradle lo suma al del template (ya definió buildTypes)
    if (!s.includes(MARK)) s += SIGNING;
    cfg.modResults.contents = s;
    return cfg;
  });
};
