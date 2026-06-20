import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Sparkles,
  Send,
  Bookmark,
  Volume2,
  VolumeX,
  MoreVertical,
  Check,
  Plus,
} from 'lucide-react-native';
import { Avatar } from '../ui/Avatar';

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
}

const phaseTwo = (label: string) =>
  Alert.alert('Phase 2 — Coming soon', `${label} on mobile lands in Phase 2.`);

interface ActionRailProps {
  authorAvatar?: string;
  authorName?: string;
  isFollowing: boolean;
  isOwnClip: boolean;
  onToggleFollow: () => void;
  onAvatarPress: () => void;

  liked: boolean;
  likesCount: number;
  onToggleLike: () => void;

  commentsCount: number;
  onOpenComments: () => void;

  sharesCount: number;

  muted: boolean;
  onToggleMute: () => void;

  onMore: () => void;
}

function RailButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  label?: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ alignItems: 'center', marginBottom: 18 }}
      hitSlop={6}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      {label !== undefined && (
        <Text
          style={{
            color: active ? '#ef4444' : '#fff',
            fontSize: 11,
            fontWeight: '800',
            marginTop: 4,
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowRadius: 4,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function ActionRail({
  authorAvatar,
  authorName,
  isFollowing,
  isOwnClip,
  onToggleFollow,
  onAvatarPress,
  liked,
  likesCount,
  onToggleLike,
  commentsCount,
  onOpenComments,
  sharesCount,
  muted,
  onToggleMute,
  onMore,
}: ActionRailProps) {
  return (
    <View
      style={{
        position: 'absolute',
        right: 8,
        bottom: 110,
        alignItems: 'center',
      }}
    >
      {/* Author avatar with follow chip overlapping the bottom edge */}
      <TouchableOpacity onPress={onAvatarPress} style={{ marginBottom: 22 }} activeOpacity={0.8}>
        <View
          style={{
            borderRadius: 24,
            borderWidth: 2,
            borderColor: '#ef4444',
            padding: 1,
          }}
        >
          <Avatar uri={authorAvatar} name={authorName || 'User'} size={44} />
        </View>
        {!isOwnClip && (
          <TouchableOpacity
            onPress={onToggleFollow}
            hitSlop={6}
            style={{
              position: 'absolute',
              bottom: -8,
              left: '50%',
              transform: [{ translateX: -10 }],
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: isFollowing ? '#22c55e' : '#ef4444',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#000',
            }}
          >
            {isFollowing ? <Check size={11} color="#fff" /> : <Plus size={11} color="#fff" />}
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <RailButton
        icon={<Heart size={26} color={liked ? '#ef4444' : '#fff'} fill={liked ? '#ef4444' : 'transparent'} />}
        label={formatCount(likesCount)}
        active={liked}
        onPress={onToggleLike}
      />

      <RailButton
        icon={<MessageCircle size={26} color="#fff" />}
        label={formatCount(commentsCount)}
        onPress={onOpenComments}
      />

      <RailButton
        icon={<Repeat2 size={26} color="#fff" />}
        label={formatCount(sharesCount)}
        onPress={() => phaseTwo('Signal Relay')}
      />

      <RailButton
        icon={<Sparkles size={24} color="#fff" />}
        onPress={() => phaseTwo('Emoji reactions')}
      />

      <RailButton
        icon={<Send size={24} color="#fff" />}
        onPress={() => phaseTwo('Sling to a friend')}
      />

      <RailButton
        icon={<Bookmark size={24} color="#fff" />}
        onPress={() => phaseTwo('Save to collection')}
      />

      <RailButton
        icon={muted ? <VolumeX size={22} color="#fff" /> : <Volume2 size={22} color="#fff" />}
        onPress={onToggleMute}
      />

      <RailButton
        icon={<MoreVertical size={22} color="#fff" />}
        onPress={onMore}
      />
    </View>
  );
}
