import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useMedia } from '@/context/MediaContext';

/**
 * ImageLightboxOverlay (Patch 2.9) — the full-screen "Void" image viewer.
 * Mounted once at the shell root (z-[999]) so it's never clipped by chat
 * overflow containers. Uses framer-motion shared layout (matching layoutId)
 * so the image flies from its chat thumbnail to center screen and back.
 */
export default function ImageLightboxOverlay() {
  const { expandedImage, closeImage } = useMedia();
  const [showHud, setShowHud] = useState(false);

  // Fade the terminal HUD in shortly AFTER the expand motion settles.
  useEffect(() => {
    if (!expandedImage) { setShowHud(false); return; }
    const t = setTimeout(() => setShowHud(true), 320);
    return () => clearTimeout(t);
  }, [expandedImage]);

  // Esc to close.
  useEffect(() => {
    if (!expandedImage) return;
    const onKey = (e) => { if (e.key === 'Escape') closeImage(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedImage, closeImage]);

  const apex = expandedImage?.apexColor && expandedImage.apexColor !== '#3f3f46'
    ? expandedImage.apexColor : '#FF3333';

  return (
    <AnimatePresence>
      {expandedImage && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeImage}
          className="fixed inset-0 z-[999] bg-[#050505]/95 backdrop-blur-xl flex items-center justify-center p-6"
        >
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); closeImage(); }}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>

          {/* The expanding image — same layoutId as the thumbnail so framer
              animates it flying from the chat block to center. Drag up/down to
              dismiss with elastic physics. */}
          <motion.img
            layoutId={expandedImage.id}
            src={expandedImage.src}
            alt={expandedImage.name || 'image'}
            onClick={(e) => e.stopPropagation()}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.8}
            onDragEnd={(e, info) => {
              // Pulled hard enough (offset or velocity) → dismiss.
              if (Math.abs(info.offset.y) > 140 || Math.abs(info.velocity.y) > 600) {
                closeImage();
              }
            }}
            className="max-w-[92vw] max-h-[82vh] object-contain rounded-xl shadow-2xl cursor-grab active:cursor-grabbing"
            style={{ boxShadow: `0 0 60px ${apex}22` }}
          />

          {/* Terminal metadata footer — fades in after the expand settles. */}
          <AnimatePresence>
            {showHud && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest text-gray-400 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg px-4 py-2 whitespace-nowrap max-w-[92vw] overflow-hidden text-ellipsis"
              >
                <span className="text-gray-600">&gt; SRC:</span>{' '}
                <span style={{ color: apex }}>{expandedImage.senderName || 'unknown'}</span>
                {expandedImage.resolution && (
                  <>
                    <span className="text-gray-600"> // RES:</span> {expandedImage.resolution}
                  </>
                )}
                {expandedImage.size && (
                  <>
                    <span className="text-gray-600"> // SIZE:</span> {expandedImage.size}
                  </>
                )}
                <span className="text-gray-600"> // </span>
                <span className="text-gray-500">drag to dismiss</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
