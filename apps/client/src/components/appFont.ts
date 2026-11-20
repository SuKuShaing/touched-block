/**
 * Tipografía de la app en Android: Roboto incluida en el APK (familia "Roboto", registrada por el
 * plugin expo-font en app.json). La fuente del sistema cambia según la marca del teléfono (en
 * Motorola, por ejemplo, no es Roboto) y la web usa Roboto (platform/webFont.web.ts), así que sin
 * esto el texto se veía distinto en cada celular. En la web no hace falta: la regla global de
 * webFont.css ya la aplica.
 *
 * Los <Text> y <TextInput> de src/ la reciben solos (platform/rnText.android.tsx, vía metro.config.js);
 * los Animated.Text de Reanimated no pasan por ahí y la incluyen en su estilo con este objeto.
 *
 * Este archivo (web e iOS) y `appFont.android.ts` no importan 'react-native' a propósito: el
 * sustituto de Android los importa y así no hay forma de que reciban el sustituto (ver
 * metro.config.js).
 */
export const APP_FONT_FAMILY = 'Roboto';
export const APP_FONT: { fontFamily?: string } = {};
