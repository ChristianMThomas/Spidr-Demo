import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Edit3, Trash2, Pin, Check, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import EmojiPicker from './EmojiPicker';
import { renderEmojis, useGlobalEmojis } from './EmojiRenderer';

export default function MessageBubble({ message, currentUser, isOwner }) {
  const emojiMap = useGlobalEmojis();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.update(message.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages']);
      setIsEditing(false);
      toast.success('Message updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Message.delete(message.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages']);
    }
  });

  const handleEdit = () => {
    if (editContent.trim()) {
      updateMutation.mutate({ 
        content: editContent,
        edited_at: new Date().toISOString()
      });
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      deleteMutation.mutate();
    }, 500);
  };

  const handleWeb = () => {
    updateMutation.mutate({ 
      is_webbed: !message.is_webbed 
    });
    // Play web sound effect
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZOBAQPZXZ79V8NAY4kdfy');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  };

  const handleReaction = (emoji) => {
    const reactions = message.reactions || {};
    const userId = currentUser?.id;
    const emojiKey = emoji.type === 'custom' ? `:${emoji.name}:` : emoji.emoji;
    
    let newReactions = { ...reactions };
    if (newReactions[emojiKey]) {
      if (newReactions[emojiKey].includes(userId)) {
        newReactions[emojiKey] = newReactions[emojiKey].filter(id => id !== userId);
        if (newReactions[emojiKey].length === 0) delete newReactions[emojiKey];
      } else {
        newReactions[emojiKey].push(userId);
      }
    } else {
      newReactions[emojiKey] = [userId];
    }
    
    updateMutation.mutate({ reactions: newReactions });
  };

  const isMyMessage = message.author_id === currentUser?.id;
  const canModify = isMyMessage || isOwner;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1, x: 0 }}
        animate={isDeleting ? {
          opacity: 0,
          scale: 0.8,
          filter: 'blur(10px)',
          transition: { duration: 0.5 }
        } : { opacity: 1, x: 0 }}
        className={`group relative px-4 py-2 hover:bg-zinc-800/30 rounded-lg transition-colors ${
          message.is_webbed ? 'bg-red-950/10 border-l-2 border-red-500' : ''
        }`}
        onDoubleClick={() => canModify && !isEditing && setIsEditing(true)}
      >
        {/* Pixel Glitch Delete Animation */}
        {isDeleting && (
          <motion.div
            className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  background: Math.random() > 0.5 ? '#dc2626' : '#000'
                }}
                animate={{
                  x: (Math.random() - 0.5) * 100,
                  y: (Math.random() - 0.5) * 100,
                  opacity: 0
                }}
                transition={{ duration: 0.5 }}
              />
            ))}
          </motion.div>
        )}

        {/* Spiderweb Overlay for Webbed Messages */}
        {message.is_webbed && (
          <div className="absolute top-1 right-1 opacity-30 pointer-events-none">
            <svg width="40" height="40" viewBox="0 0 40 40" className="text-red-500">
              <path d="M20 5 L35 20 L20 35 L5 20 Z" fill="none" stroke="currentColor" strokeWidth="1" />
              <circle cx="20" cy="20" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
              <line x1="20" y1="5" x2="20" y2="12" stroke="currentColor" strokeWidth="1" />
              <line x1="35" y1="20" x2="28" y2="20" stroke="currentColor" strokeWidth="1" />
              <line x1="20" y1="35" x2="20" y2="28" stroke="currentColor" strokeWidth="1" />
              <line x1="5" y1="20" x2="12" y2="20" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
        )}

        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-red-900 flex items-center justify-center text-white font-bold flex-shrink-0">
            {message.author_avatar ? (
              <img src={message.author_avatar} alt={message.author_name} className="w-full h-full rounded-full object-cover" />
            ) : (
              message.author_name?.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Author & Timestamp */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white text-sm">{message.author_name}</span>
              <span className="text-xs text-zinc-500">
                {new Date(message.created_date).toLocaleTimeString()}
              </span>
              {message.edited_at && (
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Edit3 className="w-3 h-3 text-red-400" />
                  Re-woven
                </span>
              )}
            </div>

            {/* Content */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEdit();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                />
                <button onClick={handleEdit} className="p-1 hover:bg-zinc-700 rounded text-green-500">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-zinc-700 rounded text-zinc-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-zinc-300 text-sm break-words">{renderEmojis(message.content, emojiMap)}</p>
            )}

            {/* Reactions */}
            {message.reactions && Object.keys(message.reactions).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(message.reactions).map(([emoji, users]) => {
                  const isCustomEmoji = emoji.startsWith(':') && emoji.endsWith(':') && emojiMap[emoji];
                  return (
                    <motion.button
                      key={emoji}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleReaction({ emoji, type: isCustomEmoji ? 'custom' : 'unicode' })}
                      className={`px-2 py-0.5 rounded-full bg-zinc-800 border text-xs flex items-center gap-1 ${
                        users.includes(currentUser?.id) ? 'border-red-500 bg-red-950/30' : 'border-zinc-700'
                      }`}
                    >
                      {isCustomEmoji ? (
                        <img src={emojiMap[emoji].url} alt={emoji} className="w-4 h-4 object-contain" />
                      ) : (
                        <span>{emoji}</span>
                      )}
                      <span className="text-zinc-400">{users.length}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions Menu */}
          {canModify && !isEditing && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <EmojiPicker onEmojiSelect={handleReaction} currentUser={currentUser}>
                <button className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white">
                  😊
                </button>
              </EmojiPicker>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-zinc-800 border-zinc-700">
                  <DropdownMenuItem onClick={handleWeb} className="text-white hover:bg-zinc-700">
                    <Pin className="w-4 h-4 mr-2" />
                    {message.is_webbed ? 'Unweb' : 'Web Message'}
                  </DropdownMenuItem>
                  {isMyMessage && (
                    <DropdownMenuItem onClick={() => setIsEditing(true)} className="text-white hover:bg-zinc-700">
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canModify && (
                    <DropdownMenuItem onClick={handleDelete} className="text-red-500 hover:bg-zinc-700">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}