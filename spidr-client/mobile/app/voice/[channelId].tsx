import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Easing, StatusBar } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, MicOff, Volume2, VolumeX, Headphones, HeadphoneOff, PhoneOff, ChevronDown, Music } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { getSocket } from '../../lib/socket';
import { useAppShell } from '../../lib/appShellContext';
import { emitter } from '../../lib/eventEmitter';
import { voiceRoom, VoiceRoomKind } from '../../lib/voiceRoom';
import { callsSupported } from '../../lib/nativeCalls';
import { Avatar } from '../../components/ui/Avatar';
import DJBooth from '../../components/call/DJBooth';

// Voice web / group-call room. The mesh itself lives in lib/voiceRoom so
// backing out of this screen doesn't hang up — ActiveVoiceBar keeps the
// session reachable from anywhere in the app.

export default function VoiceRoomScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentUser: user } = useAppShell();
  const params = useLocalSearchParams<{
    channelId: string;
    serverId?: string;
    name?: string;
    kind?: string;
  }>();

  const channelId = String(params.channelId || '');
  const serverId = String(params.serverId || '');
  const kind: VoiceRoomKind = params.kind === 'group' ? 'group' : 'server';
  const roomName = params.name || (kind === 'group' ? 'Group Call' : 'Voice Web');

  const [state, setState] = useState(voiceRoom.state);
  const [isMuted, setMuted] = useState(voiceRoom.isMuted);
  const [isSpeaker, setSpeaker] = useState(voiceRoom.isSpeaker);
  const [isDeafened, setDeafened] = useState(voiceRoom.isDeafened);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [deckOpen, setDeckOpen] = useState(true);

  const supported = callsSupported();
  const pulse = useRef(new Animated.Value(0.97)).current;

  // ── Presence (the same VoiceSession rows web reads) ───────────────────────
  const { data: sessions = [] } = useQuery({
    queryKey: ['voiceSessions', serverId, channelId],
    queryFn: () => entities.VoiceSession.filter({ server_id: serverId, channel_id: channelId }),
    enabled: !!serverId && !!channelId,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      const socket = await getSocket();
      const refresh = () =>
        queryClient.invalidateQueries({ queryKey: ['voiceSessions', serverId, channelId] });
      socket.on('voice:session-changed', refresh);
      socket.on('voice:peer-joined', refresh);
      socket.on('voice:peer-left', refresh);
      cleanup = () => {
        socket.off('voice:session-changed', refresh);
        socket.off('voice:peer-joined', refresh);
        socket.off('voice:peer-left', refresh);
      };
    })();
    return () => cleanup?.();
  }, [serverId, channelId, queryClient]);

  // ── Join on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!serverId || !channelId || !user?.id) return;
    voiceRoom
      .join({ serverId, channelId, kind, name: roomName }, user)
      .then((ok) => {
        if (ok) queryClient.invalidateQueries({ queryKey: ['voiceSessions', serverId, channelId] });
      });
    // Intentionally not leaving on unmount — the room outlives this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, channelId, user?.id]);

  // ── Manager events ────────────────────────────────────────────────────────
  useEffect(() => {
    const offState = emitter.on('voice:room-state', (e: any) => {
      setState(e?.state ?? 'idle');
      if (e?.state === 'idle') router.back();
    });
    const offControls = emitter.on('voice:room-controls', (c: any) => {
      setMuted(!!c?.isMuted);
      setSpeaker(!!c?.isSpeaker);
      setDeafened(!!c?.isDeafened);
    });
    const offErr = emitter.on('voice:room-error', (e: any) => setError(e?.message || 'Could not connect'));
    const offUnsupported = emitter.on('voice:room-unsupported', () =>
      setError('Voice needs the Spidr dev build — react-native-webrtc is not in Expo Go.')
    );
    return () => { offState(); offControls(); offErr(); offUnsupported(); };
  }, [router]);

  // Elapsed timer starts once the mesh is actually live.
  useEffect(() => {
    if (state !== 'connected') return;
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.97, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const occupants = useMemo(() => {
    const rows = (sessions as any[]) || [];
    // The presence write is async; show yourself the moment audio is live so
    // the room never looks empty while you're plainly in it.
    if (state === 'connected' && user?.id && !rows.some((s) => s.user_id === user.id)) {
      return [
        ...rows,
        {
          id: 'self-optimistic',
          user_id: user.id,
          user_name: user.full_name || user.username,
          user_avatar: user.avatar_url,
          is_muted: isMuted,
        },
      ];
    }
    return rows;
  }, [sessions, state, user, isMuted]);

  const hangUp = async () => {
    await voiceRoom.leave();
    queryClient.invalidateQueries({ queryKey: ['voiceSessions', serverId, channelId] });
    router.back();
  };

  const statusLine =
    error ? 'DISCONNECTED'
    : state === 'connected' ? `CONNECTED — ${formatElapsed(elapsed)}`
    : 'CONNECTING';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#050505' }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
            <ChevronDown size={22} color="#a1a1aa" />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }} numberOfLines={1}>
              {roomName}
            </Text>
            <Text style={{ color: error ? '#ef4444' : '#22c55e', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, fontWeight: '800' }}>
              /// {statusLine}
            </Text>
          </View>
          <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '800' }}>
            {occupants.length} {occupants.length === 1 ? 'NODE' : 'NODES'}
          </Text>
        </View>

        {error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
            <Text style={{ color: '#ef4444', fontSize: 10, fontFamily: 'monospace', letterSpacing: 3, fontWeight: '900' }}>
              /// VOICE UNAVAILABLE
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>{error}</Text>
            {!supported ? (
              <Text style={{ color: '#52525b', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                Build it once with{'\n'}
                <Text style={{ color: '#a1a1aa', fontFamily: 'monospace' }}>eas build --profile development</Text>
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}
            >
              <Text style={{ color: '#e4e4e7', fontSize: 13, fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1, minHeight: 0 }}>
            <ScrollView horizontal accessibilityLabel="Voice participants" style={{ flexGrow: 0, flexShrink: 0, height: 148 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
              {occupants.map((s: any) => {
                const isSelf = s.user_id === user?.id;
                const muted = isSelf ? isMuted : !!s.is_muted;
                return (
                  <Animated.View
                    key={String(s.id || s.user_id)}
                    style={{
                      width: 124,
                      aspectRatio: 1,
                      borderRadius: 8,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: muted ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.45)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transform: isSelf ? [{ scale: pulse }] : undefined,
                    }}
                  >
                    <Avatar uri={s.user_avatar} name={s.user_name || 'Node'} size={52} />
                    <Text style={{ color: '#e4e4e7', fontSize: 13, fontWeight: '800', maxWidth: '85%' }} numberOfLines={1}>
                      {isSelf ? 'You' : s.user_name || 'Node'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      {muted ? <MicOff size={13} color="#71717a" /> : <Mic size={13} color="#22c55e" />}
                      {s.is_deafened ? <HeadphoneOff size={13} color="#71717a" /> : null}
                    </View>
                  </Animated.View>
                );
              })}
            </ScrollView>

            {occupants.length === 0 ? (
              <Text style={{ color: '#52525b', fontSize: 13, textAlign: 'center', marginTop: 48 }}>
                Nobody here yet — you're first on the web.
              </Text>
            ) : null}
            {state === 'connected' && <>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={deckOpen ? 'Hide DJ deck' : 'Open DJ deck'} onPress={() => setDeckOpen(open => !open)} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 8, padding: 12 }}>
                <Music size={16} color="#f4f4f5" />
                <Text style={{ color: '#f4f4f5', fontSize: 12 }}>{deckOpen ? 'Hide DJ deck' : 'Open DJ deck'}</Text>
              </TouchableOpacity>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                {deckOpen && <DJBooth channelId={channelId} userId={user?.id || ''} />}
              </ScrollView>
            </>}
          </View>
        )}

        {/* Controls */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, paddingTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          <ControlButton
            label={isMuted ? 'Muted' : 'Mute'}
            active={isMuted}
            disabled={state !== 'connected'}
            onPress={() => { voiceRoom.toggleMute(); setMuted(voiceRoom.isMuted); setDeafened(voiceRoom.isDeafened); }}
            Icon={isMuted ? MicOff : Mic}
          />
          <ControlButton
            label={isDeafened ? 'Deaf' : 'Hear'}
            active={isDeafened}
            disabled={state !== 'connected'}
            onPress={() => { voiceRoom.toggleDeafen(); setDeafened(voiceRoom.isDeafened); setMuted(voiceRoom.isMuted); }}
            Icon={isDeafened ? HeadphoneOff : Headphones}
          />
          <ControlButton
            label={isSpeaker ? 'Speaker' : 'Earpiece'}
            active={isSpeaker}
            disabled={state !== 'connected'}
            onPress={() => { voiceRoom.toggleSpeaker(); setSpeaker(voiceRoom.isSpeaker); }}
            Icon={isSpeaker ? Volume2 : VolumeX}
          />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={hangUp}
              style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: '#dc2626',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PhoneOff size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>LEAVE</Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function ControlButton({
  label,
  active,
  disabled,
  onPress,
  Icon,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  Icon: any;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 6, opacity: disabled ? 0.4 : 1 }}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: active ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.12)',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1,
          borderColor: active ? 'rgba(239,68,68,1)' : 'rgba(255,255,255,0.18)',
        }}
      >
        <Icon size={21} color="#fff" />
      </TouchableOpacity>
      <Text style={{ color: '#a1a1aa', fontSize: 9, fontWeight: '700', letterSpacing: 1 }}>{label.toUpperCase()}</Text>
    </View>
  );
}
