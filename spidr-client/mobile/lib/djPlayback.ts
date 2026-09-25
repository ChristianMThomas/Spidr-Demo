import { createAudioPlayer } from 'expo-audio';
import api from './apiClient';

// Owned by the voice room, not the room screen: minimizing a call keeps music alive.
class DJPlayback {
  private snapshot = { session: null as any, paused: false, volume: 0.8, status: 'idle', error: '' };
  private listeners = new Set<() => void>();
  private player: ReturnType<typeof createAudioPlayer> | null = null;
  private subscription: { remove: () => void } | null = null;
  private socket: any;
  private channelId = '';
  private generation = 0;
  private revision = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private deafened = false;
  private live = false;
  private sourceKey = '';
  private applyLiveMute: (muted: boolean) => void = () => {};
  private hasLiveAudio: () => boolean = () => false;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private publish(patch: Partial<typeof this.snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  start(channelId: string, socket: any, applyLiveMute: (muted: boolean) => void, hasLiveAudio: () => boolean = () => false) {
    this.stop();
    this.channelId = channelId;
    this.socket = socket;
    this.applyLiveMute = applyLiveMute;
    this.hasLiveAudio = hasLiveAudio;
    socket.on('voice:dj-session-changed', this.changed);
    socket.on('connect', this.refresh);
    this.refresh();
    this.timer = setInterval(this.refresh, 15000);
  }
  private changed = (event: any) => {
    if (event?.channel_id !== this.channelId) return;
    this.revision++;
    this.setSession(event.session);
  };
  refresh = async () => {
    if (!this.channelId) return;
    const generation = this.generation, revision = ++this.revision;
    try {
      const session = await api.get(`/voice-channels/${this.channelId}/dj-session`);
      if (generation === this.generation && revision === this.revision) this.setSession(session);
    } catch {
      if (generation === this.generation && revision === this.revision) this.publish({ error: 'Could not refresh the DJ session.' });
    }
  };
  private setSession(session: any) {
    const hostChanged = session?.host_id !== this.snapshot.session?.host_id;
    this.publish({ session, error: '', ...(hostChanged ? { paused: false } : {}) });
    this.live = this.hasLiveAudio();
    this.route();
  }
  setOutput(deafened: boolean, live: boolean) {
    this.deafened = deafened;
    this.live = live;
    this.route();
  }
  private release() {
    this.subscription?.remove();
    this.subscription = null;
    const player = this.player;
    this.player = null;
    if (player) { try { player.pause(); player.remove(); } catch {} }
  }
  private route() {
    const { session, paused, volume } = this.snapshot;
    const stream = !!session && (session.audio_route === 'stream' || this.live);
    this.applyLiveMute(paused || this.deafened || volume === 0);
    const key = !session || stream ? '' : `${session.host_id}:${session.track_id}:${session.started_at}:${session.preview_url || ''}`;
    if (key !== this.sourceKey) { this.release(); this.sourceKey = key; }
    if (!session || stream) {
      this.release();
      this.publish({ status: !session ? 'idle' : this.deafened ? 'deafened' : paused ? 'paused' : this.live ? 'live' : 'waiting' });
      return;
    }
    if (!session.preview_url) { this.publish({ status: 'unavailable' }); return; }
    if (!this.player) {
      try {
        const player = createAudioPlayer(session.preview_url, { keepAudioSessionActive: true });
        this.player = player;
        let started = false;
        this.publish({ status: 'loading' });
        this.subscription = player.addListener('playbackStatusUpdate', status => {
          if (this.player !== player) return;
          if (status.isLoaded && !started) { started = true; this.resume(); }
          else if (status.didJustFinish) this.publish({ status: 'ended' });
          else if (status.playing) this.publish({ status: this.deafened ? 'deafened' : 'preview' });
        });
        if (player.isLoaded) { started = true; this.resume(); }
      } catch { this.publish({ status: 'error', error: 'This preview could not be loaded.' }); }
    }
    if (this.player) {
      this.player.volume = volume;
      this.player.muted = this.deafened;
      if (paused) { this.player.pause(); this.publish({ status: 'paused' }); }
      else if (this.deafened) this.publish({ status: 'deafened' });
    }
  }
  private async resume() {
    const player = this.player;
    if (!player || this.snapshot.paused) return;
    const elapsed = Math.max(0, (Date.now() - new Date(this.snapshot.session?.started_at).getTime()) / 1000) || 0;
    if (player.duration > 0 && elapsed >= player.duration) { this.publish({ status: 'ended' }); return; }
    try {
      await player.seekTo(elapsed);
      if (this.player !== player || this.snapshot.paused) return;
      player.play();
      this.publish({ error: '' });
    } catch { if (this.player === player) this.publish({ status: 'error', error: 'Could not play this preview. Tap play to retry.' }); }
  }
  toggle = () => {
    const paused = !this.snapshot.paused;
    this.publish({ paused, status: paused ? 'paused' : 'loading' });
    this.route();
    if (!paused) this.resume();
  };
  setVolume = (volume: number) => { this.publish({ volume: Math.max(0, Math.min(1, volume)) }); this.route(); };
  stop() {
    this.generation++;
    this.socket?.off('voice:dj-session-changed', this.changed);
    this.socket?.off('connect', this.refresh);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.socket = null;
    this.channelId = '';
    this.sourceKey = '';
    this.live = false;
    this.deafened = false;
    this.release();
    this.applyLiveMute(false);
    this.applyLiveMute = () => {};
    this.hasLiveAudio = () => false;
    this.publish({ session: null, paused: false, status: 'idle', error: '' });
  }
}
export const djPlayback = new DJPlayback();
