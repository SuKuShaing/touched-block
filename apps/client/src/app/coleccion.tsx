import { Stack } from 'expo-router';
import { CollectionScreen } from '@/screens/CollectionScreen';

/** `/coleccion`: insignias, nivel, premios y logros (se abre desde el Perfil). Funciona también sin cuentas. */
export default function Coleccion() {
  return (
    <>
      <Stack.Screen options={{ title: 'Colección · Touched Block' }} />
      <CollectionScreen />
    </>
  );
}
