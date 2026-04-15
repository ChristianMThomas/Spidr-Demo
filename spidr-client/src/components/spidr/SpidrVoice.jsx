import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Activity } from 'lucide-react';

// Spidr AI Voice Synthesizer — "Soft Venom" voice
// Uses Web Speech API + Web Audio API for pitch-shifted, layered, deep voice

const VOICE_CONFIG = {
  rate: 0.95,       // Natural conversational pace
  pitch: 0.9,       // Young male range — warm, not robotic
  volume: 1.0,
};

export function useSpidrVoice() {
  const audioCtxRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const speak = useCallback((text) => {
    if (isMuted || !text || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Pick a natural young male voice — friendly, not robotic
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => 
      /aaron|reed|evan|tom|samantha|alex|junior/i.test(v.name) && v.lang.startsWith('en')
    ) || voices.find(v => 
      /daniel|james|guy|david|mark/i.test(v.name) && v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en-US'))
      || voices.find(v => v.lang.startsWith('en'));

    if (preferred) utterance.voice = preferred;

    utterance.rate = VOICE_CONFIG.rate;
    utterance.pitch = VOICE_CONFIG.pitch;
    utterance.volume = VOICE_CONFIG.volume;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setIsMuted(prev => !prev);
  }, [isSpeaking]);

  // Preload voices + strict cleanup
  useEffect(() => {
    window.speechSynthesis.getVoices();
    const handleVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    };
  }, []);

  // Close AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  return { speak, stop, isSpeaking, isMuted, toggleMute };
}

// Visual waveform component showing when AI is speaking
export default function SpidrVoiceVisualizer({ isSpeaking }) {
  return (
    <AnimatePresence>
      {isSpeaking && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex items-center gap-1 h-6"
        >
          {[...Array(7)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                height: ['30%', '100%', '30%'],
                opacity: [0.6, 1, 0.6]
              }}
              transition={{
                repeat: Infinity,
                duration: 0.6 + (i * 0.08),
                ease: 'easeInOut',
                delay: i * 0.07,
              }}
              className="w-1 rounded-full"
              style={{
                background: `linear-gradient(to top, #FF3333, ${i % 2 === 0 ? '#9333ea' : '#FF3333'})`,
                boxShadow: '0 0 6px rgba(255,51,51,0.4)',
                minHeight: '3px',
              }}
            />
          ))}
          <span className="text-[9px] font-bold text-[#FF3333] ml-1.5 uppercase tracking-wider animate-pulse flex items-center gap-1">
            <Activity size={9} />
            VOICE
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}