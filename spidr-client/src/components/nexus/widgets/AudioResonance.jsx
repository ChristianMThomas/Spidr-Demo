import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music, Play, Pause } from 'lucide-react';

// 140 BPM trap beat — 16 steps (16th notes)
const BPM = 140;
const STEP_MS = (60 / BPM / 4) * 1000;   // length of one 16th note in ms
const STEP_S  = STEP_MS / 1000;

const KICK_PATTERN  = [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,1,0];
const SNARE_PATTERN = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
const HIHAT_PATTERN = [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1];

function playKick(ctx, t) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g); g.connect(ctx.destination);
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.45);
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  osc.start(t); osc.stop(t + 0.45);
}

function playSnare(ctx, t) {
  const size = Math.floor(ctx.sampleRate * 0.18);
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const flt = ctx.createBiquadFilter();
  flt.type = 'bandpass'; flt.frequency.value = 3500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(flt); flt.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.18);
}

function playHiHat(ctx, t) {
  const size = Math.floor(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const flt = ctx.createBiquadFilter();
  flt.type = 'highpass'; flt.frequency.value = 9000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(flt); flt.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.04);
}

export default function AudioResonance() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);

  const ctxRef       = useRef(null);
  const schedulerRef = useRef(null);
  const nextTimeRef  = useRef(0);
  const stepRef      = useRef(0);

  // Stable random bar durations for visualizer
  const barDurations = useMemo(
    () => Array.from({ length: 16 }, () => Math.random() * 0.35 + 0.2),
    []
  );

  function schedule() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    while (nextTimeRef.current < ctx.currentTime + 0.12) {
      const s = stepRef.current % 16;
      const t = nextTimeRef.current;
      if (KICK_PATTERN[s])  playKick(ctx, t);
      if (SNARE_PATTERN[s]) playSnare(ctx, t);
      if (HIHAT_PATTERN[s]) playHiHat(ctx, t);
      setActiveStep(s);
      nextTimeRef.current += STEP_S;
      stepRef.current++;
    }
  }

  const start = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;
    nextTimeRef.current = ctx.currentTime + 0.05;
    stepRef.current = 0;
    schedulerRef.current = setInterval(schedule, 20);
    setIsPlaying(true);
  };

  const stop = () => {
    clearInterval(schedulerRef.current);
    ctxRef.current?.close();
    ctxRef.current = null;
    setIsPlaying(false);
    setActiveStep(-1);
  };

  // Cleanup on unmount
  useEffect(() => () => { clearInterval(schedulerRef.current); ctxRef.current?.close(); }, []);

  return (
    <div className="bg-[#0a0a0a] border border-[#FF3333]/30 rounded-xl p-4 relative overflow-hidden shadow-[0_0_20px_rgba(255,51,51,0.1)]">
      <div className="flex items-center gap-2 mb-3 text-[#FF3333]">
        <Music size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest">Resonance Feed</span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={isPlaying ? stop : start}
          className="w-12 h-12 flex-shrink-0 bg-[#111] border border-[#FF3333]/50 rounded-full flex items-center justify-center text-white hover:bg-[#FF3333]/20 transition-colors relative"
        >
          <motion.div
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="absolute inset-1 border border-dashed border-[#FF3333]/50 rounded-full"
          />
          {isPlaying
            ? <Pause size={16} fill="currentColor" />
            : <Play  size={16} fill="currentColor" className="ml-1" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-white truncate">SPIDER-MAN THEME (TRAP REMIX)</div>
          <div className="text-[10px] text-gray-500 font-mono">Metro Boomin</div>

          <div className="flex items-end gap-0.5 h-4 mt-2">
            {barDurations.map((dur, i) => {
              const isActive = isPlaying && (
                KICK_PATTERN[activeStep]  && i % 4 === 0 ||
                SNARE_PATTERN[activeStep] && i % 8 === 4 ||
                HIHAT_PATTERN[activeStep]
              );
              return (
                <motion.div
                  key={i}
                  animate={{ height: isPlaying ? (isActive ? '100%' : ['30%', '80%', '30%']) : '10%' }}
                  transition={{ repeat: isPlaying ? Infinity : 0, duration: dur, delay: i * 0.015 }}
                  className={`flex-1 rounded-t-sm transition-colors ${
                    i === activeStep % 16
                      ? 'bg-white'
                      : 'bg-gradient-to-t from-[#FF3333] to-purple-500'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
