import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Hash, ArrowLeft, Users, Volume2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { entities } from '../../../lib/apiClient';
import { Avatar } from '../../../components/ui/Avatar';
import { Spinner } from '../../../components/ui/Spinner';

type Channel = { id?: string; _id?: string; name: string; type?: 'text' | 'voice' | string };

function CategoryHeader({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 14,
        marginBottom: 6,
        gap: 8,
      }}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#ef4444' }} />
      </View>
      <Text
        style={{
          color: 'rgba(8,145,178,0.85)',
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ChannelRow({
  name,
  icon,
  onPress,
}: {
  name: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
      }}
    >
      {/* Fixed-width icon slot so every channel name aligns at the same x */}
      <View style={{ width: 28, alignItems: 'flex-start' }}>{icon}</View>
      <Text
        style={{ color: '#e4e4e7', fontSize: 15, fontWeight: '600', flex: 1 }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

export default function ServerChannelList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: server } = useQuery({
    queryKey: ['server', id],
    queryFn: () => entities.Server.get(id!),
    enabled: !!id,
    staleTime: 30_000,
  });

  const { textChannels, voiceChannels } = useMemo(() => {
    const all: Channel[] = (server as any)?.channels || [];
    if (all.length === 0) {
      return {
        textChannels: [
          { id: 'general', name: 'general', type: 'text' as const },
          { id: 'random', name: 'random', type: 'text' as const },
        ],
        voiceChannels: [] as Channel[],
      };
    }
    return {
      textChannels: all.filter((c) => c.type !== 'voice'),
      voiceChannels: all.filter((c) => c.type === 'voice'),
    };
  }, [server]);

  if (!server) return <Spinner />;

  const memberCount = (server as any).members?.length || 0;
  const serverName = (server as any).name || 'Server';
  const bannerUrl = (server as any).banner_url as string | undefined;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#050505' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
          backgroundColor: 'rgba(5,5,5,0.95)',
          gap: 10,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <ArrowLeft size={20} color="#a1a1aa" />
        </TouchableOpacity>
        <Avatar uri={(server as any).icon_url} name={serverName} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
            {serverName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users size={11} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 11 }} numberOfLines={1}>
              {memberCount} member{memberCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Banner */}
        {bannerUrl ? (
          <View style={{ width: '100%', height: 120, overflow: 'hidden' }}>
            <Image
              source={{ uri: bannerUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* MAIN WEB — text channels */}
        {textChannels.length > 0 && (
          <>
            <CategoryHeader label="Main Web" />
            {textChannels.map((c) => (
              <ChannelRow
                key={String(c.id || c._id)}
                name={c.name}
                icon={<Hash size={18} color="#71717a" />}
                onPress={() => router.push(`/server/${id}/channel/${c.id || c._id}`)}
              />
            ))}
          </>
        )}

        {/* VOICE WEBS — voice channels (Phase 2 — needs custom dev client) */}
        {voiceChannels.length > 0 && (
          <>
            <CategoryHeader label="Voice Webs" />
            {voiceChannels.map((c) => (
              <ChannelRow
                key={String(c.id || c._id)}
                name={c.name}
                icon={<Volume2 size={18} color="#71717a" />}
                onPress={() =>
                  Alert.alert(
                    'Voice on mobile',
                    'Voice channels need the Phase 2 custom dev client (react-native-webrtc). Use the web client for now.'
                  )
                }
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
