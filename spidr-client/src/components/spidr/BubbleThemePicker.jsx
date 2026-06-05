import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles, Check } from 'lucide-react';
import { BUBBLE_GRADIENTS, getBubbleGradient, buildBubbleStyle } from '@/lib/bubbleGradients';

/**
 * BubbleThemePicker — curated gradient picker for outgoing DM bubbles.
 *
 * Rendered inside ApexVisuals (the APEX customization panel). Writes the
 * selected gradient id into formData.apex_features.bubble_gradient via the
 * shared updateFormData callback so it flows through the existing "Deploy
 * Apex Configurations" save path.
 *
 * Design intent (matches spec): a FIXED curated list, no free-form color
 * picker. Each option is rendered as a live preview bubble showing how that
 * gradient looks against the dark canvas with sample message text — what
 * the user picks IS what their friends will see.
 */
export default function BubbleThemePicker({ formData, updateFormData }) {
  const apexFeatures = formData?.apex_features || {};
  const selectedId   = apexFeatures.bubble_gradient || 'default';

  const handlePick = (gradientId) => {
    updateFormData({
      apex_features: { ...apexFeatures, bubble_gradient: gradientId },
    });
  };

  return (
    <div className="space-y-4">
      {/* Section header — matches the visual rhythm of the other ApexVisuals
          sections (icon + uppercase label + descriptive subline). */}
      <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
        <MessageSquare size={16} className="text-purple-500" /> DM Bubble Theme
      </div>
      <p className="text-xs text-gray-500 font-mono leading-relaxed">
        {'>'} Recolors the bubbles you send across every DM.<br />
        {'>'} Curated to never compromise the Spidr aesthetic — no blinding neons get past the door.
      </p>

      {/* Preview grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BUBBLE_GRADIENTS.map((g) => {
          const isSelected = g.id === selectedId;
          return (
            <PreviewCard
              key={g.id}
              gradient={g}
              isSelected={isSelected}
              onClick={() => handlePick(g.id)}
            />
          );
        })}
      </div>

      {/* Foot note — show the active selection name for confirmation */}
      <div className="flex items-center gap-2 mt-2 pt-3 border-t border-white/5">
        <Sparkles size={12} className="text-purple-400" />
        <span className="text-[11px] text-zinc-400 font-mono">
          Active theme:&nbsp;
          <span className="text-white font-bold">
            {getBubbleGradient(selectedId).label}
          </span>
        </span>
      </div>
    </div>
  );
}

/** A single gradient option — rendered as a live preview bubble. */
function PreviewCard({ gradient, isSelected, onClick }) {
  const style = buildBubbleStyle(gradient, { variant: 'own' }) || {
    // Default branch needs a style so the preview shows the existing tint
    // rather than being completely transparent in the picker.
    background: 'rgba(255, 51, 51, 0.07)',
    borderColor: 'rgba(255, 51, 51, 0.18)',
    boxShadow: '0 0 16px rgba(255, 51, 51, 0.04)',
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={`relative w-full text-left rounded-2xl p-3 transition-colors border ${
        isSelected
          ? 'border-white/40 bg-white/[0.03]'
          : 'border-white/5 hover:border-white/15 bg-black/30'
      }`}
      style={isSelected ? {
        boxShadow: `0 0 0 1px ${gradient.accent}55, 0 0 26px ${gradient.glow}`,
      } : undefined}
    >
      {/* Top row — label + selected check */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: gradient.accent, boxShadow: `0 0 6px ${gradient.accent}` }}
          />
          <span className="text-[12px] font-bold text-white tracking-wide">
            {gradient.label}
          </span>
        </div>
        {isSelected && (
          <span
            className="flex items-center justify-center w-5 h-5 rounded-full"
            style={{ background: gradient.accent, boxShadow: `0 0 8px ${gradient.accent}aa` }}
          >
            <Check size={11} className="text-black" strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Live bubble preview — actual gradient applied to a sample message */}
      <div className="flex justify-end mb-1">
        <div
          className="rounded-l-xl rounded-tr-xl rounded-br-sm border px-3 py-2 max-w-[80%] backdrop-blur-sm"
          style={style}
        >
          <p className="text-[11px] text-zinc-200 leading-snug">
            {gradient.description || 'Hey, the new gradient looks clean.'}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <span className="text-[9px] text-zinc-600 font-mono mr-1">your message</span>
      </div>
    </motion.button>
  );
}
