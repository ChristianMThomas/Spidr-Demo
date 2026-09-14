/**
 * voiceRoom — N-way voice for server voice webs and group chats.
 *
 * Sibling of lib/callManager (which owns 1:1 DM calls and everything that
 * rings: CallKeep, FCM, ringtones). This module deliberately has none of
 * that — you don't get rung into a voice channel, you walk into it — so it
 * needs neither Firebase nor an Apple dev account. react-native-webrtc plus
 * react-native-incall-manager in a dev client is the whole requirement.
 *
 * Room addressing matches the web client byte for byte, so mobile and web
 * land in the same mesh:
 *   server web  → voice:join { serverId: <server.id>, channelId: <channel.id> }
 *   group call  → voice:join { serverId: 'group',     channelId: <groupId>    }
 *   (DM call    → serverId: 'dm' — callManager's business, not ours)
 *
 * Presence is the VoiceSession collection, same rows CommunityPanel and
 * KineticChat read, so web sees mobile occupants and vice versa.
 *
 * Unlike callManager, a peer dropping does NOT end the session: voice webs
 * outlive any single occupant, and being alone in one is a normal state.
 */
import api, { entities } from './apiClient';
import { getSocket } from './socket';
import { emitter } from './eventEmitter';
import { getWebRTC, getInCallManager, callsSupported } from './nativeCalls';
import { loadAvPrefs } from './avPrefs';

export type VoiceRoomKind = 'server' | 'group';
export type VoiceRoomState = 'idle' | 'connecting' | 'connected';

export interface VoiceRoomInfo {
  /** Real server id for a voice web; the literal 'group' for a group call. */
  serverId: string;
  /** Channel id for a voice web; the group id for a group call. */
  channelId: string;
  kind: VoiceRoomKind;
  /** Display name for the room screen and the active-call bar. */
  name: string;
}

const FALLBACK_ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

class VoiceRoom {
  state: VoiceRoomState = 'idle';
  room: VoiceRoomInfo | null = null;
  isMuted = false;
  isDeafened = false;
  isSpeaker = true;
  localStream: any = null;
  /** socketId → MediaStream. Audio plays itself; this drives the speaking UI. */
  remoteStreams: Record<string, any> = {};

  private currentUser: any = null;
  private peers: Record<string, any> = {}; // socketId → RTCPeerConnection
  private socket: any = null;
  private iceConfig: any = FALLBACK_ICE;
  private sessionId: string | null = null;
  private mutedBeforeDeafen = false;
  private handlers: Record<string, (payload: any) => void> = {};

  // ── Join ──────────────────────────────────────────────────────────────────
  /**
   * Resolves true once the mesh is live. Returns false (and emits
   * `voice:room-unsupported`) in Expo Go, where react-native-webrtc is absent.
   */
  async join(room: VoiceRoomInfo, currentUser: any): Promise<boolean> {
    if (!callsSupported()) {
      emitter.emit('voice:room-unsupported', room);
      return false;
    }
    // Already in this exact room — treat the second tap as a no-op rather
    // than tearing down a live mesh and rebuilding it.
    if (this.state !== 'idle' && this.isSameRoom(room)) return true;
    if (this.state !== 'idle') await this.leave();

    this.room = room;
    this.currentUser = currentUser;
    this.state = 'connecting';
    emitter.emit('voice:room-state', { state: this.state, room });

    const { RTCPeerConnection, RTCIceCandidate, mediaDevices } = getWebRTC();
    const prefs = await loadAvPrefs();

    let stream: any;
    try {
      stream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: prefs.echo_cancellation,
          noiseSuppression: prefs.noise_suppression,
        },
        video: false,
      });
    } catch (err: any) {
      // Denied mic, or another app holding the capture device.
      this.state = 'idle';
      this.room = null;
      emitter.emit('voice:room-state', { state: 'idle', room: null, error: err?.message });
      emitter.emit('voice:room-error', { message: err?.message || 'Microphone unavailable' });
      return false;
    }
    this.localStream = stream;

    this.isMuted = prefs.join_muted;
    if (this.isMuted) {
      const mic = stream.getAudioTracks?.()[0];
      if (mic) mic.enabled = false;
    }

    try {
      const cfg: any = await api.get('/voice/ice');
      if (cfg?.iceServers?.length) this.iceConfig = cfg;
    } catch { this.iceConfig = FALLBACK_ICE; }

    const socket = await getSocket();
    this.socket = socket;

    const createPeer = (socketId: string, isInitiator: boolean) => {
      const pc = new RTCPeerConnection(this.iceConfig);
      this.peers[socketId] = pc;

      this.localStream?.getTracks?.().forEach((t: any) => pc.addTrack(t, this.localStream));

      pc.ontrack = (event: any) => {
        const [remote] = event.streams;
        if (!remote) return;
        // Web peers may also publish camera/screen video into this mesh. We
        // only consume audio here, but keeping the stream lets a deafen
        // toggle reach every inbound track.
        if (this.isDeafened) {
          remote.getAudioTracks?.().forEach((t: any) => { t.enabled = false; });
        }
        this.remoteStreams = { ...this.remoteStreams, [socketId]: remote };
        emitter.emit('voice:room-streams', this.remoteStreams);
      };
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit('voice:signal', { to: socketId, signal: { type: 'ice', candidate: event.candidate } });
        }
      };
      pc.onconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          this.dropPeer(socketId);
        }
      };

      if (isInitiator) {
        pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false })
          .then((offer: any) => pc.setLocalDescription(offer))
          .then(() => socket.emit('voice:signal', { to: socketId, signal: { type: 'offer', sdp: pc.localDescription } }))
          .catch(() => { /* peer left mid-negotiation */ });
      }
      return pc;
    };

    // Named handlers, detached by reference on leave — callManager uses the
    // blanket socket.off('voice:signal') form, which would rip our listeners
    // off the shared socket singleton if a DM call ended while we were live.
    this.handlers = {
      'voice:peer-joined': ({ socketId }: any) => {
        if (!socketId || socketId === socket.id || this.peers[socketId]) return;
        createPeer(socketId, true);
      },
      'voice:peer-left': ({ socketId }: any) => {
        if (socketId) this.dropPeer(socketId);
      },
      'voice:signal': async ({ from, signal }: any) => {
        const pc = this.peers[from] || createPeer(from, false);
        try {
          if (signal.type === 'offer') {
            await pc.setRemoteDescription(signal.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:signal', { to: from, signal: { type: 'answer', sdp: pc.localDescription } });
          } else if (signal.type === 'answer') {
            await pc.setRemoteDescription(signal.sdp);
          } else if (signal.type === 'ice') {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        } catch { /* signaling race — ICE retries cover it */ }
      },
      'voice:force-disconnect': (data: any) => {
        if (!this.room) return;
        const forThisRoom = this.room.kind === 'group'
          ? data?.groupId === this.room.channelId || data?.channelId === this.room.channelId
          : data?.serverId === this.room.serverId && data?.channelId === this.room.channelId;
        if (!forThisRoom) return;
        emitter.emit('voice:room-kicked', this.room);
        this.leave();
      },
      // A socket reconnect silently drops every room membership, so the mesh
      // would go quiet with the UI still saying "connected".
      connect: () => {
        if (this.state === 'idle' || !this.room) return;
        socket.emit('voice:join', this.joinPayload());
      },
    };
    for (const [event, handler] of Object.entries(this.handlers)) socket.on(event, handler);

    socket.emit('voice:join', this.joinPayload());

    const InCall = getInCallManager();
    InCall?.start({ media: 'audio' });
    // Voice webs are hangouts, not phone calls — speaker unless the device
    // pref says otherwise or a headset is attached (the OS routes that).
    this.isSpeaker = true;
    InCall?.setForceSpeakerphoneOn(true);

    await this.openPresence();

    this.state = 'connected';
    emitter.emit('voice:room-state', { state: this.state, room: this.room });
    return true;
  }

  // ── Leave ─────────────────────────────────────────────────────────────────
  async leave() {
    const room = this.room;
    if (!room && this.state === 'idle') return;

    getInCallManager()?.stop();

    try { this.localStream?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
    this.localStream = null;
    Object.values(this.peers).forEach((pc: any) => { try { pc.close(); } catch {} });
    this.peers = {};
    this.remoteStreams = {};

    if (this.socket) {
      if (room) this.socket.emit('voice:leave', this.joinPayload());
      for (const [event, handler] of Object.entries(this.handlers)) this.socket.off(event, handler);
    }
    this.handlers = {};

    await this.closePresence();

    this.room = null;
    this.state = 'idle';
    this.isMuted = false;
    this.isDeafened = false;
    this.isSpeaker = true;
    emitter.emit('voice:room-streams', {});
    emitter.emit('voice:room-state', { state: 'idle', room: null });
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  toggleMute() {
    const track = this.localStream?.getAudioTracks?.()[0];
    if (!track) return;
    // Un-muting while deafened doesn't make sense (nobody can hear back), so
    // it lifts the deafen too — same affordance as the web deck.
    if (this.isDeafened && this.isMuted) this.setDeafened(false);
    track.enabled = !track.enabled;
    this.isMuted = !track.enabled;
    this.pushPresence({ is_muted: this.isMuted });
    this.emitControls();
  }

  toggleSpeaker() {
    this.isSpeaker = !this.isSpeaker;
    getInCallManager()?.setForceSpeakerphoneOn(this.isSpeaker);
    this.emitControls();
  }

  toggleDeafen() {
    this.setDeafened(!this.isDeafened);
  }

  private setDeafened(next: boolean) {
    if (next === this.isDeafened) return;
    this.isDeafened = next;

    Object.values(this.remoteStreams).forEach((stream: any) => {
      stream?.getAudioTracks?.().forEach((t: any) => { t.enabled = !next; });
    });

    const mic = this.localStream?.getAudioTracks?.()[0];
    if (next) {
      this.mutedBeforeDeafen = this.isMuted;
      if (mic) mic.enabled = false;
      this.isMuted = true;
    } else if (mic) {
      mic.enabled = !this.mutedBeforeDeafen;
      this.isMuted = this.mutedBeforeDeafen;
    }

    this.pushPresence({ is_muted: this.isMuted, is_deafened: this.isDeafened });
    this.emitControls();
  }

  /** True when the given room is the one currently joined. */
  isSameRoom(room: VoiceRoomInfo): boolean {
    return !!this.room
      && this.room.serverId === room.serverId
      && this.room.channelId === room.channelId;
  }

  // ── Internals ─────────────────────────────────────────────────────────────
  private joinPayload() {
    return {
      serverId: this.room!.serverId,
      channelId: this.room!.channelId,
      userId: this.currentUser?.id,
      userName: this.currentUser?.full_name || this.currentUser?.username,
    };
  }

  private dropPeer(socketId: string) {
    const pc = this.peers[socketId];
    if (pc) { try { pc.close(); } catch {} delete this.peers[socketId]; }
    if (!(socketId in this.remoteStreams)) return;
    const next = { ...this.remoteStreams };
    delete next[socketId];
    this.remoteStreams = next;
    emitter.emit('voice:room-streams', this.remoteStreams);
  }

  private emitControls() {
    emitter.emit('voice:room-controls', {
      isMuted: this.isMuted,
      isSpeaker: this.isSpeaker,
      isDeafened: this.isDeafened,
    });
  }

  /**
   * Write the VoiceSession row every other surface reads. Stale rows for this
   * user in the same scope are cleared first — a killed app never runs its
   * leave path, and a ghost occupant is worse than none.
   */
  private async openPresence() {
    const room = this.room;
    const user = this.currentUser;
    if (!room || !user?.id) return;
    try {
      const stale: any = await entities.VoiceSession.filter({
        server_id: room.serverId,
        user_id: user.id,
      });
      await Promise.all((stale || []).map((s: any) => entities.VoiceSession.delete(s.id).catch(() => {})));
      const created: any = await entities.VoiceSession.create({
        server_id: room.serverId,
        channel_id: room.channelId,
        ...(room.kind === 'group' ? { group_id: room.channelId } : {}),
        user_id: user.id,
        user_name: user.full_name || user.username,
        user_avatar: user.avatar_url || '',
        is_muted: this.isMuted,
        is_deafened: false,
        is_video_on: false,
        is_screen_sharing: false,
      });
      this.sessionId = created?.id || null;
    } catch {
      // Presence is cosmetic — a failed row must never block the audio path.
      this.sessionId = null;
    }
  }

  private async closePresence() {
    const id = this.sessionId;
    this.sessionId = null;
    if (id) { try { await entities.VoiceSession.delete(id); } catch {} }
  }

  private pushPresence(patch: Record<string, any>) {
    if (!this.sessionId) return;
    entities.VoiceSession.update(this.sessionId, patch).catch(() => {});
  }
}

export const voiceRoom = new VoiceRoom();
