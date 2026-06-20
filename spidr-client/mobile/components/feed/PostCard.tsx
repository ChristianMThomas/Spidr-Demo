import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { Avatar } from '../ui/Avatar';
import { algorithm } from '../../lib/apiClient';
import { formatTimestamp } from '../../lib/utils';

interface Post {
  id: string;
  user_id?: string;
  user_name?: string;
  user_avatar?: string;
  caption?: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
  created_at?: string;
}

interface Props {
  post: Post;
  onPress?: () => void;
  onComment?: () => void;
}

export function PostCard({ post, onPress, onComment }: Props) {
  const [liked, setLiked] = useState(!!post.liked_by_me);
  const [likes, setLikes] = useState(post.likes_count ?? 0);

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    algorithm.trackEngagement({ post_id: post.id, type: next ? 'like' : 'unlike' });
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} className="bg-spidr-gray rounded-2xl mb-3 mx-3 overflow-hidden">
      <View className="flex-row items-center px-4 pt-3 pb-2">
        <Avatar uri={post.user_avatar} name={post.user_name} size={36} />
        <View className="ml-3 flex-1">
          <Text className="text-white font-semibold">{post.user_name || 'Unknown'}</Text>
          <Text className="text-gray-400 text-xs">{formatTimestamp(post.created_at)}</Text>
        </View>
      </View>

      {post.caption && <Text className="text-white px-4 pb-3">{post.caption}</Text>}

      {post.media_url && post.media_type !== 'video' && (
        <Image
          source={{ uri: post.media_url }}
          style={{ width: '100%', aspectRatio: 1, backgroundColor: '#0a0a0a' }}
          contentFit="cover"
          transition={200}
        />
      )}

      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={toggleLike} className="flex-row items-center mr-6">
          <Heart color={liked ? '#dc2626' : '#cbd5e1'} fill={liked ? '#dc2626' : 'transparent'} size={20} />
          <Text className="text-gray-200 ml-2">{likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onComment} className="flex-row items-center mr-6">
          <MessageCircle color="#cbd5e1" size={20} />
          <Text className="text-gray-200 ml-2">{post.comments_count ?? 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center">
          <Share2 color="#cbd5e1" size={20} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
