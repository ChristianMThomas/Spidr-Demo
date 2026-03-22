import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Reply, Image as ImageIcon, Loader2, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import EmojiPicker from './EmojiPicker';
import HolographicProfile from './HolographicProfile';

// Parse emoji syntax :emoji_name: -> <img> or emoji
const parseEmojis = (text, serverEmojis = []) => {
  const emojiRegex = /:(\w+):/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = emojiRegex.exec(text)) !== null) {
    // Add text before emoji
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    // Check if it's a custom emoji
    const emojiName = match[1];
    const customEmoji = serverEmojis.find(e => e.name === emojiName);
    
    if (customEmoji) {
      parts.push({ type: 'custom', content: customEmoji });
    } else {
      // Keep the original text if no match
      parts.push({ type: 'text', content: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts;
};

function CommentItem({ comment, clipId, currentUser, onReply, serverEmojis, level = 0 }) {
  const queryClient = useQueryClient();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const likes = comment.likes || [];
      const hasLiked = likes.includes(currentUser?.id);
      const newLikes = hasLiked 
        ? likes.filter(id => id !== currentUser?.id)
        : [...likes, currentUser?.id];
      return entities.Comment.update(comment.id, { likes: newLikes });
    },
    onSuccess: () => queryClient.invalidateQueries(['comments', clipId])
  });

  const hasLiked = comment.likes?.includes(currentUser?.id);
  const parsedContent = parseEmojis(comment.content, serverEmojis);

  return (
    <>
      <div className={`${level > 0 ? 'ml-8 mt-3' : 'mt-4'}`}>
        <div className="flex gap-3">
          <Avatar 
            className="w-8 h-8 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-red-500 transition-all"
            onClick={() => setShowProfile(true)}
          >
            {(comment.author_avatar || comment.user_avatar) ? (
              <AvatarImage src={comment.author_avatar || comment.user_avatar} />
            ) : (
              <AvatarFallback className="bg-red-900 text-white text-xs">
                {(comment.author_name || comment.user_name)?.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span 
                  className="font-semibold text-white text-sm hover:underline cursor-pointer"
                  onClick={() => setShowProfile(true)}
                >
                  {comment.author_name || comment.user_name}
                </span>
                <span className="text-xs text-zinc-500">
                  {new Date(comment.created_date).toLocaleDateString()}
                </span>
              </div>
            
            <div className="text-zinc-200 text-sm break-words">
              {parsedContent.map((part, idx) => 
                part.type === 'custom' ? (
                  <img 
                    key={idx}
                    src={part.content.url} 
                    alt={part.content.name}
                    className="inline-block w-5 h-5 mx-0.5 align-text-bottom"
                    title={`:${part.content.name}:`}
                  />
                ) : (
                  <span key={idx}>{part.content}</span>
                )
              )}
            </div>

            {/* Attached Media */}
            {comment.media_urls && comment.media_urls.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {comment.media_urls.map((url, idx) => (
                  <img 
                    key={idx}
                    src={url} 
                    alt="attachment"
                    className="rounded-lg max-h-40 object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2 text-xs">
            <button
              onClick={() => likeMutation.mutate()}
              className={`flex items-center gap-1 transition-colors ${
                hasLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'
              }`}
            >
              <Heart className="w-3.5 h-3.5" fill={hasLiked ? 'currentColor' : 'none'} />
              <span>{comment.likes?.length || 0}</span>
            </button>

            {level < 2 && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center gap-1 text-zinc-500 hover:text-white transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            )}
          </div>

          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                clipId={clipId}
                currentUser={currentUser}
                parentCommentId={comment.id}
                onSuccess={() => setShowReplyForm(false)}
                serverEmojis={serverEmojis}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </div>

    <HolographicProfile
      open={showProfile}
      onClose={() => setShowProfile(false)}
      userId={comment.author_id || comment.user_id}
      currentUser={currentUser}
    />
  </>
  );
}

function CommentForm({ clipId, currentUser, parentCommentId = null, onSuccess, serverEmojis, compact = false }) {
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const createCommentMutation = useMutation({
    mutationFn: async (commentData) => entities.Comment.create(commentData),
    onSuccess: async (newComment) => {
      // Update comment count on clip
      const clips = queryClient.getQueryData(['clips']) || [];
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        await entities.Clip.update(clipId, { 
          comments_count: (clip.comments_count || 0) + 1 
        });
      }
      
      queryClient.invalidateQueries(['comments', clipId]);
      queryClient.invalidateQueries(['clips']);
      setContent('');
      setMediaFiles([]);
      onSuccess?.();
      toast.success('Comment posted!');
    }
  });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      setMediaFiles([...mediaFiles, ...results.map(r => r.url)]);
    } catch (error) {
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!content.trim() && mediaFiles.length === 0) return;

    createCommentMutation.mutate({
      clip_id: clipId,
      content: content.trim(),
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || currentUser?.email,
      user_avatar: currentUser?.avatar_url || '',
      author_id: currentUser?.id,
      author_name: currentUser?.full_name || currentUser?.email,
      parent_comment_id: parentCommentId,
      media_urls: mediaFiles,
      likes: [],
    });
  };

  const handleEmojiSelect = (emojiData) => {
    if (emojiData.type === 'custom') {
      setContent(content + `:${emojiData.name}:`);
    } else {
      setContent(content + emojiData.emoji);
    }
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={parentCommentId ? "Write a reply..." : "Add a comment..."}
          className="bg-zinc-800 border-zinc-700 text-white resize-none pr-20"
          rows={compact ? 2 : 3}
        />
        
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <EmojiPicker onEmojiSelect={handleEmojiSelect} currentUser={currentUser} />
          
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif"
              multiple
              className="hidden"
              onChange={handleImageUpload}
            />
            <div className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
              <ImageIcon className="w-5 h-5 text-zinc-400" />
            </div>
          </label>
        </div>
      </div>

      {/* Image Previews */}
      {mediaFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {mediaFiles.map((url, idx) => (
            <div key={idx} className="relative group">
              <img src={url} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
              <button
                onClick={() => setMediaFiles(mediaFiles.filter((_, i) => i !== idx))}
                className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={(!content.trim() && mediaFiles.length === 0) || createCommentMutation.isPending || uploading}
        className="bg-red-600 hover:bg-red-700"
        size={compact ? "sm" : "default"}
      >
        {createCommentMutation.isPending || uploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {uploading ? 'Uploading...' : 'Posting...'}
          </>
        ) : (
          'Post Comment'
        )}
      </Button>
    </div>
  );
}

export default function RichComments({ clipId, currentUser }) {
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', clipId],
    queryFn: () => entities.Comment.filter({ clip_id: clipId }),
  });

  // Get server emojis for parsing
  const { data: servers = [] } = useQuery({
    queryKey: ['all-servers'],
    queryFn: () => entities.Server.list('-created_date', 100),
  });

  const allServerEmojis = servers.flatMap(s => s.emojis || []);

  // Organize comments into threads
  const rootComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (commentId) => 
    comments.filter(c => c.parent_comment_id === commentId);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-white font-semibold">Comments</h3>
      </div>

      <ScrollArea className="flex-1 px-4">
        {isLoading ? (
          <div className="text-center py-8 text-zinc-500">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <div className="pb-4">
            {rootComments.map(comment => (
              <div key={comment.id}>
                <CommentItem 
                  comment={comment} 
                  clipId={clipId}
                  currentUser={currentUser}
                  serverEmojis={allServerEmojis}
                  level={0}
                />
                
                {/* Nested Replies */}
                {getReplies(comment.id).map(reply => (
                  <div key={reply.id}>
                    <CommentItem 
                      comment={reply} 
                      clipId={clipId}
                      currentUser={currentUser}
                      serverEmojis={allServerEmojis}
                      level={1}
                    />
                    
                    {/* Second level replies */}
                    {getReplies(reply.id).map(reply2 => (
                      <CommentItem 
                        key={reply2.id}
                        comment={reply2} 
                        clipId={clipId}
                        currentUser={currentUser}
                        serverEmojis={allServerEmojis}
                        level={2}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-zinc-800">
        <CommentForm 
          clipId={clipId} 
          currentUser={currentUser}
          serverEmojis={allServerEmojis}
        />
      </div>
    </div>
  );
}