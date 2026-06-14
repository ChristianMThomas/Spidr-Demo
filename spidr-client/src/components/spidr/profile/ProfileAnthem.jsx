import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, Upload, X as XIcon } from 'lucide-react';
import { integrations } from '@/api/apiClient';
import { toast } from 'sonner';

/**
 * ProfileAnthem — a sleek frosted-glass music widget that sits under a
 * user's bio. When a visitor opens the profile, the saved track auto-plays
 * (muted by default to satisfy browser autoplay policy — a single click on
 * the volume toggle unmutes). The album art (or a music glyph fallback)
 * acts as play/pause. A hover-revealed volume slider lets the visitor
 * mute the anthem without stopping their own background music.
 *
 * On the OWNER's profile in edit mode, the widget exposes an upload row
 * (track title + audio file) that writes to userProfile.anthem via the
 * onWidgetSave callback BioTab already provides.
 *
 * Expected userProfile.anthem shape:
 *   { title: string, artist?: string, audio_url: string, art_url?: string }
 */
export default function ProfileAnthem({ userProfile, isOwnProfile, onWidgetSave }) {
  const anthem = userProfile?.anthem || null;
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // autoplay-friendly
  const [volume, setVolume] = useState(60);
  const [showVolume, setShowVolume] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftArtist, setDraftArtist] = useState('');

  // ── Autoplay-on-mount ────────────────────────────────────────────────────
  // The track starts the moment the profile opens. Browsers block audible
  // autoplay, so we always start muted; the visitor unmutes with one click.
  // We don't autoplay on the OWNER's own profile because that gets old
  // fast — they edit there often.
  useEffect(() => {
    if (!anthem?.audio_url || isOwnProfile) return;
    const el = audioRef.current;
    if (!el) return;
    el.muted = true;
    el.volume = volume / 100;
    el.play().then(() => setPlaying(true)).catch(() => {
      // Even muted autoplay can fail in some contexts (iOS strict mode);
      // the user can press play manually.
      setPlaying(false);
    });
    return () => {
      try { el.pause(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anthem?.audio_url, isOwnProfile]);

  // Keep audio element in sync with React state.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
    el.volume = volume / 100;
  }, [muted, volume]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    setMuted((m) => !m);
  };

  // ── Owner-side upload ────────────────────────────────────────────────────
  const handleAudioPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) { toast.error('Pick an audio file (.mp3, .m4a, .ogg).'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Anthem must be under 10 MB.'); return; }
    setUploading(true);
    try {
      const { url } = await integrations.Core.UploadFile({ file });
      if (!url) throw new Error('Upload returned no URL');
      onWidgetSave?.('anthem', {
        title: draftTitle || file.name.replace(/\.[^.]+$/, '').slice(0, 60),
        artist: draftArtist || '',
        audio_url: url,
        art_url: anthem?.art_url || '',
      });
      toast.success('Anthem set!');
      setShowEditor(false);
    } catch (err) {
      toast.error('Anthem upload failed — try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleArtPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Art must be under 2 MB.'); return; }
    try {
      const { url } = await integrations.Core.UploadFile({ file });
      if (url) {
        onWidgetSave?.('anthem', { ...(anthem || {}), art_url: url });
        toast.success('Art updated!');
      }
    } catch { toast.error('Art upload failed.'); }
  };

  const clearAnthem = () => {
    onWidgetSave?.('anthem', null);
    toast.success('Anthem cleared.');
    setShowEditor(false);
  };

  // ── Empty state for owner (no anthem set) ────────────────────────────────
  if (!anthem?.audio_url) {
    if (!isOwnProfile) return null; // visitors see nothing; not a flex when empty
    return (
      <>
        <button
          onClick={() => setShowEditor(true)}
          className="w-full p-3 rounded-xl flex items-center gap-3 transition-all hover:scale-[1.01]"
          style={{
            background: 'rgba(168, 85, 247, 0.06)',
            border: '1px dashed rgba(168, 85, 247, 0.30)',
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.30)',
            }}
          >
            <Music size={14} className="text-purple-300" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] font-mono uppercase tracking-widest text-purple-300">Profile Anthem</p>
            <p className="text-xs text-zinc-400">Set a track that plays when people open your profile</p>
          </div>
          <Upload size={14} className="text-zinc-500 flex-shrink-0" />
        </button>
        {showEditor && (
          <AnthemEditor
            anthem={anthem}
            draftTitle={draftTitle}
            draftArtist={draftArtist}
            setDraftTitle={setDraftTitle}
            setDraftArtist={setDraftArtist}
            uploading={uploading}
            onAudioPick={handleAudioPick}
            onArtPick={handleArtPick}
            onClear={clearAnthem}
            onClose={() => setShowEditor(false)}
          />
        )}
      </>
    );
  }

  // ── Active widget ────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="relative p-2.5 rounded-xl flex items-center gap-3 overflow-hidden group"
        style={{
          background: 'rgba(10, 4, 22, 0.65)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(168, 85, 247, 0.22)',
          boxShadow: '0 0 18px rgba(168, 85, 247, 0.10), inset 0 0 12px rgba(168, 85, 247, 0.04)',
        }}
        onMouseEnter={() => setShowVolume(true)}
        onMouseLeave={() => setShowVolume(false)}
      >
        {/* Album art / play-pause toggle */}
        <button
          onClick={toggle}
          className="relative w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center transition-transform hover:scale-105"
          style={{
            background: anthem.art_url ? '#050505' : 'linear-gradient(135deg, #7c3aed, #ec4899)',
          }}
          title={playing ? 'Pause' : 'Play'}
          aria-label={playing ? 'Pause anthem' : 'Play anthem'}
        >
          {anthem.art_url ? (
            <img src={anthem.art_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music size={18} className="text-white" />
          )}
          {/* Hover overlay reveals play/pause glyph */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            {playing
              ? <Pause size={18} className="text-white" fill="white" />
              : <Play size={18} className="text-white ml-0.5" fill="white" />}
          </div>
        </button>

        {/* Title + artist */}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-mono uppercase tracking-widest text-purple-300 mb-0.5 flex items-center gap-1">
            <Music size={9} /> Anthem
          </p>
          <p className="text-white text-xs font-bold truncate">{anthem.title || 'Untitled'}</p>
          {anthem.artist && (
            <p className="text-zinc-500 text-[10px] truncate">{anthem.artist}</p>
          )}
        </div>

        {/* Mute / volume cluster */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showVolume && !muted && (
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 h-1 anthem-slider"
              aria-label="Volume"
            />
          )}
          <button
            onClick={toggleMute}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
            style={{
              background: muted ? 'rgba(239, 68, 68, 0.10)' : 'rgba(255, 255, 255, 0.05)',
              border: muted ? '1px solid rgba(239, 68, 68, 0.30)' : '1px solid rgba(255, 255, 255, 0.10)',
            }}
            title={muted ? 'Unmute' : 'Mute'}
            aria-label={muted ? 'Unmute anthem' : 'Mute anthem'}
          >
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setShowEditor(true)}
              className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 hover:text-purple-300 transition-colors"
              title="Edit anthem"
            >
              Edit
            </button>
          )}
        </div>

        {/* The audio element itself — invisible, controlled by state. */}
        <audio
          ref={audioRef}
          src={anthem.audio_url}
          loop
          preload="metadata"
          onEnded={() => setPlaying(false)}
        />
      </div>

      {showEditor && (
        <AnthemEditor
          anthem={anthem}
          draftTitle={draftTitle}
          draftArtist={draftArtist}
          setDraftTitle={setDraftTitle}
          setDraftArtist={setDraftArtist}
          uploading={uploading}
          onAudioPick={handleAudioPick}
          onArtPick={handleArtPick}
          onClear={clearAnthem}
          onClose={() => setShowEditor(false)}
        />
      )}

      <style>{`
        .anthem-slider { -webkit-appearance: none; appearance: none; border-radius: 999px;
          background: rgba(168, 85, 247, 0.15); outline: none; }
        .anthem-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
          width: 10px; height: 10px; border-radius: 50%;
          background: linear-gradient(135deg, #c084fc, #ec4899); cursor: pointer; }
        .anthem-slider::-moz-range-thumb { width: 10px; height: 10px; border: 0; border-radius: 50%;
          background: linear-gradient(135deg, #c084fc, #ec4899); cursor: pointer; }
      `}</style>
    </>
  );
}

// ── Owner-side editor modal ────────────────────────────────────────────────
function AnthemEditor({
  anthem, draftTitle, draftArtist, setDraftTitle, setDraftArtist, uploading,
  onAudioPick, onArtPick, onClear, onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-[9994] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(10,4,22,0.96), rgba(6,2,18,0.98))',
          border: '1px solid rgba(168, 85, 247, 0.30)',
          boxShadow: '0 0 40px rgba(168, 85, 247, 0.18), 0 24px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.35)' }}
            >
              <Music size={14} className="text-purple-300" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-purple-300">Profile Anthem</p>
              <p className="text-white font-bold text-sm">{anthem?.audio_url ? 'Update your track' : 'Set your track'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1">
            <XIcon size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block">
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">Track title</p>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={anthem?.title || 'e.g. Late Night Hunt'}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50"
              maxLength={60}
            />
          </label>
          <label className="block">
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">Artist (optional)</p>
            <input
              value={draftArtist}
              onChange={(e) => setDraftArtist(e.target.value)}
              placeholder={anthem?.artist || 'e.g. Symbiote'}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-purple-500/50"
              maxLength={60}
            />
          </label>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label className="cursor-pointer px-3 py-2.5 rounded-xl text-center text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.30)', color: '#d8b4fe' }}>
              <Upload size={11} /> {uploading ? 'Uploading…' : 'Audio file'}
              <input type="file" accept="audio/*" className="hidden" onChange={onAudioPick} disabled={uploading} />
            </label>
            <label className="cursor-pointer px-3 py-2.5 rounded-xl text-center text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)' }}>
              <Upload size={11} /> Album art
              <input type="file" accept="image/*" className="hidden" onChange={onArtPick} />
            </label>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
            {'>'} Audio plays muted by default for visitors; one click unmutes. 10 MB max.
          </p>
          {anthem?.audio_url && (
            <button onClick={onClear} className="w-full py-2 text-[10px] font-mono uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors">
              Clear anthem
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
