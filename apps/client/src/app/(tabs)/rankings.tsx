import { Redirect } from 'expo-router';
import { features } from '@/config';
import { RankingsScreen } from '@/screens/RankingsScreen';

export default function Rankings() {
  // Sin API no hay rankings: la ruta lleva al inicio.
  if (!features.accounts) return <Redirect href="/" />;
  return <RankingsScreen />;
}
