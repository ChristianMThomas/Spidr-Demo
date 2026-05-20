import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { entities, feedComments } from '@/api/apiClient';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Send, MessageCircle, Reply, Trash2, Loader2 } from 'lucide-react';

/**
 * FeedCommentsSection — expandable comments + 1-level replies for a feed item.
 *
 * Renders inline at the bottom of a FeedCard. Top-level comments display
 * with their replies indented underneath. Replies don't allow further
 * nesting — clicking "Reply" on a reply just opens a new reply to the
 * SAME parent. This keeps the UI flat-enough to read on mobile.
 *
 * The user can:
 *   • Add a top-level comment
 *   • Reply to any comment (attaches to its parent_comment_id)
 *   • React with quick-emojis (👍 ❤️ 😂 etc.)
 *   • Delete their own comments
 *
 * Edit is intentionally not exposed yet — the schema supports edited_at
 * and the route allows it for the author, but the UI flow needs a real
 * inline-edit affordance and a "(edited)" indicator. Easy follow-up.
 */
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🕷️'];

function fromNow(date) {
  const diff = Date.now() - new Date(date).getTime();
  const abs = Math.abs(diff);
  const [val, unit] =
    abs < 60_000      ? [Math.floor(abs / 1000),     's'] :
    abs < 3_600_000   ? [Math.floor(abs / 60_000),   'm'] :
    abs < 86_400_000  ? [Math.floor(abs / 3_600_000),'h'] :
    abs < 2_592_000_000 ? [Math.floor(abs / 86_400_000), 'd'] :
                          [Math.floor(abs / 2_592_000_000), 'mo'];
  return `${val}${unit}`;
}

export default function FeedCommentsSection({ feedId, currentUser }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { id, name }
  const [submitting, setSubmitting] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['feed-comments', feedId],
    // Sort ascending by date so oldest comments appear at the top — readers
    // see the thread chronologically. Replies are grouped under their parent
    // client-side rather than by query.
    queryFn: () => entities.FeedComment.filter({ feed_id: feedId }, 'created_date', 200),
    enabled: !!feedId,
    staleTime: 10_000,
  });

  // Bucket by parent. Top-level comments (parent_comment_id == null) and
  // a sub-array of replies for each. Comments arriving out of order are
  // tolerated — the bucket is built every render.
  const { topLevel, repliesByParent } = React.useMemo(() => {
    const top = [];
    const replies = {};
    for (const c of comments) {
      if (c.parent_comment_id) {
        replies[c.parent_comment_id] = replies[c.parent_comment_id] || [];
        replies[c.parent_comment_id].push(c);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesByParent: replies };
  }, [comments]);

  const createMut = useMutation({
    mutationFn: async ({ content, parent_comment_id }) => {
      return entities.FeedComment.create({
        feed_id: feedId,
        parent_comment_id: parent_comment_id || null,
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.username || 'Anonymous',
        author_avatar: currentUser?.avatar_url || '',
        content: content.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-comments', feedId] });
      // Also bump the feed query so the comments_count shown on the card updates.
      queryClient.invalidateQueries({ queryKey: ['enhanced-feed'] });
      setInput('');
      setReplyingTo(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Could not post comment');
    },
    onSettled: () => setSubmitting(false),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => entities.FeedComment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-comments', feedId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-feed'] });
      toast.success('Comment deleted');
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Delete failed'),
  });

  const reactMut = useMutation({
    mutationFn: ({ commentId, emoji }) => feedComments.react(commentId, emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed-comments', feedId] }),
  });

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    createMut.mutate({ content: text, parent_comment_id: replyingTo?.id || null });
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      {/* Composer */}
      <div className="flex items-start gap-2 mb-3">
        <Avatar className="w-7 h-7 shrink-0">
          {currentUser?.avatar_url && <AvatarImage src={currentUser.avatar_url} />}
          <AvatarFallback className="bg-red-900 text-white text-[10px]">
            {(currentUser?.full_name || currentUser?.username || '?').charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          {replyingTo && (
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mb-1">
              <Reply className="w-3 h-3" />
              Replying to <span className="text-red-400">@{replyingTo.name}</span>
              <button
                onClick={() => setReplyingTo(null)}
                className="ml-1 text-zinc-600 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : 'Add a comment...'}
              maxLength={1000}
              className="flex-1 min-w-0 bg-zinc-900 border border-white/10 focus:border-red-500/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 outline-none transition-colors"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || submitting}
              className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors shrink-0"
              aria-label="Post comment"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Comments */}
      {isLoading && comments.length === 0 ? (
        <p className="text-zinc-600 text-xs text-center py-3">Loading comments...</p>
      ) : topLevel.length === 0 ? (
        <p className="text-zinc-600 text-xs text-center py-3">No comments yet — be the first.</p>
      ) : (
        <div className="space-y-2.5">
          {topLevel.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              replies={repliesByParent[c.id] || []}
              currentUser={currentUser}
              onReply={(name) => setReplyingTo({ id: c.id, name })}
              onDelete={(id) => deleteMut.mutate(id)}
              onReact={(commentId, emoji) => reactMut.mutate({ commentId, emoji })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * CommentRow — single top-level comment + its child replies indented.
 * Replies use a smaller avatar and a left-border accent so the visual
 * hierarchy is obvious without deep nesting.
 */
function CommentRow({ comment, replies, currentUser, onReply, onDelete, onReact }) {
  const reactions = comment.reactions instanceof Map
    ? Object.fromEntries(comment.reactions)
    : (comment.reactions || {});
  const isOwn = comment.author_id === currentUser?.id;
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div>
      <CommentBody
        comment={comment}
        reactions={reactions}
        isOwn={isOwn}
        currentUser={currentUser}
        avatarSize={7}
        onReply={() => onReply(comment.author_name)}
        onDelete={() => onDelete(comment.id)}
        onReact={(emoji) => onReact(comment.id, emoji)}
        showPicker={showPicker}
        setShowPicker={setShowPicker}
      />
      {/* Indented replies */}
      {replies.length > 0 && (
        <div className="mt-2 ml-4 sm:ml-9 pl-3 border-l border-white/10 space-y-2.5">
          {replies.map((r) => (
            <ReplyRow
              key={r.id}
              reply={r}
              currentUser={currentUser}
              parentAuthorName={comment.author_name}
              onReply={() => onReply(comment.author_name)}
              onDelete={() => onDelete(r.id)}
              onReact={(emoji) => onReact(r.id, emoji)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyRow({ reply, currentUser, onReply, onDelete, onReact }) {
  const reactions = reply.reactions instanceof Map
    ? Object.fromEntries(reply.reactions)
    : (reply.reactions || {});
  const isOwn = reply.author_id === currentUser?.id;
  const [showPicker, setShowPicker] = useState(false);

  return (
    <CommentBody
      comment={reply}
      reactions={reactions}
      isOwn={isOwn}
      currentUser={currentUser}
      avatarSize={6}
      onReply={onReply}
      onDelete={onDelete}
      onReact={onReact}
      showPicker={showPicker}
      setShowPicker={setShowPicker}
    />
  );
}

/**
 * CommentBody — shared rendering for both top-level comments and replies.
 * The only visual difference is avatar size (controlled by `avatarSize`
 * in Tailwind units: w-7/h-7 vs w-6/h-6).
 */
function CommentBody({
  comment, reactions, isOwn, currentUser,
  avatarSize, onReply, onDelete, onReact, showPicker, setShowPicker,
}) {
  // Tailwind JIT can't see dynamically constructed class names, so we map
  // the size prop to a fixed class string here. Two supported sizes.
  const avatarClass = avatarSize === 6 ? 'w-6 h-6' : 'w-7 h-7';
  return (
    <div className="flex items-start gap-2 group">
      <Avatar className={`${avatarClass} shrink-0 mt-0.5`}>
        {comment.author_avatar && <AvatarImage src={comment.author_avatar} />}
        <AvatarFallback className="bg-zinc-700 text-white text-[10px]">
          {comment.author_name?.charAt(0) || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="bg-zinc-900/60 rounded-xl px-3 py-2 border border-white/5">
          <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
            <span className="text-white text-xs font-bold">{comment.author_name || 'Anonymous'}</span>
            <span className="text-zinc-600 text-[10px] font-mono">{fromNow(comment.created_date)}</span>
            {comment.edited_at && <span className="text-zinc-700 text-[9px] italic">(edited)</span>}
          </div>
          <p className="text-zinc-200 text-sm leading-snug whitespace-pre-wrap break-words">{comment.content}</p>
        </div>

        {/* Reaction row */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {Object.entries(reactions).map(([emoji, users]) => {
            if (!users?.length) return null;
            const mine = users.includes(currentUser?.id);
            return (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-all ${
                  mine
                    ? 'bg-red-600/30 border border-red-500/50 text-white'
                    : 'bg-zinc-800 border border-white/5 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {emoji} <span className="font-mono">{users.length}</span>
              </button>
            );
          })}

          <div className="relative">
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="text-[10px] text-zinc-600 hover:text-zinc-300 px-1.5 py-0.5"
              title="React"
            >
              😊+
            </button>
            <AnimatePresence>
              {showPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute z-10 mt-1 left-0 bg-zinc-900 border border-white/10 rounded-lg px-1.5 py-1 flex gap-1 shadow-xl"
                >
                  {QUICK_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { onReact(e); setShowPicker(false); }}
                      className="text-base hover:scale-125 transition-transform px-0.5"
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={onReply}
            className="text-[10px] text-zinc-500 hover:text-red-400 flex items-center gap-1 px-1.5 py-0.5 transition-colors"
          >
            <Reply className="w-3 h-3" /> Reply
          </button>

          {isOwn && (
            <button
              onClick={() => {
                if (window.confirm('Delete this comment?')) onDelete();
              }}
              className="text-[10px] text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 transition-all"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
