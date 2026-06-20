import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const radius = size / 2;
  const initial = (name || '?').trim().slice(0, 1).toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#2a2a2a' }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  return (
    <View
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#dc2626' }}
      className="items-center justify-center"
    >
      <Text className="text-white font-bold" style={{ fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}
