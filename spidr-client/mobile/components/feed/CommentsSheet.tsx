import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Heart, Reply, Send } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { useAuth } from '../../lib/authContext';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/EmptyState';

interface CommentsSheetProps {
  clipId: string | null;
  onClose: () => void;
}

// Bottom-sheet comments for a single clip. Mirrors web RichComments' data
// shape: entities.Comment with { clip_id, user_id, content, likes, reply_to }.
// Display depth is capped at 1 (top-level → replies). Deeper replies still
// post but render at depth 1 so the UI stays readable on a phone.
export function CommentsSheet({ clipId, onClose }: CommentsSheetProps) {
  const visible = !!clipId;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['comments', clipId],
    queryFn: () =>
      entities.Comment.filter({ clip_id: clipId }, '-created_date', 200),
    enabled: visible && !!clipId,
  });

  const comments: any[] = Array.isArray(data) ? data : [];

  // Threading: top-level first (no reply_to), each followed by its replies
  // in chronological order. Single-pass O(n) bucket.
  const threaded = useMemo(() => {
    if (!comments.length) return [];
    const byParent: Record<string, any[]> = {};
    const tops: any[] = [];
    for (const c of comments) {
      const cid = c.id || c._id;
      if (c.reply_to) {
        (byParent[c.reply_to] ||= []).push({ ...c, _depth: 1 });
      } else {
        tops.push({ ...c, _depth: 0, _id: cid });
      }
    }
    // tops are newest-first; flip to oldest-first so the latest reply
    // appears at the bottom of the thread.
    tops.reverse();
    for (const arr of Object.values(byParent)) arr.reverse();
    const out: any[] = [];
    for (const top of tops) {
      out.push(top);
      const replies = byParent[top.id || top._id] || [];
      for (const r of replies) out.push(r);
    }
    return out;
  }, [comments]);

  const createMutation = useMutation({
    mutationFn: (payload: any) => entities.Comment.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', clipId] });
      setDraft('');
      setReplyingTo(null);
    },
    onError: () => Alert.alert('Could not post', 'Try again in a moment.'),
  });

  const likeMutation = useMutation({
    mutationFn: async (comment: any) => {
      const likes: string[] = comment.likes || [];
      const id = user?.id;
      const next = likes.includes(id!) ? likes.filter((x) => x !== id) : [...likes, id!];
      return entities.Comment.update(comment.id || comment._id, { likes: next });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', clipId] }),
  });

  const send = () => {
    const text = draft.trim();
    if (!text || !user?.id || !clipId) return;
    createMutation.mutate({
      clip_id: clipId,
      user_id: user.id,
      user_name: user.full_name || user.username,
      user_avatar: '',
      content: text,
      reply_to: replyingTo ? (replyingTo.id || replyingTo._id) : undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1 }} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={{
            height: '78%',
            backgroundColor: '#0a0a0a',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.25)',
          }}
        >
          {/* Grab handle */}
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            />
          </View>

          {/* Header */}
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
              {comments.length} comment{comments.length === 1 ? '' : 's'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#ef4444" />
            </View>
          ) : threaded.length === 0 ? (
            <EmptyState title="No comments yet" hint="Be the first to spin a strand." />
          ) : (
            <FlashList
              data={threaded}
              keyExtractor={(c: any) => String(c.id || c._id)}
              contentContainerStyle={{ paddingVertical: 6 }}
              renderItem={({ item }) => (
                <CommentRow
                  comment={item}
                  currentUserId={user?.id}
                  onLike={() => likeMutation.mutate(item)}
                  onReply={() => setReplyingTo(item)}
                />
              )}
              extraData={user?.id}
              onRefresh={refetch}
              refreshing={false}
            />
          )}

          {/* Reply preview */}
          {replyingTo && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 6,
                backgroundColor: 'rgba(239,68,68,0.08)',
                borderTopWidth: 1,
                borderTopColor: 'rgba(239,68,68,0.25)',
              }}
            >
              <Text style={{ color: '#a1a1aa', fontSize: 12, flex: 1 }} numberOfLines={1}>
                Replying to @{replyingTo.user_name || 'user'}
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={6}>
                <X size={14} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
          )}

          {/* Composer */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 10,
              paddingBottom: 18,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.06)',
              gap: 8,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: '#1a1a1a',
                borderRadius: 22,
                paddingHorizontal: 14,
                minHeight: 40,
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={replyingTo ? 'Write a reply…' : 'Add a comment…'}
                placeholderTextColor="#52525b"
                multiline
                style={{
                  color: '#fff',
                  fontSize: 14,
                  paddingVertical: 8,
                  maxHeight: 100,
                }}
              />
            </View>
            <TouchableOpacity
              onPress={send}
              disabled={!draft.trim() || createMutation.isPending}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: draft.trim() ? '#dc2626' : '#3f3f46',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Send size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CommentRow({
  comment,
  currentUserId,
  onLike,
  onReply,
}: {
  comment: any;
  currentUserId?: string;
  onLike: () => void;
  onReply: () => void;
}) {
  const liked = Array.isArray(comment.likes) && currentUserId
    ? comment.likes.includes(currentUserId)
    : false;
  const likeCount = comment.likes?.length || 0;
  const depth = comment._depth || 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginLeft: depth ? 36 : 0,
        gap: 10,
      }}
    >
      <Avatar uri={comment.user_avatar} name={comment.user_name || 'User'} size={depth ? 28 : 34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
          {comment.user_name || 'User'}
        </Text>
        <Text style={{ color: '#e4e4e7', fontSize: 14, lineHeight: 19, marginTop: 2 }}>
          {comment.content}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 14 }}>
          <TouchableOpacity onPress={onReply} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Reply size={12} color="#71717a" />
            <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '700' }}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity onPress={onLike} hitSlop={6} style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4 }}>
        <Heart size={16} color={liked ? '#ef4444' : '#71717a'} fill={liked ? '#ef4444' : 'transparent'} />
        {likeCount > 0 && (
          <Text style={{ color: liked ? '#ef4444' : '#71717a', fontSize: 10, fontWeight: '700', marginTop: 2 }}>
            {likeCount}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
