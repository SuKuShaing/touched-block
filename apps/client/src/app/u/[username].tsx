import { Redirect } from 'expo-router';
import { features } from '@/config';
import { PublicProfileScreen } from '@/screens/PublicProfileScreen';

export default function PublicProfile() {
  if (!features.accounts) return <Redirect href="/" />;
  return <PublicProfileScreen />;
}
