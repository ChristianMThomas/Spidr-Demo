import React, { useState } from 'react';
import { Disc3, Volume2, Music, Pause, Play, X, Loader2, ListPlus, Trash2, SkipForward, MonitorSpeaker, Share2, Activity } from 'lucide-react';
import { spotify } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import useAudioSpectrum from '@/hooks/useAudioSpectrum';
import useNowPlaying from '@/hooks/useNowPlaying';
import SpotifySearchModal from './SpotifySearchModal';
import { toast } from 'sonner';
import './DJMatrix.css';

const time = value => `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, '0')}`;

export default function DJMatrix({ channel, djSession, isHost, currentUser, participants = [], audio, hostStream, streamStats = {}, deckHidden = false, onStop }) {
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const np = useNowPlaying(djSession?.host_id, { enabled: audio.audioRoute === 'stream' && !!djSession?.host_id });
  const spectrum = useAudioSpectrum({
    stream: audio.audioRoute === 'stream' ? hostStream : null,
    // Keep CDN previews on the browser's native audio path. Attaching a
    // MediaElementSource can silence providers that don't permit CORS.
    element: null,
    enabled: audio.isPlaying && !deckHidden,
  });
  const queue = djSession?.queue || [];
  const live = audio.audioRoute === 'stream';
  const name = (live && np?.track_name) || djSession?.track_name || 'Live audio';
  const artist = (live && np?.artist) || djSession?.track_artist || djSession?.host_user_name || '';
  const art = (live && np?.album_art_url) || djSession?.album_art_url;
  const elapsed = live ? (np?.progress_ms || 0) / 1000 : audio.progressSeconds;
  const duration = live ? (np?.duration_ms || 0) / 1000 : audio.durationSeconds;
  const pending = djSession?.handoff;
  const offeredToMe = pending?.to_user_id === currentUser?.id;
  const offeredByMe = pending?.from_user_id === currentUser?.id;

  const run = async (action, success) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['djSession', channel.id] });
      success?.();
    } catch (error) { toast.error(error?.message || 'Could not update the DJ booth'); }
    finally { setBusy(false); }
  };
  const selectTrack = track => run(async () => {
    const metadata = {
      track_name: track.name || '', track_artist: track.artist || '',
      album_art_url: track.album_art_url || '', preview_url: track.preview_url || '',
      external_url: track.external_url || '', duration_ms: track.duration_ms || 0,
      source: track.source === 'apple' ? 'apple' : 'spotify', audio_route: live ? 'stream' : 'preview',
    };
    if (pickerMode === 'queue') await spotify.djSession.enqueue(channel.id, track.id, metadata);
    else await spotify.djSession.next(channel.id, track.id, metadata);
  }, () => setPickerMode(null));

  const status = {
    streaming: `Live audio via ${djSession?.host_user_name || 'DJ'}`,
    waiting: 'Waiting for live audio', preview: 'Track preview', fulltrack: 'Apple Music',
    paused: 'Paused for you', deafened: 'Deafened', blocked: 'Audio needs your attention',
    ended: 'Preview finished', unavailable: 'No preview available', error: audio.audioError || 'Audio unavailable', loading: 'Loading audio...',
  }[audio.status] || 'DJ Booth';

  return <div className="dj-room">
    <section className="dj-booth" data-live={live} aria-label="DJ Booth">
      <header className="dj-header">
        <span className="dj-brand"><Disc3 size={18} />DJ BOOTH<span className="dj-brand-divider">/</span>{channel?.name}</span>
        <div className="dj-header-actions">
          <span className="dj-sync" title={live ? 'Measured receiver audio buffering. This is not the difference between listeners.' : 'Local preview offset from the session clock'}>
            <Activity size={12} />{live ? 'AUDIO BUFFER' : 'PREVIEW OFFSET'} <strong>{Number.isFinite(live ? streamStats.bufferMs : audio.localPreviewDriftMs) ? `${live ? streamStats.bufferMs : Math.abs(audio.localPreviewDriftMs)} ms` : 'Unavailable'}</strong>
          </span>
          {isHost && <button className="dj-end" disabled={busy} onClick={() => run(() => spotify.djSession.end(channel.id), onStop)}><X size={13} />End session</button>}
        </div>
      </header>
      <p className="dj-status" role="status"><span className={`dj-status-dot ${audio.isPlaying ? 'is-live' : ''}`} />{status}</p>
      <div className="dj-stage">
        <div className="dj-record-wrap" style={{ '--dj-energy': spectrum.bass || 0 }}>
          <div className="dj-record-halo" aria-hidden />
          <div className="dj-record" style={{ animationPlayState: audio.isPlaying ? 'running' : 'paused' }}>
            <div className="dj-record-grooves" />
            {art ? <img className="dj-record-art" src={art} alt={`Album art for ${name}`} /> : <Disc3 className="dj-record-placeholder" />}
            <div className="dj-record-spindle"><span /></div>
          </div>
          <span className="dj-record-label"><Music size={10} />{live ? 'LIVE' : audio.fullTrackActive ? 'FULL TRACK' : 'PREVIEW'}</span>
        </div>
        <div className="dj-track">
          <p className="dj-eyebrow">Now playing</p><h2>{name}</h2><p className="dj-artist">{artist}</p>
          {duration > 0 && <div className="dj-progress-block">
            <div className="dj-progress" role="progressbar" aria-label="Track progress" aria-valuenow={Math.round(elapsed || 0)} aria-valuemax={Math.round(duration)}><span style={{ width: `${Math.min(100, (elapsed || 0) / duration * 100)}%` }} /></div>
            <div className="dj-time"><span>{time(elapsed)}</span><span>{time(duration)}</span></div>
          </div>}
        </div>
      </div>
      <div className="dj-audience"><div className="dj-avatars">{participants.slice(0, 6).map(p => <span key={p.user_id} className="dj-avatar" title={p.user_name} data-host={p.user_id === djSession?.host_id}>
        {p.user_avatar ? <img src={p.user_avatar} alt="" /> : (p.user_name || '?')[0]}
      </span>)}</div><span>On the aux <strong>{djSession?.host_user_name || 'DJ'}</strong><span className="dj-audience-count">{participants.length} in the room</span></span></div>
      <div className="dj-controls">
        <div className="dj-transport">
          <button className="dj-play" aria-label={audio.userPaused ? 'Resume my audio' : 'Pause my audio'} title={audio.canControlAudio ? (audio.userPaused ? 'Resume my audio' : 'Pause my audio') : 'Live source is controlled in the sharing app'} disabled={!audio.canControlAudio} onClick={audio.togglePause}>{audio.userPaused ? <Play size={18} /> : <Pause size={18} />}</button>
          {isHost && <button className="dj-button dj-button-accent" disabled={busy} onClick={() => setPickerMode('now')}><Music size={14} />Change track</button>}
          {isHost && <button className="dj-icon-button" title="Next queued track" aria-label="Next queued track" disabled={busy || !queue.length} onClick={() => run(() => spotify.djSession.advance(channel.id))}><SkipForward size={18} /></button>}
        </div>
        <label className="dj-volume"><Volume2 size={15} /><input type="range" aria-label="Local music volume" min="0" max="100" step="1" disabled={!audio.canControlAudio} value={audio.localVolume} onChange={e => audio.setLocalVolume(Number(e.target.value))} /><output>{audio.localVolume}%</output></label>
        <div className="dj-secondary-controls">
          {isHost && <button className="dj-button" data-active={drawer === 'aux'} onClick={() => setDrawer(drawer === 'aux' ? null : 'aux')}><Share2 size={14} />Pass aux</button>}
          <button className="dj-button" data-active={drawer === 'queue'} onClick={() => setDrawer(drawer === 'queue' ? null : 'queue')}><ListPlus size={15} />Queue <span className="dj-count">{queue.length}</span></button>
        </div>
      </div>
      <div className="dj-playback-note">
        <p>{isHost && live ? 'Source volume and playback are controlled in the sharing app.' : live ? 'Live audio' : audio.fullTrackActive ? 'Playing with Apple Music' : 'Preview audio'}</p>
        {audio.audioBlocked && <button className="dj-text-button" onClick={audio.unlockAudio}><Play size={12} />Enable audio</button>}
        {isHost && <button className="dj-text-button" onClick={() => window.dispatchEvent(new Event('spidr-open-share'))}><MonitorSpeaker size={13} />Share audio</button>}
      </div>
      {pending && <div className="dj-aux-offer"><Share2 size={18} /><p>{offeredToMe ? 'The DJ offered you the aux.' : offeredByMe ? 'Waiting for the next DJ to accept.' : 'An aux handoff is pending.'}</p>
        {(offeredToMe || offeredByMe) && <div className="dj-offer-actions">
          {offeredToMe && <button className="dj-button dj-button-accent" disabled={busy} onClick={() => run(() => spotify.djSession.acceptAux(channel.id), () => window.dispatchEvent(new Event('spidr-open-share')))}>Take aux</button>}
          <button className="dj-button" disabled={busy} onClick={() => run(() => spotify.djSession.declineAux(channel.id))}>{offeredByMe ? 'Cancel' : 'Decline'}</button>
        </div>}
      </div>}
      {drawer === 'aux' && <section className="dj-drawer" aria-label="Pass the aux">
        <div className="dj-drawer-header"><h3>Next DJ</h3><button className="dj-icon-button" aria-label="Close aux drawer" onClick={() => setDrawer(null)}><X size={14} /></button></div>
        <div className="dj-aux-targets">{participants.filter(p => p.user_id !== currentUser?.id).map(p => <button key={p.user_id} className="dj-aux-target" disabled={busy || !!pending} onClick={() => run(() => spotify.djSession.passAux(channel.id, p.user_id, p.user_name), () => setDrawer(null))}><span className="dj-avatar">{p.user_avatar ? <img src={p.user_avatar} alt="" /> : (p.user_name || '?')[0]}</span><span>{p.user_name}</span><Share2 size={14} /></button>)}</div>
        {participants.length < 2 && <p className="dj-empty">No other listeners yet.</p>}
      </section>}
      {drawer === 'queue' && <section className="dj-drawer" aria-label="Music queue">
        <div className="dj-drawer-header"><h3>Up next ({queue.length})</h3><div className="dj-drawer-actions"><button className="dj-text-button" disabled={busy} onClick={() => setPickerMode('queue')}><ListPlus size={14} />Add track</button><button className="dj-icon-button" aria-label="Close queue" onClick={() => setDrawer(null)}><X size={14} /></button></div></div>
        {!queue.length ? <div className="dj-empty"><ListPlus size={24} /><p>Queue is empty</p></div> : <ol className="dj-queue">{queue.map((track, index) => <li key={track.qid}>
          <span className="dj-queue-number">{String(index + 1).padStart(2, '0')}</span>{track.album_art_url ? <img className="dj-queue-art" src={track.album_art_url} alt="" /> : <span className="dj-queue-art dj-art-fallback"><Music size={16} /></span>}
          <div className="dj-queue-track"><strong>{track.track_name}</strong><span>{track.track_artist}</span></div><span className="dj-requester">{track.added_by_name}</span>
          {(isHost || track.added_by === currentUser?.id) && <button className="dj-icon-button dj-remove" disabled={busy} title="Remove track" aria-label={`Remove ${track.track_name}`} onClick={() => run(() => spotify.djSession.dequeue(channel.id, track.qid))}><Trash2 size={14} /></button>}
        </li>)}</ol>}
      </section>}
      <footer className="dj-footer"><span><Disc3 size={12} />SPIDR DJ</span><span>{busy && <Loader2 size={12} className="animate-spin" />}{live ? 'LIVE AUDIO' : 'LISTENING TOGETHER'}</span></footer>
    </section>
    <SpotifySearchModal open={!!pickerMode} onClose={() => setPickerMode(null)} onSelect={selectTrack} title={pickerMode === 'queue' ? 'Add to queue' : 'Change track'} subtitle="Spidr DJ" actionLabel={pickerMode === 'queue' ? 'Queue' : 'Play'} requirePreview={!live} allowAppleMusic />
  </div>;
}
