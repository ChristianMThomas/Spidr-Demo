import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Shield, X } from 'lucide-react';
import MentionParser from './MentionParser';

// Permissive URL match — captures http/https; trailing punctuation
// (., ,, ;, !, ?, ), ]) gets handled by trimming below before display
// and inclusion in the href so a sentence-ending period doesn't become
// part of the link.
const URL_REGEX = /(https?:\/\/[^\s<>"]+)/g;
const TRAILING_PUNCT = /[.,;:!?\])'"]+$/;

/**
 * Linkify — renders message text where URLs become Spidr-styled clickable
 * chips. Non-URL text passes through `MentionParser` so existing @mentions
 * and emoji rendering still work. Tapping a link opens the Secure Gateway
 * modal: the user must explicitly proceed before navigation, and a clear
 * warning reminds them never to enter their Spidr passcode on external
 * sites. The user can also cancel the navigation entirely.
 *
 * Drop-in for the existing <MentionParser text={...} users={...}
 * onMentionClick={...} /> call sites — same prop signature.
 */
export default function Linkify({ text, className = '', users = [], onMentionClick }) {
  if (!text) return null;

  // Split text into alternating chunks: non-URL, URL, non-URL, URL, ...
  // The capturing group in URL_REGEX means split() includes the matches.
  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!part) return null;
        const isUrl = URL_REGEX.test(part);
        // URL_REGEX is /g — test() advances lastIndex on /g regexes, which
        // would cause the SAME string to alternate true/false on repeated
        // calls. Reset it after each test to keep this branch deterministic.
        URL_REGEX.lastIndex = 0;
        if (isUrl) {
          // Pull a trailing punctuation cluster off so "see https://x.com." doesn't
          // include the period in the link.
          const m = part.match(TRAILING_PUNCT);
          const tail = m ? m[0] : '';
          const url = tail ? part.slice(0, -tail.length) : part;
          return (
            <React.Fragment key={i}>
              <LinkChip url={url} />
              {tail}
            </React.Fragment>
          );
        }
        // Non-URL chunk — keep mention + emoji parsing
        return (
          <MentionParser
            key={i}
            text={part}
            users={users}
            onMentionClick={onMentionClick}
          />
        );
      })}
    </span>
  );
}

/**
 * LinkChip — a single clickable URL token. Renders in Spidr red, opens
 * the Secure Gateway modal on click. Stops event propagation so clicking
 * a link inside a message bubble doesn't also trigger the bubble's own
 * click handlers (e.g. starting a reply).
 */
function LinkChip({ url }) {
  const [open, setOpen] = useState(false);

  // Trim the displayed text — strip protocol so the link reads cleaner
  // in the chat feed; the full URL stays in the Gateway modal.
  const display = url
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .slice(0, 60) + (url.length > 67 ? '…' : '');

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className="text-red-400 hover:text-red-300 underline decoration-red-500/40 hover:decoration-red-400/80 underline-offset-2 break-all cursor-pointer transition-colors"
        title={url}
      >
        {display}
      </button>
      <AnimatePresence>
        {open && (
          <SecureGateway
            url={url}
            onCancel={() => setOpen(false)}
            onProceed={() => {
              setOpen(false);
              // Open in a new tab + noopener so the destination can't
              // window.opener back into Spidr.
              try {
                window.open(url, '_blank', 'noopener,noreferrer');
              } catch {}
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * SecureGateway — the warning modal that intercepts every external link
 * click. Shows the full URL, a passcode-safety reminder, and lets the
 * user proceed or cancel. Z-index pegged above the chat surface but
 * below toasts.
 */
function SecureGateway({ url, onCancel, onProceed }) {
  // Pull the host out of the URL so the warning header can say
  // "You are leaving Spidr to visit example.com" rather than slamming the
  // full URL into the heading.
  let host = url;
  try { host = new URL(url).host || url; } catch {}

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10, 10, 10, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(239, 68, 68, 0.30)',
          boxShadow: '0 0 40px rgba(239, 68, 68, 0.20), 0 24px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-white/5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-red-400 mb-1">Spidr Secure Gateway</p>
            <h3 className="text-white font-bold text-sm leading-snug">
              You are leaving Spidr
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-500 hover:text-white p-1 rounded transition-colors flex-shrink-0"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Destination URL — broken out so the user can read what they're
            actually about to visit. Word-broken so long URLs wrap. */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">Destination</p>
            <div
              className="px-3 py-2 rounded-lg flex items-start gap-2"
              style={{ background: 'rgba(0, 0, 0, 0.40)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
            >
              <ExternalLink size={12} className="text-zinc-500 mt-1 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-white text-xs font-mono break-all">{host}</p>
                <p className="text-zinc-500 text-[10px] font-mono break-all mt-0.5">{url}</p>
              </div>
            </div>
          </div>

          {/* Safety reminder */}
          <div
            className="p-3 rounded-lg text-[11px] text-zinc-300 leading-relaxed"
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.18)',
            }}
          >
            <span className="font-bold text-red-300">Never enter your Spidr passcode</span> on
            external sites. Spidr will never ask for your password outside the official login.
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.10)',
                color: 'rgba(255, 255, 255, 0.7)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02]"
              style={{
                background: '#ef4444',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.35)',
              }}
            >
              Proceed
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
