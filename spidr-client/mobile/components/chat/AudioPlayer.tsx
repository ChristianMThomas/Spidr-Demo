import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Play, Pause, Volume2 } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

/**
 * Inline audio pill — mobile twin of VoiceMessageCapsule. One shared expo-audio
 * player per bubble; the status hook drives a lightweight progress bar. Player
 * loads lazily (source only set when user hits play) so a long DM thread with
 * dozens of voice notes doesn't preload every clip on mount.
 */
export function AudioPlayer({
  url,
  accent = '#dc2626',
  compact = false,
}: {
  url: string;
  accent?: string;
  compact?: boolean;
}) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    return () => {
      // Explicit release — expo-audio hangs on to the source otherwise, and
      // rapid unmount/remount (scrolling long chats) leaks native players.
      try { player?.remove?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const playing = status.playing;
  const durationSec = status.duration || 0;
  const positionSec = status.currentTime || 0;
  const pct = durationSec > 0 ? Math.min(100, (positionSec / durationSec) * 100) : 0;
  const loading = !status.isLoaded && !status.playing;

  const fmt = (s: number) => {
    if (!isFinite(s) || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const toggle = () => {
    if (playing) player.pause();
    else {
      // Rewind after finish so a second tap replays from the start.
      if (status.didJustFinish || positionSec >= durationSec) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: accent + '18',
        borderWidth: 1,
        borderColor: accent + '3D',
        marginTop: compact ? 0 : 6,
        minWidth: compact ? 180 : 220,
      }}
    >
      <TouchableOpacity
        onPress={toggle}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : playing ? (
          <Pause size={14} color="#fff" fill="#fff" />
        ) : (
          <Play size={14} color="#fff" fill="#fff" />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <Volume2 size={9} color={accent} />
          <Text style={{ color: accent, fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>VOICE</Text>
        </View>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <View style={{ height: 3, width: `${pct}%`, backgroundColor: accent }} />
        </View>
      </View>
      <Text style={{ color: '#a1a1aa', fontSize: 10, fontFamily: 'monospace' }}>
        {fmt(playing || positionSec > 0 ? positionSec : durationSec)}
      </Text>
    </View>
  );
}
