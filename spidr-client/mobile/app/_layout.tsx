import 'react-native-gesture-handler';
import '../global.css';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { queryClient } from '../lib/queryClient';
import { AuthProvider, useAuth } from '../lib/authContext';
import { AppShellProvider } from '../lib/appShellContext';
import { UnreadProvider } from '../lib/unreadContext';
import IncomingCallModal from '../components/call/IncomingCallModal';
import ActiveVoiceBar from '../components/call/ActiveVoiceBar';
import PermissionPrimer from '../components/PermissionPrimer';
import ServerSignalBanner from '../components/ServerSignalBanner';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoadingAuth) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) router.replace('/(auth)/login');
    else if (isAuthenticated && inAuthGroup) router.replace('/(tabs)');
  }, [isAuthenticated, isLoadingAuth, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  // Non-blocking: the wordmark swaps to LeChaudronMagique once this resolves.
  // No splash screen right now — screens render immediately either way.
  useFonts({
    LeChaudronMagique: require('../assets/fonts/LeChaudronMagique.ttf'),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppShellProvider>
              <UnreadProvider>
                <AuthGate>
                  <StatusBar style="light" />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111111' } }} />
                  <IncomingCallModal />
                  <ActiveVoiceBar />
                  <ServerSignalBanner />
                  <PermissionPrimer />
                </AuthGate>
              </UnreadProvider>
            </AppShellProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
