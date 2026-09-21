import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing, Vibration, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, PhoneOff, Video as VideoIcon } from 'lucide-react-native';
import { useAuth } from '../../lib/authContext';
import { emitter } from '../../lib/eventEmitter';
import { callManager, CallInfo } from '../../lib/callManager';
import { Avatar } from '../ui/Avatar';

// ── Incoming call modal (mobile) ────────────────────────────────────────────
// Mounted once at the root layout. The ringing itself is owned by
// lib/callManager (socket `call:incoming` + FCM push + CallKeep for
// background/killed); this component is the FOREGROUND ring surface — a
// full-screen sheet with vibration — plus navigation into the active call
// screen once media connects. In Expo Go (no react-native-webrtc) accepting
// signals the caller and falls back to opening the DM.

export default function IncomingCallModal() {
  const { user } = useAuth();
  const router = useRouter();
  const [call, setCall] = useState<CallInfo | null>(null);
  const [elsewhere, setElsewhere] = useState<any>(null);
  const [transferring, setTransferring] = useState(false);
  const pulse = useRef(new Animated.Value(0.8)).current;
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Boot the call brain once we know who's logged in.
  useEffect(() => {
    if (user?.id) callManager.init(user);
  }, [user?.id]);

  useEffect(() => {
    const updateAccount = (calls: any[]) => setElsewhere(calls.find(c => c.canTransfer) || null);
    updateAccount(callManager.accountCalls);
    const offAccount = emitter.on('call:account', updateAccount);
    const offError = emitter.on('call:error', (message: string) => Alert.alert('Call unavailable', message));
    const offState = emitter.on('call:state', ({ state, call: c }: any) => {
      if (state === 'ringing' && c?.direction === 'incoming') {
        setCall(c);
        if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
        // 30s auto-decline — matches web behaviour.
      } else {
        if (autoDismissRef.current) { clearTimeout(autoDismissRef.current); autoDismissRef.current = null; }
        Vibration.cancel();
        setCall(null);
        if (state === 'active' && c) {
          router.push({
            pathname: '/call/[id]',
            params: {
              id: c.conversationId,
              peerId: c.peer?.id || '',
              peerName: c.peer?.name || 'Call',
              peerAvatar: c.peer?.avatar || '',
              kind: c.kind,
            },
          } as any);
        }
      }
    });

    // Expo Go path: media impossible, but the accept was signalled — drop
    // into the DM like before so the two can still chat.
    const offUnsupported = emitter.on('call:unsupported', (c: any) => {
      if (!c) return;
      if (c.direction === 'incoming') {
        router.push({
          pathname: '/dm/[id]',
          params: { id: c.conversationId, friendId: c.peer?.id, friendName: c.peer?.name || 'Caller' },
        } as any);
      }
      Alert.alert(
        'Live audio needs the full app',
        'This build (Expo Go) can\'t stream call audio. Install the Spidr dev build to talk — the other side has been notified you accepted.',
      );
    });

    return () => { offState(); offUnsupported(); offAccount(); offError(); };
  }, [router]);

  // Pulse avatar + vibrate phone while ringing.
  useEffect(() => {
    if (!call) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.92, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 800, 400, 800], true);
    } else {
      Vibration.vibrate();
    }
    return () => {
      loop.stop();
      Vibration.cancel();
    };
  }, [call, pulse]);

  if (!call && elsewhere) return <View style={{ position: 'absolute', bottom: 90, left: 16, right: 16, zIndex: 500, padding: 16, backgroundColor: '#111113', borderRadius: 8, borderWidth: 1, borderColor: '#3f3f46' }}>
    <Text style={{ color: '#fff', marginBottom: 10 }}>Call active on another device</Text>
    <TouchableOpacity disabled={transferring} onPress={async () => {
      setTransferring(true);
      try { await callManager.transferHere(elsewhere.callId); } catch (error: any) { Alert.alert('Could not switch call', error.message); } finally { setTransferring(false); }
    }} style={{ padding: 12, backgroundColor: '#16a34a', borderRadius: 8 }}>
      <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{transferring ? 'Connecting...' : 'Switch to this device'}</Text>
    </TouchableOpacity>
  </View>;
  if (!call) return null;

  const callerName = call.peer?.name || 'Someone';
  const isVideo = call.kind === 'video';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 32 }}>
          /// INCOMING SIGNAL
        </Text>

        <Animated.View style={{ transform: [{ scale: pulse }], shadowColor: '#ef4444', shadowOpacity: 0.6, shadowRadius: 24, marginBottom: 20 }}>
          <View style={{ padding: 4, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(239,68,68,0.5)' }}>
            <Avatar uri={call.peer?.avatar} name={callerName} size={110} />
          </View>
        </Animated.View>

        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 6 }} numberOfLines={1}>
          {callerName}
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 60 }}>
          incoming {isVideo ? 'video call' : 'voice call'}…
        </Text>

        <View style={{ flexDirection: 'row', gap: 32 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => callManager.decline()}
              style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}
            >
              <PhoneOff size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>Decline</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => callManager.accept()}
              style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}
            >
              {isVideo ? <VideoIcon size={26} color="#fff" /> : <Phone size={26} color="#fff" />}
            </TouchableOpacity>
            <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>Accept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
