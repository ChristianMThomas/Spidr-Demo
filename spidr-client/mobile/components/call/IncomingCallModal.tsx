import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing, Vibration, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Phone, PhoneOff, Video as VideoIcon } from 'lucide-react-native';
import { getSocket } from '../../lib/socket';
import { useAuth } from '../../lib/authContext';
import { Avatar } from '../ui/Avatar';

// ── Incoming call modal (mobile) ────────────────────────────────────────────
// Mounted once at the root layout. Listens for `call:incoming` from the DM
// call-signaling relay in spidr-server (socket/handlers.js) and drops a
// full-screen "ringing" sheet. Real-time audio/video streaming needs
// react-native-webrtc, which isn't available in Expo Go — so on Accept, we
// route the user into the DM with an in-call chip so both sides can chat
// while the media stream lands in Phase 2. The ringing UX itself works
// today: the recipient's phone vibrates on a loop and the modal drops down
// exactly like a native CallKit banner.

type Call = {
  conversationId: string;
  callerId: string;
  caller?: { id?: string; name?: string; avatar?: string };
  kind?: 'voice' | 'video' | 'group';
};

export default function IncomingCallModal() {
  const { user } = useAuth();
  const router = useRouter();
  const [call, setCall] = useState<Call | null>(null);
  const pulse = useRef(new Animated.Value(0.8)).current;
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;
    (async () => {
      const socket = await getSocket();
      if (!mounted) return;
      const onIncoming = (payload: any) => {
        if (!payload) return;
        // Ignore self-loopback if the server ever mis-routes.
        if (payload.callerId && payload.callerId === user?.id) return;
        setCall(payload);
        // 30s auto-decline — matches web behaviour.
        if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
        autoDismissRef.current = setTimeout(() => decline(payload), 30_000);
      };
      const onCancelled = () => dismiss();
      socket.on('call:incoming', onIncoming);
      socket.on('call:cancelled', onCancelled);
      cleanup = () => {
        socket.off('call:incoming', onIncoming);
        socket.off('call:cancelled', onCancelled);
      };
    })();
    return () => { mounted = false; cleanup?.(); };
  }, [user?.id]);

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
    // Vibration pattern loops until we stop it. Android needs the array
    // form (`[wait, buzz, wait, buzz]`); iOS ignores the pattern but rings
    // the shorter default.
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

  const dismiss = () => {
    if (autoDismissRef.current) { clearTimeout(autoDismissRef.current); autoDismissRef.current = null; }
    Vibration.cancel();
    setCall(null);
  };

  const decline = async (payload: Call | null = call) => {
    if (!payload) return;
    try {
      const socket = await getSocket();
      socket.emit('call:decline', {
        callerId: payload.callerId,
        conversationId: payload.conversationId,
      });
    } catch { /* non-fatal */ }
    dismiss();
  };

  const accept = async () => {
    if (!call) return;
    const c = call;
    dismiss();
    try {
      const socket = await getSocket();
      socket.emit('call:accept', {
        callerId: c.callerId,
        conversationId: c.conversationId,
      });
    } catch { /* non-fatal */ }
    // Navigate into the DM so the two users can at least chat while the
    // media stream is a Phase-2 (WebRTC dev client) task.
    router.push({
      pathname: '/dm/[id]',
      params: {
        id: c.conversationId,
        friendId: c.callerId,
        friendName: c.caller?.name || 'Caller',
      },
    });
  };

  if (!call) return null;

  const callerName = call.caller?.name || 'Someone';
  const callerAvatar = call.caller?.avatar;
  const isVideo = call.kind === 'video';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 32 }}>
          /// INCOMING SIGNAL
        </Text>

        <Animated.View style={{ transform: [{ scale: pulse }], shadowColor: '#ef4444', shadowOpacity: 0.6, shadowRadius: 24, marginBottom: 20 }}>
          <View style={{ padding: 4, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(239,68,68,0.5)' }}>
            <Avatar uri={callerAvatar} name={callerName} size={110} />
          </View>
        </Animated.View>

        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 6 }} numberOfLines={1}>
          {callerName}
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 60 }}>
          is {isVideo ? 'video calling' : 'calling'} you on the web…
        </Text>

        <View style={{ flexDirection: 'row', gap: 32 }}>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => decline()}
              style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}
            >
              <PhoneOff size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>Decline</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={accept}
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
