import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WelcomeOverlay({ currentUser, onComplete }) {
  const [animationStage, setAnimationStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setAnimationStage(1), 500);
    const timer2 = setTimeout(() => setAnimationStage(2), 1500);
    const timer3 = setTimeout(() => setAnimationStage(3), 2500);
    const timer4 = setTimeout(() => onComplete(), 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-[#111111] flex flex-col items-center justify-center"
      >
        {/* Glitch Effect - subtle red flash instead of white */}
        {animationStage === 3 && (
          <motion.div
            className="absolute inset-0 bg-red-600"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.05, 0, 0.08, 0],
            }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Web Thread */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-gradient-to-b from-transparent via-red-500/50 to-transparent"
          initial={{ height: 0, top: 0 }}
          animate={{
            height: animationStage >= 2 ? '0px' : 'calc(50vh - 60px)',
            top: animationStage >= 2 ? 'calc(50vh - 60px)' : 0
          }}
          transition={{ duration: 0.5 }}
        />

        {/* Spider */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2"
          initial={{ y: -100 }}
          animate={{
            y: animationStage >= 2 ? -100 : 'calc(50vh - 60px)',
            x: '-50%'
          }}
          transition={{
            y: {
              duration: animationStage >= 2 ? 0.5 : 1.5,
              ease: 'easeInOut'
            }
          }}
        >
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
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698bbf4e09bd37d0bd1c3b99/d6ccaeeb1_MainLogo.png"
              alt="Spidr"
              className="w-24 h-24 drop-shadow-[0_0_20px_#FF3333]"
            />
          </motion.div>
        </motion.div>

        {/* Text */}
        <motion.div
          className="absolute top-[60%] text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: animationStage >= 1 ? 1 : 0 }}
        >
          <motion.p
            className="text-red-500 text-lg font-mono tracking-wider mb-2"
            animate={{
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            CONNECTING TO NEURAL NETWORK...
          </motion.p>
          <motion.p className="text-white text-2xl font-bold">
            Authenticating Identity: <span className="text-red-500">{currentUser?.display_name}#{currentUser?.discriminator || '0000'}</span>
          </motion.p>
        </motion.div>

        {/* Grid Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full" style={{
            backgroundImage: `
              linear-gradient(rgba(255, 51, 51, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 51, 51, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}