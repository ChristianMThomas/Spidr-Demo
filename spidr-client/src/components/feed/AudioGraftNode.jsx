import React, { useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * AudioGraftNode (Patch 2.13) — presentational floating glass disc for a feed
 * post's grafted audio. The play/pause + viewport logic lives in the parent
 * (ClipCard) via useViewportMedia, which owns the container ref + audio ref.
 *
 * Props:
 *   audio        grafted_audio payload { previewUrl, sourceUrl, thumbnail, title, author, provider }
 *   audioRef     ref to the <audio> element (from the parent hook)
 *   playing      bool — audio is actively broadcasting
 *   muted        bool — blocked/muted state (shows slash)
 *   onTap        click handler (unmute / open source)
 *   apexColor    accent color
 */
export default function AudioGraftNode({ audio, audioRef, playing, muted, onTap, apexColor = '#FF3333' }) {
  if (!audio) return null;
  const streamUrl = audio.previewUrl;
  const showMuted = muted || !streamUrl;

  return (
    <>
      {streamUrl && <audio ref={audioRef} src={streamUrl} loop preload="none" />}
      <motion.button
        onClick={onTap}
        whileTap={{ scale: [1, 0.8, 1] }}
        title={audio.title ? `${audio.title}${audio.author ? ' — ' + audio.author : ''}` : 'Grafted audio'}
        className="absolute bottom-3 right-3 z-30 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center overflow-hidden"
        style={{ boxShadow: playing ? `0 0 14px ${apexColor}99` : 'none' }}
      >
        <motion.div
          className="w-7 h-7 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center"
          animate={playing ? { rotate: 360 } : { rotate: 0 }}
          transition={playing ? { repeat: Infinity, duration: 4, ease: 'linear' } : { duration: 0.2 }}
        >
          {audio.thumbnail
            ? <img src={audio.thumbnail} alt="" className="w-full h-full object-cover" />
            : <span className="text-[10px]">♪</span>}
        </motion.div>
        {showMuted && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 40 40">
            <line x1="9" y1="9" x2="31" y2="31" stroke={apexColor} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </motion.button>
    </>
  );
}
