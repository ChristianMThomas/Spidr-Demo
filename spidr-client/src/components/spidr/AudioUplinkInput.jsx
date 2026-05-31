import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, X, Loader2, Music } from 'lucide-react';
import { toast } from 'sonner';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const VALID = /(youtube\.com|youtu\.be|spotify\.com|music\.apple\.com)/i;

/**
 * AudioUplinkInput (Patch 2.12) — a secure-socket styled input that intercepts
 * a pasted Spotify / YouTube / Apple Music URL, plays a terminal extraction
 * animation, resolves metadata via the backend /weaver/parse-audio proxy, and
 * hands the parsed track up via onGraft(track).
 */
export default function AudioUplinkInput({ onGraft, grafted, onClear }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('idle'); // idle | extracting | error
  const [lines, setLines] = useState([]);
  const timersRef = useRef([]);

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

  const runExtraction = async (url) => {
    setStatus('extracting');
    setLines([]);
    const steps = [
      '> INTERCEPTING_LINK...',
      '> CONNECTING TO LINKED_NODE...',
      '> FETCHING_METADATA...',
    ];
    steps.forEach((l, i) => {
      timersRef.current.push(setTimeout(() => setLines((p) => [...p, l]), i * 280));
    });

    try {
      const res = await fetch(`${BASE_URL}/weaver/parse-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Parse failed');
      // Let the animation breathe a beat before resolving.
      await new Promise((r) => (timersRef.current.push(setTimeout(r, 850))));
      clearTimers();
      setStatus('idle');
      setValue('');
      setLines([]);
      onGraft?.(data);
      toast.success('Audio grafted to the grid');
    } catch (e) {
      clearTimers();
      setStatus('error');
      setLines((p) => [...p, `> ERROR: ${e.message || 'NODE_UNREACHABLE'}`]);
      timersRef.current.push(setTimeout(() => { setStatus('idle'); setLines([]); }, 2200));
    }
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    if (VALID.test(v) && status === 'idle') runExtraction(v.trim());
  };

  if (grafted) {
    return (
      <div className="flex items-center gap-2 bg-black/60 border border-[#FF3333]/30 rounded-lg p-2 font-mono">
        {grafted.thumbnail
          ? <img src={grafted.thumbnail} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
          : <div className="w-8 h-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0"><Music size={14} className="text-zinc-500" /></div>}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-green-300 truncate">&gt; TRACK: {grafted.title}</div>
          <div className="text-[9px] text-zinc-500 truncate">NODE: {String(grafted.provider || '').replace('_', ' ')}_API</div>
        </div>
        <button onClick={onClear} className="text-zinc-500 hover:text-white shrink-0"><X size={14} /></button>
      </div>
    );
  }

  return (
    <div className="font-mono">
      <div className={`flex items-center gap-2 bg-black/70 border rounded-lg px-3 py-2 transition-colors ${status === 'error' ? 'border-red-500/60' : 'border-[#FF3333]/30 focus-within:border-[#FF3333]/60'}`}>
        <Link2 size={14} className="text-[#FF3333] shrink-0" />
        <span className="text-[#FF3333] text-xs select-none shrink-0">GRAFT AUDIO SOURCE:</span>
        <input
          value={value}
          onChange={handleChange}
          disabled={status === 'extracting'}
          placeholder="_"
          className="bg-transparent border-0 outline-none text-green-300 text-xs flex-1 min-w-0 placeholder:text-green-300/30"
        />
        {status === 'extracting' && <Loader2 size={14} className="text-[#FF3333] animate-spin shrink-0" />}
      </div>

      <AnimatePresence>
        {lines.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 bg-black/50 rounded-md px-3 py-2 overflow-hidden"
          >
            {lines.map((l, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-[10px] tracking-widest ${l.startsWith('> ERROR') ? 'text-red-400' : 'text-green-400/80'}`}
              >
                {l}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
