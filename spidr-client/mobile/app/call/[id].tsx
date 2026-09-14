import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Platform, StatusBar } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Volume2,
  VolumeX,
  PhoneOff,
} from 'lucide-react-native';
import { callManager } from '../../lib/callManager';
import { emitter } from '../../lib/eventEmitter';
import { getWebRTC } from '../../lib/nativeCalls';
import { Avatar } from '../../components/ui/Avatar';

// In-call screen — mounted after callManager transitions to 'active'.
// Reads live state off callManager, listens to its emitter for updates.
// The manager owns lifecycle; this screen is pure UI + button dispatch.

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    peerId?: string;
    peerName?: string;
    peerAvatar?: string;
    kind?: string;
  }>();

  const isVideo = params.kind === 'video';
  const peerName = params.peerName || 'Call';
  const peerAvatar = params.peerAvatar;

  const [isMuted, setMuted] = useState(callManager.isMuted);
  const [isSpeaker, setSpeaker] = useState(callManager.isSpeaker);
  const [isCameraOff, setCameraOff] = useState(callManager.isCameraOff);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, any>>(callManager.remoteStreams);
  const [localStream, setLocalStream] = useState<any>(callManager.localStream);
  const [elapsed, setElapsed] = useState(0);

  const pulse = useRef(new Animated.Value(0.95)).current;

  // Subscribe to callManager events.
  useEffect(() => {
    const offState = emitter.on('call:state', ({ state }: any) => {
      if (state === 'idle') {
        // Call ended somewhere else (peer hung up, manager.end fired, etc.)
        router.back();
      } else {
        // Re-sync in case we mounted mid-flight.
        setLocalStream(callManager.localStream);
      }
    });
    const offStreams = emitter.on('call:streams', (streams: any) => {
      setRemoteStreams({ ...(streams || {}) });
    });
    const offControls = emitter.on('call:controls', (c: any) => {
      setMuted(!!c?.isMuted);
      setSpeaker(!!c?.isSpeaker);
      setCameraOff(!!c?.isCameraOff);
    });
    // Sync local stream if it materialises after mount.
    const syncLocal = setInterval(() => {
      if (callManager.localStream && callManager.localStream !== localStream) {
        setLocalStream(callManager.localStream);
      }
    }, 500);
    return () => {
      offState();
      offStreams();
      offControls();
      clearInterval(syncLocal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Duration counter.
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Pulse the avatar in voice mode.
  useEffect(() => {
    if (isVideo) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.95, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isVideo, pulse]);

  const RTCView = useMemo(() => {
    // Guarded: null in Expo Go, real component in the dev build.
    const wrtc = getWebRTC();
    return wrtc?.RTCView || null;
  }, []);

  const primaryRemoteStream = useMemo(() => {
    const values = Object.values(remoteStreams || {});
    return values[0] || null;
  }, [remoteStreams]);

  // A remote stream existing is NOT the same as it carrying video — a peer can
  // answer a video call audio-only, which is exactly what the web client does
  // today. Gating the RTCView on stream existence alone painted a black
  // surface AND suppressed the avatar fallback below, so you got a dead black
  // screen with no name and no face while still hearing them.
  // remoteStreams stays in the dep list on purpose: callManager replaces the
  // map object on every ontrack, so a video track arriving late (or the peer
  // switching their camera on mid-call) re-runs this.
  const remoteHasVideo = useMemo(() => {
    const tracks = primaryRemoteStream?.getVideoTracks?.() || [];
    return tracks.some((t: any) => t.readyState !== 'ended');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryRemoteStream, remoteStreams]);

  const showRemoteVideo = isVideo && !!RTCView && !!primaryRemoteStream && remoteHasVideo;

  const end = () => {
    callManager.end();
    // The state listener will router.back(), but do it eagerly too.
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Video primary layer */}
        {showRemoteVideo ? (
          <RTCView
            streamURL={primaryRemoteStream.toURL?.()}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            objectFit="cover"
            mirror={false}
          />
        ) : null}

        {/* Voice mode centered content — also the fallback for a video call
            whose peer isn't sending video, so you always see who you're on
            with instead of a black rectangle. */}
        {!showRemoteVideo ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 24 }}>
              <View style={{ padding: 4, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(239,68,68,0.5)' }}>
                <Avatar uri={peerAvatar} name={peerName} size={140} />
              </View>
            </Animated.View>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 6 }} numberOfLines={1}>
              {peerName}
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {formatElapsed(elapsed)}
            </Text>
          </View>
        ) : null}

        {/* Header overlay */}
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 12, alignItems: 'center' }}>
            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 3 }}>
              /// {isVideo ? 'VIDEO CALL' : 'VOICE CALL'} — CONNECTED
            </Text>
            {isVideo ? (
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 6 }} numberOfLines={1}>
                {peerName} · {formatElapsed(elapsed)}
              </Text>
            ) : null}
          </View>
        </SafeAreaView>

        {/* Self-view PIP (video only) */}
        {isVideo && RTCView && localStream ? (
          <View
            style={{
              position: 'absolute',
              top: (Platform.OS === 'ios' ? 60 : 32),
              right: 16,
              width: 100,
              height: 140,
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              backgroundColor: '#111',
            }}
          >
            <RTCView
              streamURL={localStream.toURL?.()}
              style={{ flex: 1 }}
              objectFit="cover"
              mirror
            />
          </View>
        ) : null}

        {/* Controls */}
        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <View style={{ paddingHorizontal: 24, paddingBottom: 16, paddingTop: 20, flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
            <ControlButton
              label={isMuted ? 'Muted' : 'Mute'}
              active={isMuted}
              onPress={() => { callManager.toggleMute(); setMuted(callManager.isMuted); }}
              Icon={isMuted ? MicOff : Mic}
            />
            <ControlButton
              label={isSpeaker ? 'Speaker' : 'Earpiece'}
              active={isSpeaker}
              onPress={() => { callManager.toggleSpeaker(); setSpeaker(callManager.isSpeaker); }}
              Icon={isSpeaker ? Volume2 : VolumeX}
            />
            {isVideo ? (
              <ControlButton
                label={isCameraOff ? 'Cam off' : 'Cam'}
                active={isCameraOff}
                onPress={() => { callManager.toggleCamera(); setCameraOff(callManager.isCameraOff); }}
                Icon={isCameraOff ? VideoOff : VideoIcon}
              />
            ) : null}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={end}
                style={{
                  width: 68, height: 68, borderRadius: 34,
                  backgroundColor: '#dc2626',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <PhoneOff size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>End</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

function ControlButton({
  label,
  active,
  onPress,
  Icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  Icon: any;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <TouchableOpacity
        onPress={onPress}
        style={{
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: active ? 'rgba(239,68,68,0.85)' : 'rgba(255,255,255,0.12)',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1,
          borderColor: active ? 'rgba(239,68,68,1)' : 'rgba(255,255,255,0.18)',
        }}
      >
        <Icon size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{label.toUpperCase()}</Text>
    </View>
  );
}
