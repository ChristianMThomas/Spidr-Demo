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
  const keepAliveRef = useRef(null);
  const primedRef = useRef(false);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  // Resolve once the browser has actually populated its voice list. getVoices()
  // is async on first call (esp. in Electron/Chromium) and returns [] until the
  // 'voiceschanged' event fires — calling speak() in that window produces
  // silence, which is the core "can't hear Spidr AI" symptom. We wait (with a
  // short timeout so we never hang) before speaking.
  const waitForVoices = useCallback(() => new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve([]);
    const existing = synth.getVoices();
    if (existing && existing.length) return resolve(existing);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.('voiceschanged', onChange);
      resolve(synth.getVoices() || []);
    };
    const onChange = () => finish();
    synth.addEventListener?.('voiceschanged', onChange);
    // Fallback: some engines never emit the event — poll a few times, then give
    // up and speak with the default voice anyway (better than silence).
    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if ((synth.getVoices() || []).length || tries > 10) { clearInterval(poll); finish(); }
    }, 150);
  }), []);

  const pickVoice = useCallback((voices) => {
    if (!voices || !voices.length) return null;
    return voices.find(v =>
      /aaron|reed|evan|tom|samantha|alex|junior/i.test(v.name) && v.lang.startsWith('en')
    ) || voices.find(v =>
      /daniel|james|guy|david|mark/i.test(v.name) && v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en-US'))
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0];
  }, []);

  const speak = useCallback(async (text) => {
    const synth = window.speechSynthesis;
    if (isMuted || !text || !synth) return;

    // Browsers gate audio behind a user gesture. invokeSpidrAI is triggered by
    // a click so we're usually fine, but resume the AudioContext + speech queue
    // defensively (Chrome sometimes leaves the queue paused).
    try { getAudioContext()?.resume?.(); } catch {}
    try { synth.resume(); } catch {}

    const voices = await waitForVoices();
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const preferred = pickVoice(voices);
    if (preferred) utterance.voice = preferred;
    utterance.rate = VOICE_CONFIG.rate;
    utterance.pitch = VOICE_CONFIG.pitch;
    utterance.volume = VOICE_CONFIG.volume;

    utterance.onstart = () => {
      setIsSpeaking(true);
      // Chrome silently stops long utterances after ~15s unless nudged. Cheap
      // insurance: tick resume() while speaking. Harmless for short replies.
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      keepAliveRef.current = setInterval(() => {
        try { if (synth.speaking) synth.resume(); } catch {}
      }, 10000);
    };
    const clearKeepAlive = () => { if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; } };
    utterance.onend = () => { setIsSpeaking(false); clearKeepAlive(); };
    utterance.onerror = () => { setIsSpeaking(false); clearKeepAlive(); };

    synth.speak(utterance);
  }, [isMuted, getAudioContext, waitForVoices, pickVoice]);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    setIsSpeaking(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setIsMuted(prev => !prev);
  }, [isSpeaking]);

  // Preload voices + a one-time "audio unlock" on the first user gesture so the
  // browser's autoplay policy is satisfied before Spidr AI ever tries to speak.
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices();
    const handleVoicesChanged = () => synth.getVoices();
    synth.addEventListener?.('voiceschanged', handleVoicesChanged);

    const prime = () => {
      if (primedRef.current) return;
      primedRef.current = true;
      try { getAudioContext()?.resume?.(); } catch {}
      try {
        synth.resume();
        // A near-silent priming utterance unlocks the TTS pipeline.
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        synth.speak(u);
      } catch {}
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
    window.addEventListener('pointerdown', prime);
    window.addEventListener('keydown', prime);

    return () => {
      synth.removeEventListener?.('voiceschanged', handleVoicesChanged);
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
      synth.cancel();
      if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
      setIsSpeaking(false);
    };
  }, [getAudioContext]);

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