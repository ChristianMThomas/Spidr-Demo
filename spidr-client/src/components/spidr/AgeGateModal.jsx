import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, Fingerprint } from 'lucide-react';

export default function AgeGateModal({ onVerify, onReject }) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval;
    if (holding) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            onVerify();
            return 100;
          }
          return prev + 2;
        });
      }, 20);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [holding, onVerify]);

  return (
    <div className="absolute inset-0 z-50 bg-[#050505]/98 flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg relative"
      >
        <div className="absolute -inset-1 bg-gradient-to-b from-[#FF3333] to-transparent opacity-20 blur-xl" />

        <div className="bg-[#0a0a0a] border border-[#FF3333]/50 rounded-3xl p-8 relative overflow-hidden text-center shadow-2xl">
          <div className="mx-auto w-16 h-16 bg-[#FF3333]/10 rounded-full flex items-center justify-center mb-6 border border-[#FF3333]/30">
            <AlertOctagon className="text-[#FF3333]" size={32} />
          </div>

          <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">
            Restricted Sector
          </h1>

          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            You are entering a community designated for <strong className="text-white">Adults (18+)</strong>.
            <br /><br />
            We do not collect your ID. We rely on your honor.{' '}
            <span className="text-[#FF3333]">Falsifying this signature will result in a permanent platform ban.</span>
          </p>

          <div className="text-left bg-[#111] p-4 rounded-xl border border-white/5 mb-8">
            <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">User Declaration</div>
            <div className="flex gap-3">
              <div className={`mt-1 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${progress > 0 ? 'bg-[#FF3333] border-[#FF3333]' : 'border-gray-600'}`}>
                {progress > 0 && <div className="w-2 h-2 bg-white rounded-sm" />}
              </div>
              <p className="text-xs text-gray-300">
                I certify that I am over the age of 18. I consent to viewing mature content and agree to the Community Guidelines.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onMouseDown={() => setHolding(true)}
              onMouseUp={() => setHolding(false)}
              onMouseLeave={() => setHolding(false)}
              onTouchStart={() => setHolding(true)}
              onTouchEnd={() => setHolding(false)}
              className="relative w-full h-14 bg-[#111] border border-[#FF3333]/30 rounded-xl overflow-hidden select-none"
            >
              <div
                className="absolute inset-0 bg-[#FF3333] transition-none"
                style={{ width: `${progress}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 text-white font-bold text-xs tracking-widest uppercase">
                <Fingerprint size={16} className={holding ? 'animate-pulse' : ''} />
                {holding ? 'VERIFYING SIGNATURE...' : 'HOLD TO SIGN PACT'}
              </div>
            </button>

            <button
              onClick={onReject}
              className="w-full py-3 text-gray-500 text-xs font-bold hover:text-white transition-colors"
            >
              EXIT AND RETURN HOME
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}