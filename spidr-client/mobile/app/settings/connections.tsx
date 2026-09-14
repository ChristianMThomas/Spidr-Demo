import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Linking, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Gamepad2, Twitch, ExternalLink, Unlink, Music } from 'lucide-react-native';
import api, { entities, spotify } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useThemeColors } from '../../lib/theme';
import { BASE_URL } from '../../lib/config';

// ── Connections (mobile) ─────────────────────────────────────────────────────
// Small-screen port of spidr-client/src/components/spidr/NeuralConfig.jsx.
// Spotify uses real OAuth (opens the server's /spotify/auth/start in the
// browser); Steam verifies a SteamID64 against the live /steam API before it
// counts as connected; Twitch has no backend yet so its card is inert
// (Apple 2.3.1 — no fake integrations in the binary).

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

  const saveLinks = async (updated: Record<string, any>) => {
    if (profileId) {
      await entities.UserProfile.update(profileId, { neural_links: updated });
    } else {
      await entities.UserProfile.create({ user_id: currentUser?.id, neural_links: updated });
    }
    queryClient.invalidateQueries({ queryKey: ['user-profile', currentUser?.id] });
  };

  // The browser hop carries no Authorization header, so identity used to ride
  // along as a bare ?userId= — which meant a link minted for someone else's id
  // would attach THEIR Spotify tokens to whoever's account was in the URL.
  // We now exchange the session for a short-lived signed link token first.
  const handleSpotifyConnect = async () => {
    try {
      const { token } = await api.get('/spotify/auth/link-token');
      if (!token) throw new Error('no link token');
      openHttps(`${BASE_URL}/spotify/auth/start?token=${encodeURIComponent(token)}`);
      // User completes OAuth in the browser; pull the new state when they return.
      setTimeout(() => refetch(), 4000);
    } catch {
      Alert.alert('Spotify', 'Could not start Spotify connect — try again.');
    }
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

        <SteamCard
          connected={!!neuralLinks.steam && !!neuralLinks.steam_id}
          steamId={neuralLinks.steam_id}
          onConnect={async (steamId: string) => {
            await saveLinks({ ...neuralLinks, steam: true, steam_id: steamId });
          }}
          onDisconnect={async () => {
            const { steam_id: _drop, ...rest } = neuralLinks;
            await saveLinks({ ...rest, steam: false });
          }}
        />

        <ComingSoonCard
          label="Twitch Live Feed"
          Icon={Twitch}
          description="Twitch integration isn't wired up yet. When it ships, you'll be able to show when you're live and let friends tune in from your profile."
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

// ── Steam — real connection: SteamID64 verified against the live Steam API ───
function SteamCard({
  connected, steamId, onConnect, onDisconnect,
}: {
  connected: boolean;
  steamId?: string;
  onConnect: (steamId: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const color = '#66c0f4';
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  const verifyAndSave = async () => {
    const id = input.trim();
    if (!/^\d{1,20}$/.test(id)) {
      Alert.alert('Invalid SteamID', 'Enter your numeric SteamID64 — find it at steamid.io.');
      return;
    }
    setVerifying(true);
    try {
      // Real check: the server hits Steam's API. Empty games list still counts
      // (private profiles return no data), but a 4xx/5xx means bad id or an
      // unconfigured server — surface that instead of faking "connected".
      await api.get('/steam/games', { params: { steamid: id } });
      await onConnect(id);
      setEditing(false);
      setInput('');
      Alert.alert('Steam linked', 'Your Steam library is now available to profile modules.');
    } catch (err: any) {
      Alert.alert(
        'Could not link Steam',
        err?.status === 503
          ? 'Steam integration is not configured on the server yet.'
          : err?.data?.error || err?.message || 'Check the SteamID and try again.',
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={{ backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: connected ? color + '22' : '#1a1a1a',
          }}
        >
          <Gamepad2 size={20} color={connected ? color : '#555'} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Steam Game Protocol</Text>
          <Text style={{ color: connected ? '#22c55e' : '#555', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, marginTop: 2 }}>
            {connected ? `LINKED · ${steamId}` : 'NO SIGNAL'}
          </Text>
        </View>
      </View>

      <Text style={{ color: '#52525b', fontSize: 11, lineHeight: 16 }}>
        {connected
          ? 'Your Steam library and playtime feed the Steam profile module.'
          : 'Link your SteamID64 to show library activity and playtime on your profile. Your Steam profile must be public.'}
      </Text>

      {connected ? (
        <TouchableOpacity
          onPress={() => onDisconnect().catch(() => Alert.alert('Failed to disconnect'))}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
          }}
        >
          <Unlink size={12} color="#f87171" />
          <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>DISCONNECT</Text>
        </TouchableOpacity>
      ) : editing ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="7656119…  (SteamID64 — steamid.io)"
            placeholderTextColor="#3f3f46"
            keyboardType="number-pad"
            style={{
              backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 10,
              color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: 'monospace',
            }}
          />
          <TouchableOpacity
            onPress={verifyAndSave}
            disabled={verifying || !input.trim()}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              paddingVertical: 10, borderRadius: 10, backgroundColor: color,
              opacity: verifying || !input.trim() ? 0.5 : 1,
            }}
          >
            {verifying && <ActivityIndicator size="small" color="#000" />}
            <Text style={{ color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>
              {verifying ? 'VERIFYING…' : 'VERIFY & LINK'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setEditing(true)}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            paddingVertical: 10, borderRadius: 10, backgroundColor: color,
          }}
        >
          <Text style={{ color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>CONNECT STEAM</Text>
          <ExternalLink size={12} color="#000" />
        </TouchableOpacity>
      )}

      {connected && <View style={{ height: 2, borderRadius: 1, backgroundColor: color }} />}
    </View>
  );
}

// ── Inert "Coming Soon" card — no fake toggle (Apple 2.3.1) ──────────────────
function ComingSoonCard({
  label, Icon, description, color,
}: { label: string; Icon: any; description: string; color: string }) {
  return (
    <View style={{ backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, gap: 12, opacity: 0.7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' }}>
          <Icon size={20} color="#555" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
          <Text style={{ color: color, fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, marginTop: 2 }}>
            COMING SOON
          </Text>
        </View>
      </View>
      <Text style={{ color: '#52525b', fontSize: 11, lineHeight: 16 }}>{description}</Text>
    </View>
  );
}
