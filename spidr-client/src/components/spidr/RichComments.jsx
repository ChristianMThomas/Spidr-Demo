import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ContextableImage from '@/components/ui/ContextableImage';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Reply, Image as ImageIcon, Loader2, X, User, Film, Mic, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import HolographicProfile from './HolographicProfile';
import { buildUsernameStyle } from '@/lib/usernameStyle';
import { useMenu } from '@/components/MenuContext';

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

// Relative timestamp — "2h ago" reads cleaner in a comment rail than a date.
function relTime(dateStr) {
  const d = new Date(dateStr).getTime();
  if (!d) return '';
  const s = Math.max(0, (Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// Compact voice-note player for audio comments.
function VoiceClip({ url, duration = 0 }) {
  const audioRef = React.useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); }
    else { el.play().catch(() => toast.error('Could not play voice note')); }
  };

  return (
    <div className="mt-2 flex items-center gap-2.5 bg-white/[0.04] border border-white/10 rounded-full pl-1.5 pr-3 py-1.5 w-fit max-w-full">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={(e) => {
          const el = e.target;
          const dur = el.duration && isFinite(el.duration) ? el.duration : duration || 1;
          setProgress(Math.min(100, (el.currentTime / dur) * 100));
        }}
      />
      <button
        type="button"
        onClick={toggle}
        className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shrink-0 transition-colors"
        title={playing ? 'Pause' : 'Play voice note'}
      >
        {playing ? <Pause size={11} /> : <Play size={11} className="ml-0.5" />}
      </button>
      <div className="w-28 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-red-500 rounded-full transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
        {duration ? `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}` : '·'}
      </span>
    </div>
  );
}

function CommentItem({ comment, clipId, currentUser, onReply, serverEmojis, profilesMap = {}, level = 0 }) {
  const queryClient = useQueryClient();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const menu = useMenu();
  const authorProfile = profilesMap[comment.author_id] || profilesMap[comment.user_id];
  const usernameStyle = authorProfile ? buildUsernameStyle(authorProfile) : {};

  const likeMutation = useMutation({
    mutationFn: async () => {
      const likes = comment.likes || [];
      const hasLiked = likes.includes(currentUser?.id);
      const newLikes = hasLiked
        ? likes.filter(id => id !== currentUser?.id)
        : [...likes, currentUser?.id];
      return entities.Comment.update(comment.id, { likes: newLikes });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', clipId] })
  });

  const hasLiked = comment.likes?.includes(currentUser?.id);
  const parsedContent = parseEmojis(comment.content || '', serverEmojis);

  return (
    <>
      <div className={`${level > 0 ? 'ml-5 mt-4 pl-3 border-l border-white/10' : 'mt-5'}`}>
        {/* No more grey block — open glass layout: avatar beside a free-flowing
            column of header / text / media / actions. */}
        <div
          className="flex gap-3 group"
          onContextMenu={(e) => {
            if (!menu?.triggerMenu) return;
            e.preventDefault();
            e.stopPropagation();
            menu.triggerMenu(e, 'web_comment', {
              id: comment.id,
              clip_id: clipId,
              content: comment.content,
              author_id: comment.author_id || comment.user_id,
              author_name: comment.author_name || comment.user_name,
              is_own: (comment.author_id || comment.user_id) === currentUser?.id,
            });
          }}
        >
          <Avatar
            className="w-8 h-8 flex-shrink-0 cursor-pointer border border-white/10 hover:ring-2 hover:ring-red-500 transition-all"
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

          <div className="flex-1 min-w-0 flex flex-col">
            {/* Header: name + relative time */}
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="font-bold text-sm hover:underline cursor-pointer truncate"
                style={usernameStyle}
                onClick={() => setShowProfile(true)}
              >
                {comment.author_name || comment.user_name}
              </span>
              <span className="text-[10px] text-white/40 font-medium shrink-0">
                {relTime(comment.created_date)}
              </span>
            </div>

            {/* Text */}
            {(comment.content || '').trim() && (
              <p className="text-sm text-white/80 leading-relaxed break-words">
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
              </p>
            )}

            {/* Attached images / GIFs */}
            {comment.media_urls && comment.media_urls.length > 0 && (
              <div className={`mt-2 grid gap-2 ${comment.media_urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-[240px]'}`}>
                {comment.media_urls.map((url, idx) => (
                  <ContextableImage
                    key={idx}
                    src={url}
                    alt="attachment"
                    senderName={comment.author_name || comment.user_name}
                    className="rounded-xl max-h-44 object-cover cursor-pointer w-full border border-white/10"
                  />
                ))}
              </div>
            )}

            {/* Voice note */}
            {comment.voice_url && <VoiceClip url={comment.voice_url} duration={comment.voice_duration} />}

            {/* Actions */}
            <div className="flex gap-4 items-center mt-1.5 text-[11px] font-bold text-white/40 uppercase tracking-wider">
              <button
                onClick={() => likeMutation.mutate()}
                className={`flex items-center gap-1 transition-colors ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}
              >
                <Heart className="w-3 h-3" fill={hasLiked ? 'currentColor' : 'none'} />
                <span>{comment.likes?.length || 0}</span>
              </button>
              {level < 2 && (
                <button
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="hover:text-white transition-colors"
                >
                  Reply
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
  const [mediaFiles, setMediaFiles] = useState([]);      // image / GIF urls
  const [voiceNote, setVoiceNote] = useState(null);      // { url, duration }
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = React.useRef(null);
  const chunksRef = React.useRef([]);
  const timerRef = React.useRef(null);
  const queryClient = useQueryClient();

  const createCommentMutation = useMutation({
    mutationFn: async (commentData) => entities.Comment.create(commentData),
    onSuccess: async () => {
      const clips = queryClient.getQueryData(['clips']) || [];
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        await entities.Clip.update(clipId, {
          comments_count: (clip.comments_count || 0) + 1
        });
      }
      queryClient.invalidateQueries({ queryKey: ['comments', clipId] });
      queryClient.invalidateQueries({ queryKey: ['clips'] });
      setContent('');
      setMediaFiles([]);
      setVoiceNote(null);
      onSuccess?.();
      toast.success('Comment posted!');
    },
    onError: (err) => toast.error(err?.message || 'Could not post comment'),
  });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const results = await Promise.all(files.map(file => integrations.Core.UploadFile({ file })));
      setMediaFiles(prev => [...prev, ...results.map(r => r.url).filter(Boolean)]);
    } catch {
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  // ── Voice notes (MediaRecorder) ──────────────────────────────────────
  // Tap the mic to record, tap again to stop → the blob uploads like any
  // other file and rides on the comment as voice_url + voice_duration.
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(timerRef.current);
        const secs = recordSecsRef.current;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (!blob.size || secs < 1) { setRecordSecs(0); return; } // too short — discard
        setUploading(true);
        try {
          const file = new File([blob], `voice-comment-${Date.now()}.webm`, { type: blob.type });
          const res = await integrations.Core.UploadFile({ file });
          if (res?.url) setVoiceNote({ url: res.url, duration: secs });
          else toast.error('Voice upload failed');
        } catch {
          toast.error('Voice upload failed');
        } finally {
          setUploading(false);
          setRecordSecs(0);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordSecs(0);
      recordSecsRef.current = 0;
      timerRef.current = setInterval(() => {
        recordSecsRef.current += 1;
        setRecordSecs(s => {
          if (s + 1 >= 120) { try { recorderRef.current?.stop(); } catch {} } // 2 min cap
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error('Microphone unavailable — check permissions');
    }
  };
  const recordSecsRef = React.useRef(0);
  const stopRecording = () => { try { recorderRef.current?.stop(); } catch {} };
  React.useEffect(() => () => { clearInterval(timerRef.current); try { recorderRef.current?.stop(); } catch {} }, []);

  const handleSubmit = () => {
    if (!content.trim() && mediaFiles.length === 0 && !voiceNote) return;
    createCommentMutation.mutate({
      clip_id: clipId,
      content: content.trim(),
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || currentUser?.username,
      user_avatar: currentUser?.avatar_url || '',
      author_id: currentUser?.id,
      author_name: currentUser?.full_name || currentUser?.username,
      author_avatar: currentUser?.avatar_url || '',
      parent_comment_id: parentCommentId,
      media_urls: mediaFiles,
      voice_url: voiceNote?.url || '',
      voice_duration: voiceNote?.duration || 0,
      likes: [],
    });
  };

  const handleEmojiSelect = (emojiData) => {
    if (emojiData.type === 'custom') setContent(c => c + `:${emojiData.name}:`);
    else setContent(c => c + emojiData.emoji);
  };

  const canPost = (content.trim() || mediaFiles.length > 0 || voiceNote) && !createCommentMutation.isPending && !uploading && !recording;

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2'}>
      {/* Attachment previews */}
      {(mediaFiles.length > 0 || voiceNote) && (
        <div className="flex gap-2 flex-wrap items-center">
          {mediaFiles.map((url, idx) => (
            <div key={idx} className="relative group">
              <img src={url} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-white/10" />
              <button
                onClick={() => setMediaFiles(mediaFiles.filter((_, i) => i !== idx))}
                className="absolute -top-1.5 -right-1.5 bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {voiceNote && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-emerald-400">
              <Mic size={12} />
              Voice note · {Math.floor(voiceNote.duration / 60)}:{String(voiceNote.duration % 60).padStart(2, '0')}
              <button onClick={() => setVoiceNote(null)} className="text-red-400 hover:text-red-300 ml-1"><X size={12} /></button>
            </div>
          )}
        </div>
      )}

      {/* Floating glass input dock — text on top, action toolbar below so
          icons never crowd the typing area. */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl focus-within:border-white/30 transition-colors p-3 flex flex-col gap-2.5 shadow-lg">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canPost) { e.preventDefault(); handleSubmit(); } }}
          placeholder={recording ? `Recording… ${Math.floor(recordSecs / 60)}:${String(recordSecs % 60).padStart(2, '0')}` : (parentCommentId ? 'Write a reply…' : 'Add a comment…')}
          disabled={recording}
          className="bg-transparent outline-none text-sm text-white placeholder:text-white/30 w-full disabled:placeholder:text-red-400/70"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {/* Image / GIF file upload */}
            <label className="p-2 hover:bg-white/10 rounded-lg cursor-pointer text-white/50 hover:text-white transition-colors" title="Attach image">
              <ImageIcon className="w-4 h-4" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>

            {/* GIF picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                  title="Add GIF"
                >
                  <span className="font-black text-[9px] uppercase border border-current rounded px-1 leading-4 block">GIF</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-[360px] h-[420px] p-0 bg-zinc-900 border-red-900/30 overflow-hidden"
              >
                <GifPicker onGifSelect={(url) => setMediaFiles((prev) => [...prev, url])} />
              </PopoverContent>
            </Popover>

            {/* Emoji */}
            <EmojiPicker onEmojiSelect={handleEmojiSelect} currentUser={currentUser} />

            {/* Voice note */}
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={uploading || !!voiceNote}
              className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
                recording
                  ? 'bg-red-500/20 text-red-500 animate-pulse'
                  : 'hover:bg-white/10 text-white/50 hover:text-white'
              }`}
              title={voiceNote ? 'Voice note attached' : recording ? 'Stop recording' : 'Record voice note'}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canPost}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 h-8 rounded-full"
            size="sm"
          >
            {createCommentMutation.isPending || uploading ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{uploading ? 'Uploading' : 'Posting'}</>
            ) : (
              'Post'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RichComments({ clipId, currentUser }) {
  const queryClient = useQueryClient();
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', clipId],
    queryFn: () => entities.Comment.filter({ clip_id: clipId }),
  });

  // Handle right-click menu actions targeting comments in this clip.
  React.useEffect(() => {
    const handler = async (e) => {
      const { action, data, type } = e.detail || {};
      if (type !== 'web_comment' || !data || data.clip_id !== clipId) return;
      if (action === 'copy') {
        navigator.clipboard?.writeText(data.content || '').catch(() => {});
        toast.success('Comment copied');
      } else if (action === 'profile' && data.author_id) {
        window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: data.author_id } }));
      } else if (action === 'report') {
        toast.success('Comment reported to moderators');
      } else if (action === 'delete-comment' && data.is_own) {
        try {
          await entities.Comment.delete(data.id);
          queryClient.invalidateQueries({ queryKey: ['comments', clipId] });
          toast.success('Comment deleted');
        } catch { toast.error('Could not delete comment'); }
      } else if (action === 'reply') {
        window.dispatchEvent(new CustomEvent('spidr-comment-reply', { detail: { commentId: data.id, authorName: data.author_name } }));
      }
    };
    window.addEventListener('spidr-menu-action', handler);
    return () => window.removeEventListener('spidr-menu-action', handler);
  }, [clipId, queryClient]);

  // Get server emojis for parsing
  const { data: servers = [] } = useQuery({
    queryKey: ['all-servers'],
    queryFn: () => entities.Server.list('-created_date', 100),
  });

  // All user profiles so we can colour/style commenter usernames the way
  // they appear elsewhere in the app (username colors on comments).
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list('-created_date', 500),
    staleTime: 60000,
  });
  const profilesMap = React.useMemo(() => {
    const m = {};
    for (const p of profiles) if (p.user_id) m[p.user_id] = p;
    return m;
  }, [profiles]);

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
                  profilesMap={profilesMap}
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
                      profilesMap={profilesMap}
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
                        profilesMap={profilesMap}
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
