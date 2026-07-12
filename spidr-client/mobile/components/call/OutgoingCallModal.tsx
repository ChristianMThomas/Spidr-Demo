import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Easing } from 'react-native';
import { PhoneOff } from 'lucide-react-native';
import { getSocket } from '../../lib/socket';
import { Avatar } from '../ui/Avatar';

// Caller-side ringing modal — mounted by DM screen while the recipient's
// phone is ringing. Emits `call:invite` on open, `call:cancel` on close.
// Auto-dismisses when the server relays `call:accepted` or `call:declined`.
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
  const [status, setStatus] = useState<'calling' | 'declined' | 'ended'>('calling');

  // Emit the invite when the modal opens; cancel when it closes.
  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setStatus('calling');
    (async () => {
      try {
        const socket = await getSocket();
        socket.emit('call:invite', {
          recipientId,
          conversationId,
          caller: { id: caller.id, name: caller.name, avatar: caller.avatar },
          kind,
        });

        const onAccepted_ = () => { if (mounted) { onAccepted?.(); onClose(); } };
        const onDeclined = () => {
          if (!mounted) return;
          setStatus('declined');
          setTimeout(() => onClose(), 1400);
        };
        socket.on('call:accepted', onAccepted_);
        socket.on('call:declined', onDeclined);

        return () => {
          socket.off('call:accepted', onAccepted_);
          socket.off('call:declined', onDeclined);
        };
      } catch { /* non-fatal */ }
    })();
    return () => { mounted = false; };
  }, [visible, recipientId, conversationId, kind, caller.id, caller.name, caller.avatar, onAccepted, onClose]);

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
        <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 32 }}>
          /// {kind === 'video' ? 'VIDEO CALL' : 'VOICE CALL'} — {status === 'declined' ? 'DECLINED' : 'RINGING'}
        </Text>

        <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 20 }}>
          <View style={{ padding: 4, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(239,68,68,0.5)' }}>
            <Avatar uri={recipientAvatar} name={recipientName} size={110} />
          </View>
        </Animated.View>

        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 6 }} numberOfLines={1}>
          {recipientName}
        </Text>
        <Text style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 60 }}>
          {status === 'declined' ? 'call declined' : 'ringing on the web…'}
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
