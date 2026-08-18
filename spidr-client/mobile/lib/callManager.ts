/**
 * CallManager — the mobile call brain (Patch 1.9.x "real calls").
 *
 * Owns the whole lifecycle:
 *   ring    — socket `call:incoming` (app open) or FCM data push → CallKeep
 *             native ring (background/killed) + in-app overlay (foreground)
 *   accept  — emits `call:accept`, joins the SAME WebRTC mesh the web uses
 *             (room `voice:server:dm:<conversationId>`, signal relay
 *             `voice:signal`, ICE config from GET /voice/ice)
 *   active  — audio (and camera for video calls) peer-to-peer; mute/speaker
 *   end     — `voice:leave` + CallKeep teardown
 *
 * All native modules come through lib/nativeCalls so Expo Go still runs the
 * app — there, incoming rings show the JS overlay and accept explains that
 * calls need the dev build.
 */
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './apiClient';
import { getSocket } from './socket';
import { emitter } from './eventEmitter';
import { getWebRTC, getCallKeep, getMessaging, getInCallManager, callsSupported } from './nativeCalls';
import { loadAvPrefs } from './avPrefs';

export interface CallPeerInfo { id: string; name?: string; avatar?: string }
export interface CallInfo {
  conversationId: string;
  peer: CallPeerInfo;         // the other party
  kind: 'voice' | 'video';
  direction: 'incoming' | 'outgoing';
}
export type CallState = 'idle' | 'ringing' | 'active';

const FALLBACK_ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Deterministic UUID-shaped id from the conversation id so every surface
// (socket ring, push ring, accept, end) addresses the same CallKeep call.
function callUUID(conversationId: string): string {
  const hex = Array.from(conversationId)
    .reduce((acc, ch) => acc + ch.charCodeAt(0).toString(16).padStart(2, '0'), '')
    .padEnd(32, '0')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

class CallManager {
  state: CallState = 'idle';
  call: CallInfo | null = null;
  isMuted = false;
  isSpeaker = false;
  isCameraOff = false;
  localStream: any = null;
  remoteStreams: Record<string, any> = {}; // socketId → MediaStream

  private currentUser: any = null;
  private peers: Record<string, any> = {}; // socketId → RTCPeerConnection
  private socket: any = null;
  private iceConfig: any = FALLBACK_ICE;
  private recentRings = new Map<string, number>(); // conversationId → ts (dedupe socket+push)
  private callKeepReady = false;
  private initialized = false;

  // ── Bootstrap (call once, after login) ────────────────────────────────────
  async init(currentUser: any) {
    console.log('[callManager] init() called for user:', currentUser?.id);
    this.currentUser = currentUser;
    if (this.initialized) {
      console.log('[callManager] already initialized, skipping');
      return;
    }
    this.initialized = true;

    try {
      this.socket = await getSocket();
      console.log('[callManager] socket ready, connected =', this.socket?.connected);
    } catch (err: any) {
      console.warn('[callManager] getSocket() FAILED:', err?.message);
      return;
    }

    this.socket.on('call:incoming', ({ conversationId, caller, kind }: any) => {
      console.log('[callManager] call:incoming socket event', { conversationId, caller, kind });
      this.ring({
        conversationId,
        peer: { id: caller?.id, name: caller?.name, avatar: caller?.avatar },
        kind: kind === 'video' ? 'video' : 'voice',
        direction: 'incoming',
      });
    });
    this.socket.on('call:cancelled', ({ conversationId }: any) => {
      if (this.call?.conversationId === conversationId && this.state === 'ringing') {
        this.stopRinging('cancelled');
      }
    });

    console.log('[callManager] socket handlers registered, setting up CallKeep');
    try { this.setupCallKeep(); } catch (err: any) { console.warn('[callManager] setupCallKeep FAILED:', err?.message); }

    console.log('[callManager] setting up push');
    try { await this.setupPush(); } catch (err: any) { console.warn('[callManager] setupPush FAILED:', err?.message); }

    console.log('[callManager] consuming pending background ring');
    try { await this.consumePendingBackgroundRing(); } catch (err: any) { console.warn('[callManager] consumePendingBackgroundRing FAILED:', err?.message); }

    console.log('[callManager] init() complete');
  }

  // ── Ringing ───────────────────────────────────────────────────────────────
  private ring(call: CallInfo) {
    // Dedupe: socket + push both fire for reliability.
    const last = this.recentRings.get(call.conversationId) || 0;
    if (Date.now() - last < 30_000) return;
    this.recentRings.set(call.conversationId, Date.now());

    if (this.state !== 'idle') return; // busy — let it ring out on the caller side

    this.call = call;
    this.state = 'ringing';
    emitter.emit('call:state', { state: this.state, call });

    const foreground = AppState.currentState === 'active';
    const CallKeep = getCallKeep();
    if (CallKeep && this.callKeepReady && !foreground) {
      // Native lock-screen ring (CallKit / ConnectionService).
      CallKeep.displayIncomingCall(
        callUUID(call.conversationId),
        call.peer.name || 'Spidr',
        call.peer.name || 'Spidr',
        'generic',
        call.kind === 'video',
      );
    } else {
      // Foreground: JS overlay (CallProvider renders it) + native ringtone.
      getInCallManager()?.startRingtone('_BUNDLE_');
    }
  }

  private stopRinging(reason: 'cancelled' | 'declined' | 'timeout') {
    getInCallManager()?.stopRingtone();
    const conv = this.call?.conversationId;
    if (conv) getCallKeep()?.reportEndCallWithUUID?.(callUUID(conv), 6 /* unanswered */);
    this.call = null;
    this.state = 'idle';
    emitter.emit('call:state', { state: this.state, call: null, reason });
  }

  // ── Accept / decline (callee side) ────────────────────────────────────────
  async accept() {
    const call = this.call;
    if (!call || this.state !== 'ringing') return;
    getInCallManager()?.stopRingtone();

    this.socket?.emit('call:accept', {
      callerId: call.peer.id,
      conversationId: call.conversationId,
    });

    if (!callsSupported()) {
      // Expo Go: signal accepted (so web caller connects) but explain media.
      this.state = 'idle';
      const c = this.call;
      this.call = null;
      emitter.emit('call:state', { state: 'idle', call: null });
      emitter.emit('call:unsupported', c);
      return;
    }

    await this.joinMedia(call);
  }

  decline() {
    const call = this.call;
    if (!call) return;
    this.socket?.emit('call:decline', {
      callerId: call.peer.id,
      conversationId: call.conversationId,
    });
    this.stopRinging('declined');
  }

  // ── Caller side: invite accepted → join media ─────────────────────────────
  async startOutgoing(call: Omit<CallInfo, 'direction'>) {
    if (!callsSupported()) {
      emitter.emit('call:unsupported', { ...call, direction: 'outgoing' });
      return false;
    }
    await this.joinMedia({ ...call, direction: 'outgoing' });
    return true;
  }

  // ── Media (mirrors web useWebRTC: mesh over voice:signal) ─────────────────
  private async joinMedia(call: CallInfo) {
    const { RTCPeerConnection, RTCIceCandidate, mediaDevices } = getWebRTC();

    this.call = call;
    // Device-local defaults from Settings → Voice & Video.
    const prefs = await loadAvPrefs();
    const stream = await mediaDevices.getUserMedia({
      audio: { echoCancellation: prefs.echo_cancellation, noiseSuppression: prefs.noise_suppression },
      video: call.kind === 'video' ? { facingMode: 'user', width: 1280, height: 720 } : false,
    });
    this.localStream = stream;

    this.isMuted = prefs.join_muted;
    if (this.isMuted) {
      const mic = stream.getAudioTracks?.()[0];
      if (mic) mic.enabled = false;
    }

    this.isCameraOff = call.kind === 'video' ? prefs.camera_default_off : false;
    if (this.isCameraOff) {
      const cam = stream.getVideoTracks?.()[0];
      if (cam) cam.enabled = false;
    }

    try {
      const cfg: any = await api.get('/voice/ice');
      if (cfg?.iceServers?.length) this.iceConfig = cfg;
    } catch { this.iceConfig = FALLBACK_ICE; }

    const socket = this.socket;

    const createPeer = (socketId: string, isInitiator: boolean) => {
      const pc = new RTCPeerConnection(this.iceConfig);
      this.peers[socketId] = pc;

      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));

      pc.ontrack = (event: any) => {
        const [remote] = event.streams;
        if (!remote) return;
        this.remoteStreams = { ...this.remoteStreams, [socketId]: remote };
        emitter.emit('call:streams', this.remoteStreams);
      };
      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          socket.emit('voice:signal', { to: socketId, signal: { type: 'ice', candidate: event.candidate } });
        }
      };
      pc.onconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          delete this.peers[socketId];
          const next = { ...this.remoteStreams };
          delete next[socketId];
          this.remoteStreams = next;
          emitter.emit('call:streams', this.remoteStreams);
          // 1:1 DM call — the other side vanishing ends the call.
          if (Object.keys(this.peers).length === 0 && this.state === 'active') this.end();
        }
      };

      if (isInitiator) {
        pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
          .then((offer: any) => pc.setLocalDescription(offer))
          .then(() => socket.emit('voice:signal', { to: socketId, signal: { type: 'offer', sdp: pc.localDescription } }))
          .catch(() => {});
      }
      return pc;
    };

    socket.on('voice:peer-joined', ({ socketId }: any) => {
      if (socketId === socket.id) return;
      createPeer(socketId, true);
    });

    socket.on('voice:signal', async ({ from, signal }: any) => {
      let pc = this.peers[from] || createPeer(from, false);
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
      } catch { /* signaling race — peer will retry via ICE */ }
    });

    socket.on('voice:peer-left', ({ socketId }: any) => {
      const pc = this.peers[socketId];
      if (pc) { try { pc.close(); } catch {} delete this.peers[socketId]; }
      const next = { ...this.remoteStreams };
      delete next[socketId];
      this.remoteStreams = next;
      emitter.emit('call:streams', this.remoteStreams);
      if (Object.keys(this.peers).length === 0 && this.state === 'active') this.end();
    });

    // Same room the web voice deck joins for DM calls.
    socket.emit('voice:join', {
      serverId: 'dm',
      channelId: call.conversationId,
      userId: this.currentUser?.id,
      userName: this.currentUser?.full_name || this.currentUser?.username,
    });

    const InCall = getInCallManager();
    InCall?.start({ media: call.kind === 'video' ? 'video' : 'audio' });
    // Video calls always default to speaker; voice calls honour the pref.
    this.isSpeaker = call.kind === 'video' || prefs.speaker_default;
    InCall?.setForceSpeakerphoneOn(this.isSpeaker);

    const CallKeep = getCallKeep();
    if (CallKeep && this.callKeepReady) {
      const uuid = callUUID(call.conversationId);
      if (call.direction === 'outgoing') {
        CallKeep.startCall(uuid, call.peer.name || 'Spidr', call.peer.name || 'Spidr', 'generic', call.kind === 'video');
      }
      CallKeep.setCurrentCallActive(uuid);
    }

    this.state = 'active';
    emitter.emit('call:state', { state: this.state, call });
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  toggleMute() {
    const track = this.localStream?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    this.isMuted = !track.enabled;
    this.emitControls();
  }

  toggleSpeaker() {
    this.isSpeaker = !this.isSpeaker;
    getInCallManager()?.setForceSpeakerphoneOn(this.isSpeaker);
    this.emitControls();
  }

  toggleCamera() {
    const track = this.localStream?.getVideoTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    this.isCameraOff = !track.enabled;
    this.emitControls();
  }

  private emitControls() {
    emitter.emit('call:controls', { isMuted: this.isMuted, isSpeaker: this.isSpeaker, isCameraOff: this.isCameraOff });
  }

  end() {
    const call = this.call;
    getInCallManager()?.stopRingtone();
    getInCallManager()?.stop();

    try { this.localStream?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
    this.localStream = null;
    Object.values(this.peers).forEach((pc: any) => { try { pc.close(); } catch {} });
    this.peers = {};
    this.remoteStreams = {};

    if (this.socket && call) {
      this.socket.emit('voice:leave', { serverId: 'dm', channelId: call.conversationId });
      this.socket.off('voice:peer-joined');
      this.socket.off('voice:peer-left');
      this.socket.off('voice:signal');
    }
    if (call) getCallKeep()?.endCall?.(callUUID(call.conversationId));

    this.call = null;
    this.state = 'idle';
    this.isMuted = false;
    this.isSpeaker = false;
    this.isCameraOff = false;
    emitter.emit('call:streams', {});
    emitter.emit('call:state', { state: 'idle', call: null });
  }

  // ── CallKeep (native ring surface) ────────────────────────────────────────
  private setupCallKeep() {
    const CallKeep = getCallKeep();
    if (!CallKeep) return;
    CallKeep.setup({
      ios: { appName: 'Spidr' },
      android: {
        alertTitle: 'Phone account required',
        alertDescription: 'Spidr needs a phone account to ring you like a real call.',
        cancelButton: 'Cancel',
        okButton: 'Allow',
        additionalPermissions: [],
        foregroundService: {
          channelId: 'com.infinitetechteam.spidr.calls',
          channelName: 'Spidr Calls',
          notificationTitle: 'Spidr call in progress',
        },
        selfManaged: false,
      },
    }).then(() => { this.callKeepReady = true; }).catch(() => {});

    CallKeep.addEventListener('answerCall', async () => {
      CallKeep.backToForeground?.();
      if (this.state === 'ringing') await this.accept();
      else await this.consumePendingBackgroundRing(true);
    });
    CallKeep.addEventListener('endCall', () => {
      if (this.state === 'ringing') this.decline();
      else if (this.state === 'active') this.end();
    });
  }

  // ── Push (FCM) ────────────────────────────────────────────────────────────
  private async setupPush() {
    const messaging = getMessaging();
    console.log('[callManager.setupPush] messaging module loaded:', !!messaging);
    if (!messaging) {
      console.warn('[callManager.setupPush] messaging module unavailable (Expo Go or import failure)');
      return;
    }
    try {
      console.log('[callManager.setupPush] requesting notification permission');
      const authStatus = await messaging().requestPermission();
      console.log('[callManager.setupPush] permission authStatus =', authStatus);

      // iOS: force APNs registration + wait for the APNs token before asking
      // for the FCM token. Without this, getToken() can race and return "" on
      // cold launch, leaving the device un-pushable until the next foreground.
      if (Platform.OS === 'ios') {
        try {
          console.log('[callManager.setupPush] iOS: registerDeviceForRemoteMessages');
          await messaging().registerDeviceForRemoteMessages();
          for (let i = 0; i < 10; i++) {
            const apns = await messaging().getAPNSToken();
            if (apns) {
              console.log('[callManager.setupPush] iOS: APNs token ready');
              break;
            }
            console.log(`[callManager.setupPush] iOS: awaiting APNs token (${i + 1}/10)`);
            await new Promise((r) => setTimeout(r, 500));
          }
        } catch (err: any) {
          console.warn('[callManager.setupPush] iOS APNs registration failed:', err?.message);
        }
      }

      console.log('[callManager.setupPush] fetching FCM token');
      let token: string | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          token = await messaging().getToken();
          if (token) break;
        } catch (err: any) {
          console.warn(`[callManager.setupPush] getToken attempt ${i + 1} threw:`, err?.message);
        }
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
      console.log('[callManager.setupPush] FCM token =', token ? `${token.slice(0, 24)}...(${token.length} chars)` : 'EMPTY');
      if (token) await this.registerToken(token);

      messaging().onTokenRefresh((t: string) => {
        console.log('[callManager.setupPush] token refreshed');
        this.registerToken(t);
      });

      // Foreground push (app is open) — socket usually beats it; dedupe by conversationId.
      messaging().onMessage(async (msg: any) => {
        console.log('[callManager.setupPush] foreground push received:', msg?.data);
        this.handlePushData(msg?.data);
      });

      // Notification tap: app was in BACKGROUND when user tapped the banner.
      messaging().onNotificationOpenedApp((msg: any) => {
        console.log('[callManager.setupPush] notification tapped from background:', msg?.data);
        this.handlePushData(msg?.data);
      });

      // Cold-boot: app was KILLED, user tapped the banner, iOS launched us.
      const initialMsg = await messaging().getInitialNotification();
      if (initialMsg?.data) {
        console.log('[callManager.setupPush] cold-boot from notification tap:', initialMsg.data);
        this.handlePushData(initialMsg.data);
      }
    } catch (err: any) {
      console.warn('[callManager.setupPush] threw:', err?.message, err?.code);
    }
  }

  private async registerToken(token: string) {
    try {
      console.log('[callManager.registerToken] POST /push-tokens/register');
      const res: any = await api.post('/push-tokens/register', { token, platform: Platform.OS });
      console.log('[callManager.registerToken] server response:', res);
      await AsyncStorage.setItem('spidr_push_token', token);
    } catch (err: any) {
      console.warn('[callManager.registerToken] FAILED:', err?.message, err?.status);
    }
  }

  async unregisterToken() {
    try {
      const token = await AsyncStorage.getItem('spidr_push_token');
      if (token) await api.post('/push-tokens/unregister', { token });
    } catch {}
  }

  handlePushData(data: any) {
    if (!data?.type) return;
    if (data.type === 'incoming_call') {
      this.ring({
        conversationId: data.conversationId,
        peer: { id: data.callerId, name: data.callerName, avatar: data.callerAvatar },
        kind: data.kind === 'video' ? 'video' : 'voice',
        direction: 'incoming',
      });
    } else if (data.type === 'call_ended') {
      if (this.call?.conversationId === data.conversationId && this.state === 'ringing') {
        this.stopRinging('cancelled');
      } else {
        getCallKeep()?.reportEndCallWithUUID?.(callUUID(data.conversationId), 2 /* remote ended */);
      }
    }
  }

  // A ring delivered while the app was killed is stashed by the background
  // handler (index.js); pick it up on launch so answering connects the call.
  private async consumePendingBackgroundRing(forceAccept = false) {
    try {
      const raw = await AsyncStorage.getItem('spidr_pending_call');
      if (!raw) return;
      await AsyncStorage.removeItem('spidr_pending_call');
      const pending = JSON.parse(raw);
      if (Date.now() - (pending.ts || 0) > 45_000) return; // stale ring
      const call: CallInfo = {
        conversationId: pending.conversationId,
        peer: { id: pending.callerId, name: pending.callerName, avatar: pending.callerAvatar },
        kind: pending.kind === 'video' ? 'video' : 'voice',
        direction: 'incoming',
      };
      if (forceAccept) {
        this.call = call;
        this.state = 'ringing';
        await this.accept();
      } else {
        this.ring(call);
      }
    } catch {}
  }
}

export const callManager = new CallManager();
console.log('[callManager] module loaded');
