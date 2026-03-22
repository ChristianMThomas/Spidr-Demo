import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Play, Heart, Pencil, Trash2 } from 'lucide-react';

function getRatioStyle(ratio) {
  switch (ratio) {
    case '16:9': return { aspectRatio: '16/9' };
    case '1:1': return { aspectRatio: '1/1' };
    default: return { aspectRatio: '9/16' };
  }
}

function getFilterClass(filter) {
  switch (filter) {
    case 'venom': return 'contrast-125 brightness-110 hue-rotate-90';
    case 'glitch': return 'contrast-150 saturate-200 hue-rotate-15';
    case 'noir': return 'grayscale contrast-125 brightness-90';
    case 'neon': return 'hue-rotate-[280deg] saturate-150 contrast-110';
    case 'heat': return 'sepia contrast-125 saturate-150';
    case 'ice': return 'hue-rotate-180 saturate-75 brightness-110 contrast-110';
    default: return '';
  }
}

export default function PostCard3D({ clip, index, isOwner, onEdit, onDelete, onClick }) {
  const ratio = clip.style?.ratio || clip.meta?.ratio || clip.aspect_ratio || '9:16';
  const filter = clip.style?.filter || clip.meta?.filter || 'none';
  const isWide = ratio === '16:9';

  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 20 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['12deg', '-12deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-12deg', '12deg']);
  const glare = useTransform(mouseXSpring, [-0.5, 0.5], [0, 1]);

  const handleMouseMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`${isWide ? 'col-span-2' : ''}`}
      style={{ perspective: '800px' }}
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative cursor-pointer group"
      >
        {/* Card body */}
        <div
          className="relative rounded-xl overflow-hidden border border-white/10 group-hover:border-[#FF3333]/50 transition-colors shadow-2xl bg-[#111]"
          style={{ ...getRatioStyle(ratio), transform: 'translateZ(20px)' }}
        >
          {clip.thumbnail_url ? (
            <img
              src={clip.thumbnail_url}
              className={`w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 ${getFilterClass(filter)}`}
            />
          ) : clip.video_url ? (
            <video
              src={clip.video_url}
              className={`w-full h-full object-cover ${getFilterClass(filter)}`}
              loop muted playsInline
              onMouseOver={e => e.target.play()}
              onMouseOut={e => { e.target.pause(); e.target.currentTime = 0; }}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center ${getFilterClass(filter)}`}>
              <Play size={24} className="text-zinc-600" />
            </div>
          )}

          {/* Glare overlay */}
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-xl"
            style={{
              opacity: glare,
              background: 'linear-gradient(115deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
            }}
          />

          {/* Bottom info overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
            {clip.caption && (
              <p className="text-white text-xs font-medium mb-1 line-clamp-2">{clip.caption}</p>
            )}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-white text-xs font-bold">
                <Play size={10} fill="currentColor" /> {clip.views || 0}
              </div>
              {clip.likes?.length > 0 && (
                <div className="flex items-center gap-1 text-red-400 text-xs">
                  <Heart size={10} fill="currentColor" /> {clip.likes.length}
                </div>
              )}
            </div>
          </div>

          {/* Owner actions */}
          {isOwner && (onEdit || onDelete) && (
            <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-[#FF3333] transition-colors"
                >
                  <Pencil size={12} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-700 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}