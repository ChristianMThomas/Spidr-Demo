import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Music } from 'lucide-react-native';
import useNowPlaying from '../../hooks/useNowPlaying';

export function NowPlayingCard({ userId }: { userId?: string }) {
  const np = useNowPlaying(userId);

  if (!np || !np.is_playing) return null;

  const pct = np.duration_ms ? Math.min(100, Math.max(0, ((np.progress_ms || 0) / np.duration_ms) * 100)) : 0;

  return (
    <View className="bg-spidr-gray rounded-2xl p-4 mx-4 mt-4">
      <View className="flex-row items-center mb-3">
        <Music color="#1DB954" size={16} />
        <Text className="text-green-400 ml-2 text-xs font-semibold uppercase">Now Playing</Text>
      </View>
      <View className="flex-row items-center">
        {np.album_art_url ? (
          <Image source={{ uri: np.album_art_url }} style={{ width: 56, height: 56, borderRadius: 6, backgroundColor: '#2a2a2a' }} contentFit="cover" />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 6, backgroundColor: '#2a2a2a' }} />
        )}
        <View className="ml-3 flex-1">
          <Text className="text-white font-semibold" numberOfLines={1}>{np.track_name}</Text>
          <Text className="text-gray-400 text-sm" numberOfLines={1}>{np.artist}</Text>
        </View>
      </View>
      <View className="h-1 bg-spidr-gray-light rounded-full mt-3 overflow-hidden">
        <View className="h-1 bg-green-500" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}
