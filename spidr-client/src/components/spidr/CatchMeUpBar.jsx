import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { integrations } from '@/api/apiClient';
import { toast } from 'sonner';

/**
 * CatchMeUpBar — an in-chat "Catch Me Up" banner that asks Spidr AI to summarize
 * the most recent messages of the current conversation. Reused across DMs, group
 * chats, and server channels.
 *
 * Props:
 *   messages      array of message objects (any shape with content + a name field)
 *   contextLabel  short label for the conversation (e.g. "#general", "Jess M")
 *   limit         how many recent messages to summarize (default 30)
 *   getText       optional (msg) => string extractor; defaults to common fields
 *   getAuthor     optional (msg) => string extractor for the speaker name
 */
export default function CatchMeUpBar({ messages = [], contextLabel = 'this chat', limit = 30, getText, getAuthor }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  const textOf = getText || ((m) => m?.content || m?.text || '');
  const authorOf = getAuthor || ((m) => m?.user_name || m?.sender_name || m?.author_name || m?.username || 'someone');

  const run = async () => {
    if (loading) return;
    const recent = messages.slice(-limit).filter(m => textOf(m)?.trim());
    if (recent.length === 0) {
      toast.info('Nothing to summarize yet.');
      return;
    }
    setLoading(true);
    setSummary(null);
    try {
      const lines = recent.map(m => `${authorOf(m)}: ${String(textOf(m)).slice(0, 160)}`);
      const prompt = `You are Spidr AI. Summarize the following recent messages from ${contextLabel} as a short, scannable recap. Highlight key topics, decisions, and anything that seems to need a reply. Keep it under 120 words, use short bullet points, and do not invent details.\n\nMessages (oldest to newest):\n${lines.join('\n')}`;
      const reply = await integrations.Core.InvokeLLM({ prompt });
      setSummary(typeof reply === 'string' ? reply : JSON.stringify(reply));
    } catch {
      toast.error('Could not generate a summary right now.');
    }
    setLoading(false);
  };

  return (
    <div className="px-3 pt-2">
      <button
        onClick={run}
        disabled={loading}
        className="group w-full flex items-center gap-2 rounded-xl border border-[#FF3333]/30 bg-gradient-to-r from-[#FF3333]/10 to-transparent px-3 py-2 text-left transition-colors hover:border-[#FF3333]/50 disabled:opacity-60"
      >
        {loading
          ? <Loader2 size={15} className="text-[#FF3333] animate-spin shrink-0" />
          : <Sparkles size={15} className="text-[#FF3333] shrink-0 group-hover:scale-110 transition-transform" />}
        <span className="text-sm font-black text-[#FF3333]">Catch Me Up</span>
        <span className="text-xs text-zinc-500">— AI summary of last {Math.min(limit, messages.length)} messages</span>
      </button>

      <AnimatePresence>
        {summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative mt-1.5 rounded-xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md p-3 pr-8">
              <button
                onClick={() => setSummary(null)}
                className="absolute top-2 right-2 text-zinc-500 hover:text-white transition-colors"
                title="Dismiss"
              >
                <X size={14} />
              </button>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles size={12} className="text-[#FF3333]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#FF3333]">Spidr AI Recap</span>
              </div>
              <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{summary}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
