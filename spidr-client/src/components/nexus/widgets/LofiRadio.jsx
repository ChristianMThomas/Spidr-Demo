import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ExternalLink, Play, Square, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

// Curated lofi / chill stations via Radio Browser API (free, no key)
const STATION_TAGS = ['lofi', 'lo-fi', 'chillhop'];

async function fetchLofiStations() {
  // Try tags in order until we get results
  for (const tag of STATION_TAGS) {
    const res = await fetch(
      `https://de1.api.radio-browser.info/json/stations/bytag/${encodeURIComponent(tag)}` +
      `?limit=8&order=votes&reverse=true&hidebroken=true&codec=MP3`
    );
    if (!res.ok) continue;
    const data = await res.json();
    const valid = data.filter(s => s.url_resolved && s.name);
    if (valid.length >= 2) return valid.slice(0, 6);
  }
  throw new Error('No stations found');
}

function Waveform({ playing }) {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {Array.from({ length: 10 }, (_, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ background: 'linear-gradient(to top, #a855f7, #7c3aed)' }}
          animate={playing
            ? { height: ['25%', `${35 + Math.sin(i * 0.9) * 40 + 25}%`, '25%'] }
            : { height: '25%' }
          }
          transition={playing
            ? { duration: 0.9 + i * 0.07, repeat: Infinity, ease: 'easeInOut', delay: i * 0.05 }
            : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}

export default function LofiRadio() {
  const [playing, setPlaying]       = useState(false);
  const [stationIdx, setStationIdx] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  const { data: stations = [], isLoading, isError } = useQuery({
    queryKey: ['lofi-stations'],
    queryFn:  fetchLofiStations,
    staleTime: 60 * 60 * 1000, // 1 hour — station list doesn't change often
    retry: 2,
  });

  const station = stations[stationIdx] ?? null;

  // Sync audio element with play/stop state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !station) return;

    setAudioError(false);

    if (playing) {
      audio.src = station.url_resolved;
      audio.play().catch(() => setAudioError(true));
    } else {
      audio.pause();
      audio.src = '';
    }
  }, [playing, station]);

  // Stop when unmounted
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  function togglePlay() {
    if (!station) return;
    setAudioError(false);
    setPlaying(p => !p);
  }

  function prevStation() {
    setPlaying(false);
    setStationIdx(i => (i - 1 + stations.length) % stations.length);
  }

  function nextStation() {
    setPlaying(false);
    setStationIdx(i => (i + 1) % stations.length);
  }

  const stationName = station?.name?.trim() ?? '—';
  const stationCountry = station?.country ? ` · ${station.country}` : '';

  return (
    <div
      className="bg-[#0a0a0f] border border-purple-500/25 rounded-xl overflow-hidden relative"
      style={{ boxShadow: '0 0 24px rgba(168,85,247,0.08)' }}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onError={() => { setAudioError(true); setPlaying(false); }}
      />

      {/* Ambient top glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.07) 0%, transparent 65%)' }}
      />

      <div className="relative z-10 p-4 flex flex-col gap-3">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio size={12} className="text-purple-400 shrink-0" />
            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Lo-fi Radio</span>
            {playing && !audioError && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[8px] text-red-400 font-mono uppercase tracking-wider">Live</span>
              </span>
            )}
          </div>
          {station?.homepage && (
            <a
              href={station.homepage}
              target="_blank"
              rel="noreferrer"
              className="text-gray-600 hover:text-purple-400 transition-colors"
              title="Station homepage"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>

        {/* ── Vinyl + track info ── */}
        <div className="flex items-center gap-4">

          {/* Spinning vinyl */}
          <div className="relative shrink-0">
            <motion.div
              className="w-14 h-14 rounded-full cursor-pointer select-none"
              style={{
                background: 'radial-gradient(circle at 40% 40%, #4c1d95, #1e1b4b 60%, #0a0a0a)',
                boxShadow: playing && !audioError
                  ? '0 0 28px rgba(168,85,247,0.55)'
                  : '0 0 12px rgba(168,85,247,0.2)',
              }}
              animate={{ rotate: playing && !audioError ? 360 : 0 }}
              transition={playing && !audioError
                ? { duration: 4, repeat: Infinity, ease: 'linear' }
                : { duration: 0.4, ease: 'easeOut' }
              }
              onClick={isLoading ? undefined : togglePlay}
              title={playing ? 'Stop' : 'Play'}
            >
              {[20, 28, 36].map(r => (
                <div
                  key={r}
                  className="absolute rounded-full border border-white/5"
                  style={{ inset: `${(56 - r * 2) / 2}px` }}
                />
              ))}
              <div className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-[#0a0a0a] border border-purple-500/40 flex items-center justify-center">
                {isLoading
                  ? <Loader2 size={6} className="text-purple-400 animate-spin" />
                  : playing
                    ? <Square size={5} className="text-purple-400 fill-purple-400" />
                    : <Play   size={6} className="text-purple-400 ml-0.5" />
                }
              </div>
            </motion.div>

            {/* Tonearm */}
            <motion.div
              className="absolute w-0.5 h-8 rounded-full origin-bottom"
              style={{
                background: 'linear-gradient(to top, rgba(168,85,247,0.6), rgba(168,85,247,0.15))',
                top: -8, right: 0,
              }}
              animate={{ rotate: playing && !audioError ? -12 : -18 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </div>

          {/* Station info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            {isError ? (
              <div className="flex items-center gap-1.5 text-red-400/70">
                <AlertCircle size={10} />
                <span className="text-[9px] font-mono">Couldn't load stations</span>
              </div>
            ) : isLoading ? (
              <span className="text-[9px] text-gray-500 font-mono">Loading stations…</span>
            ) : (
              <>
                <div className="text-[11px] font-bold text-white truncate">{stationName}</div>
                <div className="text-[9px] text-purple-400/70 font-mono uppercase tracking-wider">
                  {audioError
                    ? 'Stream unavailable — try next'
                    : playing
                      ? `Streaming${stationCountry}`
                      : 'Click vinyl to play'
                  }
                </div>
                <Waveform playing={playing && !audioError} />
              </>
            )}
          </div>
        </div>

        {/* ── Station selector ── */}
        {stations.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevStation}
              className="p-1 rounded-md border border-white/10 bg-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors"
            >
              <ChevronLeft size={10} />
            </button>

            <div className="flex-1 flex gap-1 overflow-hidden">
              {stations.map((s, i) => (
                <button
                  key={s.stationuuid || i}
                  onClick={() => { setPlaying(false); setStationIdx(i); }}
                  className={`flex-1 min-w-0 text-[7px] font-bold uppercase tracking-wide py-1 px-1 rounded-md border transition-colors truncate ${
                    stationIdx === i
                      ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                      : 'border-white/10 bg-white/5 text-gray-600 hover:text-gray-300 hover:border-white/20'
                  }`}
                  title={s.name}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={nextStation}
              className="p-1 rounded-md border border-white/10 bg-white/5 text-gray-500 hover:text-gray-300 hover:border-white/20 transition-colors"
            >
              <ChevronRight size={10} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
