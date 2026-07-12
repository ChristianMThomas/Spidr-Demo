import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../lib/theme';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';

export default function Servers() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['servers'],
    queryFn: () => entities.Server.list('-created_date', 50),
  });

  // Match the web ServersPanel: show only servers the user actually owns
  // or has joined. Server.list() returns every server visible to the user
  // (including public ones the discovery feed surfaces), so without this
  // filter the list is full of servers they can't open.
  const myServers = useMemo(() => {
    const all: any[] = Array.isArray(data) ? data : [];
    if (!user?.id) return [];
    return all.filter((s) =>
      s.owner_id === user.id ||
      (Array.isArray(s.members) && s.members.some((m: any) => (m?.user_id || m?.id || m) === user.id))
    );
  }, [data, user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return myServers;
    return myServers.filter((s: any) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }, [myServers, search]);

  const colors = useThemeColors();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#1a1a1a',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <Search size={16} color="#71717a" />
          <TextInput
            placeholder="Search servers..."
            placeholderTextColor="#52525b"
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 8, marginLeft: 8 }}
          />
        </View>
      </View>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <EmptyState title="Couldn't load servers" hint="Pull to refresh." />
      ) : !filtered.length ? (
        <EmptyState
          title={search ? 'No matches' : 'No servers yet'}
          hint={search ? 'Try a different search.' : 'Join one from the web client to get started.'}
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(s: any) => String(s.id || s._id)}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#dc2626" />
          }
          contentContainerStyle={{ paddingBottom: 96 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/server/${item.id || item._id}`)}
              className="flex-row items-center px-4 py-3 border-b border-spidr-gray"
            >
              <Avatar uri={item.icon_url} name={item.name} size={48} />
              <View className="ml-3 flex-1">
                <Text className="text-white font-semibold">{item.name}</Text>
                <Text className="text-gray-400 text-xs" numberOfLines={1}>
                  {(item.members?.length || 0)} members{item.description ? ` · ${item.description}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
