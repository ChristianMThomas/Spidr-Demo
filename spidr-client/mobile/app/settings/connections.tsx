import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Gamepad2, Twitch, Check, X, ExternalLink, Unlink, Music } from 'lucide-react-native';
import { entities, spotify } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useThemeColors } from '../../lib/theme';
import { BASE_URL } from '../../lib/config';

// ── Connections (mobile) ─────────────────────────────────────────────────────
// Small-screen port of spidr-client/src/components/spidr/NeuralConfig.jsx.
// Spotify uses real OAuth (opens the server's /spotify/auth/start in the
// browser); Steam and Twitch are simple neural_links booleans on UserProfile.

function openHttps(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;
    Linking.openURL(u.toString()).catch(() => Alert.alert('Could not open link'));
  } catch {
    Alert.alert('Invalid link');
  }
}

export default function Connections() {
  const router = useRouter();
  const { currentUser } = useAppShell();
  const queryClient = useQueryClient();
  const colors = useThemeColors();

  const { data: profile, refetch } = useQuery({
    queryKey: ['user-profile', currentUser?.id],
    queryFn: async () => {
      const res: any = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return res?.[0] ?? null;
    },
    enabled: !!currentUser?.id,
  });

  const profileId = profile?.id;
  const neuralLinks = profile?.neural_links || {};

  const toggleLink = async (key: string) => {
    const newVal = !neuralLinks[key];
    const updated = { ...neuralLinks, [key]: newVal };
    try {
      if (profileId) {
        await entities.UserProfile.update(profileId, { neural_links: updated });
      } else {
        await entities.UserProfile.create({ user_id: currentUser?.id, neural_links: updated });
      }
      queryClient.invalidateQueries({ queryKey: ['user-profile', currentUser?.id] });
    } catch {
      Alert.alert('Failed to update neural link');
    }
  };

  const handleSpotifyConnect = () => {
    openHttps(`${BASE_URL}/spotify/auth/start?userId=${currentUser?.id}`);
    // User completes OAuth in the browser; pull the new state when they return.
    setTimeout(() => refetch(), 4000);
  };

  const handleSpotifyDisconnect = async () => {
    try {
      await spotify.disconnect();
      queryClient.invalidateQueries({ queryKey: ['user-profile', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['spotify-now-playing', currentUser?.id] });
    } catch {
      Alert.alert('Failed to disconnect Spotify');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 1 }}>
            <Text style={{ color: '#FF3333' }}>/// </Text>NEURAL LINKS
          </Text>
          <Text style={{ color: '#71717a', fontSize: 11 }}>Jack external data streams into your Spidr profile.</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Spotify — real OAuth */}
        <SpotifyCard
          connected={!!neuralLinks.spotify_connected}
          onConnect={handleSpotifyConnect}
          onDisconnect={handleSpotifyDisconnect}
        />

        <ToggleCard
          label="Steam Game Protocol"
          Icon={Gamepad2}
          description="Link Steam to display your library activity and recently played games on your profile."
          connected={!!neuralLinks.steam}
          onToggle={() => toggleLink('steam')}
          color="#66c0f4"
        />

        <ToggleCard
          label="Twitch Live Feed"
          Icon={Twitch}
          description="Connect Twitch to show when you're live and let friends tune in directly from your profile."
          connected={!!neuralLinks.twitch}
          onToggle={() => toggleLink('twitch')}
          color="#9146FF"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Spotify OAuth card ───────────────────────────────────────────────────────
function SpotifyCard({
  connected, onConnect, onDisconnect,
}: { connected: boolean; onConnect: () => void; onDisconnect: () => void }) {
  return (
    <View style={{ backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: connected ? '#1DB954' : '#1a1a1a',
          }}
        >
          <Music size={24} color={connected ? '#fff' : '#555'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>Spotify</Text>
          <Text style={{ color: connected ? '#1DB954' : '#555', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, marginTop: 2 }}>
            {connected ? '● CONNECTED' : '○ NOT CONNECTED'}
          </Text>
        </View>
      </View>

      <Text style={{ color: '#71717a', fontSize: 11, lineHeight: 16 }}>
        {connected
          ? 'Your Spotify account is linked. The Now Playing module on your profile will show your current track in real time.'
          : 'Connect your Spotify account to display your currently playing track on your profile. Each person connects their own account — your data stays yours.'}
      </Text>

      {connected ? (
        <TouchableOpacity
          onPress={onDisconnect}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
          }}
        >
          <Unlink size={12} color="#f87171" />
          <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>DISCONNECT</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onConnect}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            paddingVertical: 10, borderRadius: 10, backgroundColor: '#1DB954',
          }}
        >
          <Text style={{ color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>CONNECT SPOTIFY</Text>
          <ExternalLink size={12} color="#000" />
        </TouchableOpacity>
      )}

      {connected && <View style={{ height: 2, borderRadius: 1, backgroundColor: '#1DB954' }} />}
    </View>
  );
}

// ── Simple boolean toggle card (Steam, Twitch) ───────────────────────────────
function ToggleCard({
  label, Icon, description, connected, onToggle, color,
}: { label: string; Icon: any; description: string; connected: boolean; onToggle: () => void; color: string }) {
  return (
    <View style={{ backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: connected ? color + '22' : '#1a1a1a',
            }}
          >
            <Icon size={20} color={connected ? color : '#555'} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
            <Text
              style={{ color: connected ? '#22c55e' : '#555', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, marginTop: 2 }}
            >
              {connected ? 'LINK ESTABLISHED' : 'NO SIGNAL'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onToggle}
          style={{
            width: 52, height: 30, borderRadius: 999, backgroundColor: '#0a0a0a',
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
              backgroundColor: connected ? color : '#333',
              marginLeft: connected ? 26 : 3,
            }}
          >
            {connected
              ? <Check size={11} strokeWidth={4} color="#fff" />
              : <X size={11} strokeWidth={4} color="#777" />}
          </View>
        </TouchableOpacity>
      </View>

      <Text style={{ color: '#52525b', fontSize: 11, lineHeight: 16 }}>{description}</Text>

      {connected && <View style={{ height: 2, borderRadius: 1, backgroundColor: color }} />}
    </View>
  );
}
