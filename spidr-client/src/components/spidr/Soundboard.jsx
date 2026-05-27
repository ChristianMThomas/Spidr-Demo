import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Play, Loader2, Volume2, Sparkles, Upload, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { integrations } from '@/api/apiClient';
import {
  SOUND_EFFECTS, playEffect, playUrl,
  VOICE_FILTERS, renderVoiceFilter, blobToAudioBuffer,
} from '@/lib/soundboardEngine';

const CUSTOM_SOUNDS_KEY = 'spidr_custom_sounds';

/**
 * Soundboard — Spidr's Web Audio soundboard + voice-filter lab.
 *
 * Two sections:
 *   • Sound FX grid: tap to fire a synthesized effect (no audio files).
 *   • Voice Filter lab: record a short mic clip, pick a filter (chipmunk, deep,
 *     robot, cavern reverb, alien), and play back the filtered render.
 *
 * All audio is offline / local — this does NOT touch the live WebRTC voice
 * track, so it can't destabilize calls. Mic recording asks for permission only
 * when the user presses record.
 */
export default function Soundboard() {
  const [recording, setRecording] = useState(false);
  const [recordedBuffer, setRecordedBuffer] = useState(null);
  const [filter, setFilter] = useState('none');
  const [rendering, setRendering] = useState(false);
  const [resultUrl, setResultUrl] = useState(null);
  const [activeFx, setActiveFx] = useState(null);
  const [customSounds, setCustomSounds] = useState([]); // [{ id, label, url }]
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioElRef = useRef(null);
  const recordTimerRef = useRef(null);
  const uploadInputRef = useRef(null);

  // Load saved custom sounds (URLs persist; files live on the server).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SOUNDS_KEY);
      if (raw) setCustomSounds(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persistCustom = (next) => {
    setCustomSounds(next);
    try { localStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const handleUploadSound = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('Please choose an audio file.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Sound must be under 2 MB.'); return; }
    setUploading(true);
    try {
      const { url } = await integrations.Core.UploadFile({ file });
      if (!url) throw new Error('no url');
      const label = (file.name || 'Sound').replace(/\.[^.]+$/, '').slice(0, 16);
      const next = [...customSounds, { id: `c_${Date.now()}`, label, url }].slice(-24); // cap 24
      persistCustom(next);
      toast.success('Sound added to your board!');
    } catch {
      toast.error('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeCustom = (id) => {
    persistCustom(customSounds.filter((s) => s.id !== id));
  };

  useEffect(() => () => {
    // Cleanup on unmount: stop any active stream + revoke blob URL.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
  }, [resultUrl]);

  const fireFx = (id) => {
    playEffect(id);
    setActiveFx(id);
    setTimeout(() => setActiveFx((cur) => (cur === id ? null : cur)), 350);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const buf = await blobToAudioBuffer(blob);
        if (buf) {
          setRecordedBuffer(buf);
          toast.success('Recorded! Pick a filter and play it back.');
        } else {
          toast.error('Could not decode recording.');
        }
      };
      mr.start();
      setRecording(true);
      // Safety cap: auto-stop after 8s.
      recordTimerRef.current = setTimeout(() => stopRecording(), 8000);
    } catch {
      toast.error('Microphone access denied.');
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) { clearTimeout(recordTimerRef.current); recordTimerRef.current = null; }
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    setRecording(false);
  };

  const playFiltered = async () => {
    if (!recordedBuffer) return;
    setRendering(true);
    try {
      if (resultUrl) { URL.revokeObjectURL(resultUrl); setResultUrl(null); }
      const blob = await renderVoiceFilter(recordedBuffer, filter);
      if (!blob) { toast.error('Filter rendering unavailable in this browser.'); return; }
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      // Play it.
      setTimeout(() => { audioElRef.current?.play?.().catch(() => {}); }, 50);
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Sound FX ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Volume2 className="w-4 h-4 text-[#FF3333]" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sound FX</h3>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SOUND_EFFECTS.map((fx) => (
            <motion.button
              key={fx.id}
              onClick={() => fireFx(fx.id)}
              whileTap={{ scale: 0.9 }}
              animate={activeFx === fx.id ? { scale: [1, 1.08, 1] } : {}}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border transition-colors ${
                activeFx === fx.id
                  ? 'bg-[#FF3333]/20 border-[#FF3333]/60'
                  : 'bg-zinc-900/70 border-white/10 hover:border-[#FF3333]/40 hover:bg-zinc-800/70'
              }`}
            >
              <span className="text-2xl leading-none">{fx.emoji}</span>
              <span className="text-[10px] font-semibold text-zinc-300">{fx.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ── My Sounds (uploads) ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#FF3333]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">My Sounds</h3>
          </div>
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FF3333]/15 hover:bg-[#FF3333]/25 border border-[#FF3333]/40 text-[#ff6b6b] text-xs font-bold transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading…' : 'Add Sound'}
          </button>
          <input ref={uploadInputRef} type="file" accept="audio/*" className="hidden" onChange={handleUploadSound} />
        </div>

        {customSounds.length === 0 ? (
          <p className="text-xs text-zinc-600 bg-zinc-900/50 border border-white/5 rounded-xl p-3 text-center">
            Upload your own sound clips (under 2 MB) to play them here.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {customSounds.map((s) => (
              <div key={s.id} className="relative group">
                <motion.button
                  onClick={() => playUrl(s.url)}
                  whileTap={{ scale: 0.9 }}
                  className="w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 border bg-zinc-900/70 border-white/10 hover:border-[#FF3333]/40 hover:bg-zinc-800/70 transition-colors p-1"
                  title={s.label}
                >
                  <Volume2 className="w-5 h-5 text-[#FF3333]" />
                  <span className="text-[9px] font-semibold text-zinc-300 truncate w-full text-center px-0.5">{s.label}</span>
                </motion.button>
                <button
                  onClick={() => removeCustom(s.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Voice Filter Lab ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#FF3333]" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Voice Filter Lab</h3>
        </div>

        <div className="rounded-2xl bg-zinc-900/70 border border-white/10 p-4 space-y-4">
          {/* Record control */}
          <div className="flex items-center gap-3">
            {!recording ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-4 h-11 rounded-xl bg-[#FF3333] hover:bg-[#ff4d4d] text-white font-bold transition-colors"
              >
                <Mic className="w-4 h-4" /> Record
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 h-11 rounded-xl bg-red-700 text-white font-bold animate-pulse"
              >
                <Square className="w-4 h-4 fill-white" /> Stop
              </button>
            )}
            <p className="text-xs text-zinc-500">
              {recording ? 'Recording… (auto-stops at 8s)'
                : recordedBuffer ? 'Clip ready — pick a filter below.'
                : 'Record a short clip to filter your voice.'}
            </p>
          </div>

          {/* Filter chooser */}
          <div className="grid grid-cols-3 gap-2">
            {VOICE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                disabled={!recordedBuffer}
                className={`px-2 py-2.5 rounded-xl text-left border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  filter === f.id
                    ? 'bg-[#FF3333]/15 border-[#FF3333]/50'
                    : 'bg-black/40 border-white/5 hover:border-white/20'
                }`}
              >
                <span className="text-lg">{f.emoji}</span>
                <p className="text-[11px] font-bold text-white mt-0.5">{f.label}</p>
              </button>
            ))}
          </div>

          {/* Play filtered */}
          <div className="flex items-center gap-3">
            <button
              onClick={playFiltered}
              disabled={!recordedBuffer || rendering}
              className="flex items-center gap-2 px-4 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {rendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {rendering ? 'Rendering…' : 'Play Filtered'}
            </button>
            {resultUrl && (
              <audio ref={audioElRef} src={resultUrl} controls className="h-9 flex-1 min-w-0" />
            )}
          </div>
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">
          Filters render locally and don't affect live calls — this is your personal voice lab.
        </p>
      </section>
    </div>
  );
}
