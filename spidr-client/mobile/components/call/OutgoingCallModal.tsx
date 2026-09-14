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

  // Emit the invite when the modal opens; cancel when it closes.
  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    let cleanupListeners: (() => void) | undefined;
    let noAnswerTimer: ReturnType<typeof setTimeout> | undefined;
    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus('calling');
    (async () => {
      try {
        const socket = await getSocket();
        if (!mounted) return;
        // Outbound calls from mobile currently never ring the recipient while
        // inbound works. Log the emit so a device test can prove whether the
        // invite leaves at all, and with what recipientId.
        console.log('[OutgoingCallModal] emitting call:invite', {
          recipientId, conversationId, kind, connected: socket.connected, socketId: socket.id,
        });
        socket.emit('call:invite', {
          recipientId,
          conversationId,
          caller: { id: caller.id, name: caller.name, avatar: caller.avatar },
          kind,
        });

        const onAccepted_ = () => {
          clearTimeout(noAnswerTimer);
          if (mounted) { onAccepted?.(); onClose(); }
        };
        const onDeclined = () => {
          clearTimeout(noAnswerTimer);
          if (!mounted) return;
          setStatus('declined');
          dismissTimer = setTimeout(() => onClose(), 1400);
        };
        socket.on('call:accepted', onAccepted_);
        socket.on('call:declined', onDeclined);

        // Ring-out: stop pestering the callee after RING_TIMEOUT_MS and let
        // the server write the missed-call row, exactly as a manual cancel
        // would. Without this the modal rang forever.
        noAnswerTimer = setTimeout(() => {
          if (!mounted) return;
          setStatus('unanswered');
          try {
            socket.emit('call:cancel', {
              recipientId,
              conversationId,
              reason: 'unanswered',
              callerName: caller.name,
            });
          } catch { /* non-fatal */ }
          dismissTimer = setTimeout(() => { if (mounted) onClose(); }, 1400);
        }, RING_TIMEOUT_MS);

        // Hoist teardown so the actual useEffect cleanup runs it — the
        // `return` inside this async IIFE would otherwise be discarded and
        // listeners would leak (accumulating one pair per open→close cycle).
        cleanupListeners = () => {
          socket.off('call:accepted', onAccepted_);
          socket.off('call:declined', onDeclined);
        };
      } catch (err: any) {
        // Was a blanket swallow. The modal renders "Ringing…" regardless of
        // whether this block succeeded, so a throw here looked exactly like a
        // call that rang and was ignored.
        console.warn('[OutgoingCallModal] call:invite failed:', err?.message || err);
      }
    })();
    return () => {
      mounted = false;
      clearTimeout(noAnswerTimer);
      clearTimeout(dismissTimer);
      cleanupListeners?.();
    };
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
            : 'Ringing…'}
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
