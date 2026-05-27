import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldOff, X } from 'lucide-react';

const CATEGORY_LABELS = {
  nsfw: 'Adult / Sexual Content',
  violence: 'Graphic Violence / Gore',
  hate: 'Hate Speech / Extremism',
  drugs: 'Drug-Related Content',
  self_harm: 'Self-Harm / Suicide',
  child_safety: 'Child Safety Violation',
};

export default function ContentBlockedModal({ open, onClose, category }) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm bg-[#0a0a0a] border-2 border-red-600/50 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(220,38,38,0.3)]"
        >
          {/* Top bar */}
          <div className="h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse" />

          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-600/30 flex items-center justify-center mx-auto mb-4">
              <ShieldOff className="w-8 h-8 text-red-500" />
            </div>

            <h2 className="text-lg font-black text-white uppercase tracking-tight mb-1">
              Content <span className="text-red-500">Blocked</span>
            </h2>

            <p className="text-xs text-red-400 font-mono mb-4">
              AEGIS PROTOCOL TRIGGERED
            </p>

            <div className="bg-red-950/30 border border-red-600/20 rounded-xl p-3 mb-4">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Detected Violation</p>
              <p className="text-sm text-red-400 font-bold">{CATEGORY_LABELS[category] || 'Prohibited Content'}</p>
            </div>

            <p className="text-[11px] text-gray-500 mb-5 leading-relaxed">
              This content violates Spidr's community guidelines and has been blocked. 
              Repeated violations may result in account suspension.
            </p>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white uppercase hover:bg-white/10 transition-colors"
            >
              Understood
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}