import { Platform } from 'react-native';

/**
 * Corazón de vidas y bloques ♥. En Android el ♥ suelto se dibuja como emoji a color (ignora el
 * color del texto: los corazones perdidos no se verían grises); el selector de variación U+FE0E
 * pide la versión de texto, como en la web. (Aparte de theme.ts para que los tests en Node no
 * importen react-native.)
 */
export const HEART = Platform.OS === 'web' ? '♥' : '\u2665\uFE0E';
