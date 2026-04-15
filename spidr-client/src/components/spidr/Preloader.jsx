import React, { useState, useEffect } from 'react';
import SpiderLogo from '@/components/spidr/SpiderLogo';
import { motion, AnimatePresence } from 'framer-motion';

export default function Preloader({ onComplete }) {
  const [animationStage, setAnimationStage] = useState(0);

  useEffect(() => {
    // Stage 1: Initial hang (0-0.5s)
    const stage1 = setTimeout(() => setAnimationStage(1), 500);
    
    // Stage 2: Start descent (0.5-2.0s)
    const stage2 = setTimeout(() => setAnimationStage(2), 500);
    
    // Stage 3: Landing (2.0-2.5s)
    const stage3 = setTimeout(() => setAnimationStage(3), 2000);
    
    // Hold (2.5-3.5s)
    const stage4 = setTimeout(() => setAnimationStage(4), 3500);
    
    // Fade out and complete (3.5-4.0s)
    const complete = setTimeout(() => {
      onComplete?.();
    }, 4000);

    return () => {
      clearTimeout(stage1);
      clearTimeout(stage2);
      clearTimeout(stage3);
      clearTimeout(stage4);
      clearTimeout(complete);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {animationStage < 4 && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-50 bg-[#111111] flex items-center justify-center overflow-hidden"
        >
          {/* Web Thread */}
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 bg-gradient-to-b from-[#FF3333] to-transparent origin-top"
            initial={{ height: 0 }}
            animate={{
              height: animationStage >= 1 ? '50%' : 0,
              opacity: animationStage >= 1 ? 1 : 0
            }}
            transition={{
              duration: animationStage >= 1 ? 1.5 : 0,
              ease: 'easeInOut'
            }}
            style={{
              boxShadow: '0 0 10px #FF3333, 0 0 20px #FF3333'
            }}
          />

          {/* Spider */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2"
            initial={{ y: -100 }}
            animate={{
              y: animationStage >= 2 ? 'calc(50vh - 100px)' : 0,
              x: '-50%'
            }}
            transition={{
              y: {
                duration: 1.5,
                ease: 'easeInOut',
                delay: animationStage >= 2 ? 0 : 0
              }
            }}
          >
            {/* Pendulum sway animation for stage 0-1 */}
            <motion.div
              animate={animationStage < 2 ? {
                rotate: [-2, 2, -2],
              } : { rotate: 0 }}
              transition={{
                duration: 1,
                repeat: animationStage < 2 ? Infinity : 0,
                ease: 'easeInOut'
              }}
            >
              <SpiderLogo size={40} />
            </motion.div>
          </motion.div>

          {/* App Logo */}
          <motion.div
            className="relative"
            animate={animationStage === 3 ? {
              scaleY: [1, 0.92, 1.02, 1],
              scaleX: [1, 1.05, 0.98, 1]
            } : {}}
            transition={{
              duration: 0.5,
              times: [0, 0.3, 0.7, 1],
              ease: 'easeOut'
            }}
          >
            <h1 
              className="text-7xl font-black tracking-wider select-none"
              style={{
                color: '#000000',
                textShadow: `
                  -2px -2px 0 #FF3333,
                  2px -2px 0 #FF3333,
                  -2px 2px 0 #FF3333,
                  2px 2px 0 #FF3333,
                  0 0 20px rgba(255, 51, 51, 0.5),
                  0 0 40px rgba(255, 51, 51, 0.3)
                `,
                WebkitTextStroke: '2px #FF3333'
              }}
            >
              SPIDR
            </h1>
          </motion.div>

          {/* Subtle web pattern background */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="web-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                  <circle cx="50" cy="50" r="1" fill="#FF3333" />
                  <line x1="50" y1="50" x2="80" y2="30" stroke="#FF3333" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="20" y2="30" stroke="#FF3333" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="80" y2="70" stroke="#FF3333" strokeWidth="0.5" />
                  <line x1="50" y1="50" x2="20" y2="70" stroke="#FF3333" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#web-pattern)" />
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}