import React from 'react';
import {
  Hand, Zap, Flame, BarChart3, Shield, CheckCircle2, XCircle, Lightbulb,
  Music, Heart, Laugh, Bot, Sparkles, Rocket, Eye, Bug, AlertTriangle,
  PartyPopper, Target, Brain, Wrench, Search, Star,
} from 'lucide-react';

/**
 * AIIconText — renders Spidr AI message text with CUSTOM ICONS in place of
 * emojis. The AI's voice should feel like part of the Spidr system UI, not a
 * text message full of OS-flavored emoji glyphs — so every known emoji swaps
 * to an inline lucide icon in the brand accent, and the spider marks get a
 * bespoke SVG.
 *
 * Unknown emojis pass through untouched (better an emoji than a hole in the
 * sentence). Pure render transform — the stored message content is unchanged.
 */

// Bespoke spider mark for 🕷️/🕸️ — the AI's own sigil.
const SpiderMark = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="13" r="3.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="8.6" r="1.8" fill="currentColor" stroke="none" />
    <path d="M9.5 11.5 5 8M9 13.5H3.6M9.5 15.5 5.5 19M14.5 11.5 19 8M15 13.5h5.4M14.5 15.5 18.5 19" />
  </svg>
);

// emoji → { Icon, color? } — color defaults to the Spidr red accent.
const EMOJI_ICON_MAP = {
  '👋': { Icon: Hand, color: '#fbbf24' },
  '🕷️': { Icon: SpiderMark }, '🕷': { Icon: SpiderMark },
  '🕸️': { Icon: SpiderMark }, '🕸': { Icon: SpiderMark },
  '⚡': { Icon: Zap, color: '#fbbf24' },
  '🔥': { Icon: Flame, color: '#f97316' },
  '📊': { Icon: BarChart3, color: '#60a5fa' },
  '🛡️': { Icon: Shield, color: '#34d399' }, '🛡': { Icon: Shield, color: '#34d399' },
  '✅': { Icon: CheckCircle2, color: '#34d399' },
  '❌': { Icon: XCircle },
  '💡': { Icon: Lightbulb, color: '#fbbf24' },
  '🎵': { Icon: Music, color: '#c084fc' }, '🎶': { Icon: Music, color: '#c084fc' },
  '❤️': { Icon: Heart }, '❤': { Icon: Heart }, '🔴': { Icon: Heart },
  '😂': { Icon: Laugh, color: '#fbbf24' }, '🤣': { Icon: Laugh, color: '#fbbf24' },
  '🤖': { Icon: Bot, color: '#60a5fa' },
  '✨': { Icon: Sparkles, color: '#c084fc' },
  '🚀': { Icon: Rocket, color: '#60a5fa' },
  '👀': { Icon: Eye, color: '#94a3b8' },
  '🐛': { Icon: Bug, color: '#34d399' },
  '⚠️': { Icon: AlertTriangle, color: '#fbbf24' }, '⚠': { Icon: AlertTriangle, color: '#fbbf24' },
  '🎉': { Icon: PartyPopper, color: '#c084fc' },
  '🎯': { Icon: Target },
  '🧠': { Icon: Brain, color: '#c084fc' },
  '🔧': { Icon: Wrench, color: '#94a3b8' },
  '🔍': { Icon: Search, color: '#94a3b8' },
  '⭐': { Icon: Star, color: '#fbbf24' }, '🌟': { Icon: Star, color: '#fbbf24' },
};

// Longest-first so multi-codepoint variants (🕷️) match before bare forms (🕷).
const EMOJI_KEYS = Object.keys(EMOJI_ICON_MAP).sort((a, b) => b.length - a.length);
const SPLIT_RE = new RegExp(
  `(${EMOJI_KEYS.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'g'
);

export function hasMappedEmoji(text = '') {
  return EMOJI_KEYS.some((e) => text.includes(e));
}

export default function AIIconText({ text = '' }) {
  if (!text || !hasMappedEmoji(text)) return <>{text}</>;
  const parts = String(text).split(SPLIT_RE);
  return (
    <>
      {parts.map((part, i) => {
        const hit = EMOJI_ICON_MAP[part];
        if (!hit) return <span key={i}>{part}</span>;
        const { Icon, color = '#f87171' } = hit;
        return (
          <span
            key={i}
            className="inline-flex items-center align-text-bottom mx-0.5"
            style={{ color }}
            aria-hidden
          >
            <Icon size={14} />
          </span>
        );
      })}
    </>
  );
}
