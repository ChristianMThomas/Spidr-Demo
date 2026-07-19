import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ProfileView } from '../../components/profile/ProfileView';

// Stack route for viewing ANY user's profile card — opened by tapping a
// user's avatar anywhere in the app (activity feed, friends list, DM header,
// message bubbles). Same rich layout as the own-profile view, read-only.
export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={{ flex: 1, backgroundColor: '#050505' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Overlay back button — sits over the banner */}
      <SafeAreaView
        edges={['top']}
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} color="#fff" />
          </TouchableOpacity>
          <Text
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: '900',
              letterSpacing: 2,
              marginLeft: 10,
              textShadowColor: 'rgba(0,0,0,0.85)',
              textShadowRadius: 6,
            }}
          >
            PROFILE
          </Text>
        </View>
      </SafeAreaView>

      <ProfileView userId={String(id || '')} />
    </View>
  );
}
