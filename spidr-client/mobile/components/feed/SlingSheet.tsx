import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Send, X } from 'lucide-react-native';
import { entities, webMessages } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/EmptyState';

interface SlingSheetProps {
  visible: boolean;
  onClose: () => void;
  clip: any;
}

// "Sling to a friend" — sends a clip into the recipient's WEB SIGNALS inbox
// (a separate lane from real DMs, same as the web ShareWeb modal).
export function SlingSheet({ visible, onClose, clip }: SlingSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [sentTo, setSentTo] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['friends', user?.id],
    queryFn: () => entities.Friend.filter({ user_id: user!.id, status: 'accepted' }),
    enabled: visible && !!user?.id,
  });

  const friends: any[] = Array.isArray(data) ? data : [];

  // Empty query shows everyone. Friend rows predating name denormalization
  // have no friend_name — guard the string so they aren't silently dropped
  // (the "sling sheet looks empty" bug the web client hit).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends.filter((f) => !q || (f.friend_name || '').toLowerCase().includes(q));
  }, [friends, query]);

  const slingMutation = useMutation({
    mutationFn: ({ friendId }: { friendId: string; friendName: string }) =>
      webMessages.sling({
        recipient_id:  friendId,
        clip_id:       clip?.id || clip?._id,
        clip_title:    clip?.caption || '',
        clip_thumb:    clip?.thumbnail_url || '',
        sender_name:   user?.full_name || user?.username || '',
        sender_avatar: user?.avatar_url || '',
      }),
    onSuccess: (_res, { friendId }) => {
      setSentTo((prev) => [...prev, friendId]);
      queryClient.invalidateQueries({ queryKey: ['web-signals'] });
    },
    onError: (err: any, { friendName }) =>
      Alert.alert('Could not sling', `${friendName} — ${err?.message || 'try again in a moment.'}`),
  });

  const close = () => {
    setQuery('');
    setSentTo([]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity activeOpacity={1} onPress={close} style={{ flex: 1 }} />

        <View
          style={{
            height: '70%',
            backgroundColor: '#0a0a0a',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.25)',
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View
              style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 }}>
              🕸️ Sling to…
            </Text>
            <TouchableOpacity onPress={close} hitSlop={8}>
              <X size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              margin: 12,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <Search size={15} color="#71717a" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search friends"
              placeholderTextColor="#52525b"
              style={{ flex: 1, color: '#fff', fontSize: 14, padding: 0 }}
            />
          </View>

          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#ef4444" />
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={friends.length === 0 ? 'No linked nodes yet' : 'No friends match'}
              hint={
                friends.length === 0
                  ? 'Add friends to sling strands their way.'
                  : 'Try a different name.'
              }
            />
          ) : (
            <FlashList
              data={filtered}
              keyExtractor={(f: any) => String(f.friend_id || f.id)}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => {
                const sent = sentTo.includes(item.friend_id);
                const pending =
                  slingMutation.isPending && slingMutation.variables?.friendId === item.friend_id;
                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                    }}
                  >
                    <Avatar uri={item.friend_avatar} name={item.friend_name || 'Friend'} size={40} />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      {item.friend_name || 'Friend'}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        slingMutation.mutate({
                          friendId: item.friend_id,
                          friendName: item.friend_name || 'Friend',
                        })
                      }
                      disabled={sent || pending}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        backgroundColor: sent ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.9)',
                        opacity: pending ? 0.6 : 1,
                      }}
                    >
                      {pending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        !sent && <Send size={13} color="#fff" />
                      )}
                      <Text
                        style={{
                          color: sent ? '#22c55e' : '#fff',
                          fontSize: 12,
                          fontWeight: '900',
                        }}
                      >
                        {sent ? 'Sent' : 'Sling'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
