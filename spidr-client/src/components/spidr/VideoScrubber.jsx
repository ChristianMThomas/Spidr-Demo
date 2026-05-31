import React, { useRef } from 'react';
import { motion } from 'framer-motion';

function fmt(pct, duration) {
  const s = (pct / 100) * (duration || 0);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * VideoScrubber (Patch 2.12) — frame-accurate timeline with dual drag handles.
 *
 * Props (all trim/time values are 0–100 percentages, matching VideoStudio):
 *   duration     seconds (for labels + min-duration math)
 *   trimStart/trimEnd   current trim window (%)
 *   currentTime  playhead position (%)
 *   thumbnails   [{ time, dataUrl }] frame strip rendered across the track
 *   apexColor    handle/anchor color
 *   onStart/onEnd(pct)  trim change callbacks (clamped to ≥1s min window)
 *   onSeek(pct)  optional — click track to seek
 */
export default function VideoScrubber({
  duration = 0, trimStart = 0, trimEnd = 100, currentTime = 0,
  thumbnails = [], apexColor = '#FF3333', onStart, onEnd, onSeek,
}) {
  const trackRef = useRef(null);

  // Minimum 1-second window expressed as a percentage of duration.
  const minPct = duration > 0 ? Math.min(50, (1 / duration) * 100) : 5;

  const pctFromClientX = (clientX) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
  };

  const dragHandle = (which) => (_, info) => {
    const pct = pctFromClientX(info.point.x);
    if (which === 'start') {
      const next = Math.min(pct, trimEnd - minPct);
      onStart?.(Math.max(0, next));
    } else {
      const next = Math.max(pct, trimStart + minPct);
      onEnd?.(Math.min(100, next));
    }
  };

  const handleTrackClick = (e) => {
    if (!onSeek) return;
    onSeek(pctFromClientX(e.clientX));
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
        <span style={{ color: apexColor }}>▶ {fmt(trimStart, duration)}</span>
        {duration > 0 && (
          <span className="text-zinc-500">{Math.max(1, Math.round((trimEnd - trimStart) / 100 * duration))}s window</span>
        )}
        <span className="text-zinc-400">{fmt(trimEnd, duration)}</span>
      </div>

      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative bg-white/5 border border-white/10 rounded-lg h-16 overflow-hidden cursor-pointer"
      >
        {/* Frame thumbnails laid across the track */}
        <div className="absolute inset-0 flex">
          {thumbnails.length > 0 ? (
            thumbnails.slice(0, 12).map((t, i) => (
              <img key={i} src={t.dataUrl} alt="" draggable={false}
                className="h-full flex-1 object-cover opacity-70" style={{ minWidth: 0 }} />
            ))
          ) : (
            <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-600 font-mono">
              scrub or generate frames to map the timeline
            </div>
          )}
        </div>

        {/* Dimmed regions outside the trim window */}
        <div className="absolute inset-y-0 left-0 bg-black/65" style={{ width: `${trimStart}%` }} />
        <div className="absolute inset-y-0 right-0 bg-black/65" style={{ width: `${100 - trimEnd}%` }} />

        {/* Selected window outline */}
        <div className="absolute inset-y-0 pointer-events-none border-y-2"
          style={{ left: `${trimStart}%`, width: `${trimEnd - trimStart}%`, borderColor: apexColor }} />

        {/* Playhead — thin crimson needle synced to currentTime */}
        <div className="absolute top-0 bottom-0 w-[2px] bg-red-600 pointer-events-none"
          style={{ left: `${currentTime}%`, boxShadow: '0 0 8px #ef4444' }} />

        {/* Left (start) handle */}
        <motion.div
          drag="x"
          dragMomentum={false}
          dragElastic={0.06}
          onDrag={dragHandle('start')}
          dragConstraints={trackRef}
          className="absolute top-0 bottom-0 z-10 flex items-center justify-center cursor-ew-resize"
          style={{ left: `calc(${trimStart}% - 7px)`, width: 14 }}
        >
          <div className="w-[6px] h-10 rounded-sm" style={{ background: apexColor, boxShadow: `0 0 8px ${apexColor}` }} />
        </motion.div>

        {/* Right (end) handle */}
        <motion.div
          drag="x"
          dragMomentum={false}
          dragElastic={0.06}
          onDrag={dragHandle('end')}
          dragConstraints={trackRef}
          className="absolute top-0 bottom-0 z-10 flex items-center justify-center cursor-ew-resize"
          style={{ left: `calc(${trimEnd}% - 7px)`, width: 14 }}
        >
          <div className="w-[6px] h-10 rounded-sm" style={{ background: apexColor, boxShadow: `0 0 8px ${apexColor}` }} />
        </motion.div>
      </div>
    </div>
  );
}
