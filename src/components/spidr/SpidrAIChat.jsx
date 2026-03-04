import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Send, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import SpiderLogo from './SpiderLogo';

export default function SpidrAIChat({ open, onClose, onSendMessage, chatContext }) {
  const [prompt, setPrompt] = useState('');

  const askAIMutation = useMutation({
    mutationFn: async (userPrompt) => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Spidr AI, a chill, friendly AI buddy in a ${chatContext || 'chat'} on Spidr. You sound like a cool guy in his 20s — casual, warm, approachable. Use contractions and natural speech. Keep responses under 300 characters. The user asks: "${userPrompt}"`,
        response_json_schema: {
          type: 'object',
          properties: { answer: { type: 'string' } }
        }
      });
      return result.answer || "Hmm, my bad — try asking again!";
    },
    onSuccess: (answer) => {
      if (onSendMessage) {
        onSendMessage(answer);
      }
      setPrompt('');
      toast.success('Spidr AI responded!');
    }
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="absolute bottom-20 right-4 w-72 bg-[#0a0a0a]/95 backdrop-blur-xl border border-[#FF3333]/40 rounded-2xl shadow-[0_0_30px_rgba(255,51,51,0.2)] z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2 text-[#FF3333]">
              <SpiderLogo size={16} />
              <span className="text-xs font-black uppercase tracking-widest">Spidr AI</span>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="p-3 space-y-2">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">Quick Actions</div>
            <div className="grid grid-cols-2 gap-1.5">
              {['Tell a joke', 'Random fact', 'Roast me', 'Motivate me'].map(action => (
                <button
                  key={action}
                  onClick={() => askAIMutation.mutate(action)}
                  disabled={askAIMutation.isPending}
                  className="px-2 py-1.5 bg-white/5 hover:bg-[#FF3333]/20 border border-white/5 hover:border-[#FF3333]/30 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white transition-all"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Prompt */}
          <div className="p-3 pt-0">
            <div className="flex gap-2">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && prompt.trim() && askAIMutation.mutate(prompt)}
                placeholder="Ask Spidr AI..."
                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#FF3333]/50"
              />
              <button
                onClick={() => prompt.trim() && askAIMutation.mutate(prompt)}
                disabled={!prompt.trim() || askAIMutation.isPending}
                className="p-2 bg-[#FF3333] hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {askAIMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>

          {/* Waveform when loading */}
          {askAIMutation.isPending && (
            <div className="px-4 pb-3 flex items-center gap-1 justify-center">
              {[...Array(6)].map((_, i) => (
                <motion.div key={i} animate={{ height: ['4px', '16px', '4px'] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }} className="w-1 bg-[#FF3333] rounded-full" />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}