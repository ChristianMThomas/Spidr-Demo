import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, MicOff, PhoneOff, Radio } from 'lucide-react-native';
import { emitter } from '../../lib/eventEmitter';
import { voiceRoom, VoiceRoomInfo } from '../../lib/voiceRoom';

// Persistent tether for a live voice web / group call. Backing out of the
// room screen leaves the mesh running (voice webs are places you stay in
// while you read other channels), so without this bar the call would be live
// with no way back to it — and no way to mute.
export default function ActiveVoiceBar() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState<VoiceRoomInfo | null>(voiceRoom.room);
  const [state, setState] = useState(voiceRoom.state);
  const [isMuted, setMuted] = useState(voiceRoom.isMuted);

  useEffect(() => {
    const offState = emitter.on('voice:room-state', (e: any) => {
      setState(e?.state ?? 'idle');
      setRoom(e?.room ?? null);
      setMuted(voiceRoom.isMuted);
    });
    const offControls = emitter.on('voice:room-controls', (c: any) => setMuted(!!c?.isMuted));
    return () => { offState(); offControls(); };
  }, []);

  // The room screen has its own controls — two sets of them stacked is noise.
  const onRoomScreen = segments[0] === 'voice';
  if (state === 'idle' || !room || onRoomScreen) return null;

  const open = () =>
    router.push(
      `/voice/${room.channelId}?serverId=${encodeURIComponent(room.serverId)}` +
      `&name=${encodeURIComponent(room.name)}&kind=${room.kind}`
    );

  return (
    <View
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: insets.bottom + 74, // clears the tab bar on the tab routes
        zIndex: 80,
      }}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        onPress={open}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderRadius: 14,
          backgroundColor: 'rgba(6,20,12,0.96)',
          borderWidth: 1,
          borderColor: 'rgba(34,197,94,0.45)',
        }}
      >
        <Radio size={16} color="#22c55e" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#22c55e', fontSize: 8, fontFamily: 'monospace', letterSpacing: 2, fontWeight: '900' }}>
            /// {state === 'connected' ? 'VOICE LIVE' : 'CONNECTING'}
          </Text>
          <Text style={{ color: '#e4e4e7', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
            {room.name}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => { voiceRoom.toggleMute(); setMuted(voiceRoom.isMuted); }}
          hitSlop={8}
          style={{
            width: 34, height: 34, borderRadius: 17,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: isMuted ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.1)',
          }}
        >
          {isMuted ? <MicOff size={15} color="#fff" /> : <Mic size={15} color="#fff" />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => voiceRoom.leave()}
          hitSlop={8}
          style={{
            width: 34, height: 34, borderRadius: 17,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#dc2626',
          }}
        >
          <PhoneOff size={15} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}
