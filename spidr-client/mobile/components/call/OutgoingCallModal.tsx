import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import { PhoneOff } from 'lucide-react-native';
import { getSocket } from '../../lib/socket';
import { Avatar } from '../ui/Avatar';

// Caller-side ringing modal — mounted by DM screen while the recipient's
// phone is ringing. Emits `call:invite` on open, `call:cancel` on close.
// Auto-dismisses when the server relays `call:accepted` or `call:declined`.

// No-answer cutoff. The web caller waits 60s (DirectMessages.jsx:392); on a
// phone a minute of dead ringing reads as a hang, so mobile gives up at 20s
// and emits the same `reason: 'unanswered'` cancel the server turns into a
// missed-call row.
const RING_TIMEOUT_MS = 20_000;
export default function OutgoingCallModal({
  visible,
  onClose,
  onAccepted,
  recipientId,
  recipientName,
  recipientAvatar,
  conversationId,
  kind,
  caller,
}: {
  visible: boolean;
  onClose: () => void;
  onAccepted?: () => void;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  conversationId: string;
  kind: 'voice' | 'video';
  caller: { id: string; name?: string; avatar?: string };
}) {
  const pulse = useRef(new Animated.Value(0.9)).current;
  const [status, setStatus] = useState<'calling' | 'declined' | 'unanswered' | 'ended'>('calling');

  const callbacks = useRef({ onAccepted, onClose });
  callbacks.current = { onAccepted, onClose };
  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus('calling');
    (async () => {
      const socket = await getSocket();
      if (!mounted) return;
      const accepted = (data: any) => {
        if (data.conversationId !== conversationId || !mounted) return;
        callbacks.current.onAccepted?.();
        callbacks.current.onClose();
      };
      const ended = (data: any) => {
        if (data.conversationId !== conversationId || !mounted) return;
        setStatus(data.reason === 'declined' ? 'declined' : data.reason === 'unanswered' ? 'unanswered' : 'ended');
        dismissTimer = setTimeout(() => callbacks.current.onClose(), 1400);
      };
      socket.on('call:accepted', accepted);
      socket.on('call:ended', ended);
      cleanup = () => { socket.off('call:accepted', accepted); socket.off('call:ended', ended); };
      socket.timeout(10000).emit('call:invite', { recipientId, conversationId, kind }, (error: any, result: any) => {
        if (!mounted || (!error && result?.ok)) return;
        setStatus('ended');
        dismissTimer = setTimeout(() => callbacks.current.onClose(), 1400);
      });
    })().catch(() => { if (mounted) callbacks.current.onClose(); });
    return () => { mounted = false; clearTimeout(dismissTimer); cleanup?.(); };
  }, [visible, recipientId, conversationId, kind]);
  // Pulse the avatar while ringing.
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.92, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  const cancel = async () => {
    try {
      const socket = await getSocket();
      socket.emit('call:cancel', { recipientId, conversationId });
    } catch { /* non-fatal */ }
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={cancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 20 }}>
          <View style={{ padding: 4, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(239,68,68,0.5)' }}>
            <Avatar uri={recipientAvatar} name={recipientName} size={110} />
          </View>
        </Animated.View>

        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 6 }} numberOfLines={1}>
          {recipientName}
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 60 }}>
          {status === 'declined' ? 'call declined'
            : status === 'unanswered' ? 'no answer'
            : status === 'ended' ? 'Call ended' : 'Ringing…'}
        </Text>

        <View style={{ alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={cancel}
            style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}
          >
            <PhoneOff size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>End call</Text>
        </View>
      </View>
    </Modal>
  );
}
