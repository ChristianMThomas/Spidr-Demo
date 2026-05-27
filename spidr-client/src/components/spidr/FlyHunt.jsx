import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playSound } from './SoundEngine';

export default function FlyHunt({ onCatch, userName }) {
  const [fly, setFly] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const spawner = setInterval(() => {
      if (Math.random() > 0.85 && !fly) {
        spawnFly();
      }
    }, 20000);

    return () => clearInterval(spawner);
  }, [fly]);

  const spawnFly = () => {
    setFly({
      id: Date.now(),
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
    });
    playSound('notification');
  };

  const handleCatch = () => {
    if (!fly) return;
    onCatch(userName);
    setFly(null);
    playSound('toggle');
  };

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden z-[50]">
      <AnimatePresence>
        {fly && (
          <motion.button
            key={fly.id}
            initial={{ x: '-50px', y: `${fly.y}%` }}
            animate={{ 
              x: ['0%', '100%', '50%', '110%'],
              y: [`${fly.y}%`, `${fly.y - 20}%`, `${fly.y + 20}%`, `${fly.y}%`],
              rotate: [0, 10, -10, 0]
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 5, ease: 'linear' }}
            onAnimationComplete={() => setFly(null)}
            onClick={handleCatch}
            className="absolute w-8 h-8 pointer-events-auto cursor-crosshair group"
            style={{ top: 0, left: 0 }}
          >
            <div className="w-full h-full relative animate-bounce">
              <div className="absolute inset-0 bg-black rounded-full border border-white/20 shadow-[0_0_10px_#00ff00] group-hover:shadow-[0_0_15px_#FF3333] transition-shadow"></div>
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-white/50 rounded-full animate-pulse" />
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '75ms' }} />
              <div className="absolute top-1 left-1 w-2 h-2 bg-[#FF3333] rounded-full" />
              <div className="absolute top-1 right-1 w-2 h-2 bg-[#FF3333] rounded-full" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}