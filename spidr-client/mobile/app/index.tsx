import { Redirect } from 'expo-router';
import { useAuth } from '../lib/authContext';

// Route straight to the right place instead of always landing on the tabs
// first: a logged-out user was briefly mounting the home feed (and whatever
// animations it kicks off on mount) before AuthGate corrected course to
// login a beat later — visible flicker with no splash screen up to hide it.
export default function Index() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return null;
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}
