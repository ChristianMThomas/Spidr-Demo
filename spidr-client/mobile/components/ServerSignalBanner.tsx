import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtSign, MessageCircle } from 'lucide-react-native';
import { useAuth } from '../lib/authContext';
import { getSocket } from '../lib/socket';

// ── In-app server signal banner (mobile) ────────────────────────────────────
// Mounted once at the root layout. This is the FOREGROUND twin of the iOS
// lock-screen banner: same three-row anatomy — who / where / what — behind the
// SERVER's icon rather than the sender's, because the sender is already named
// on the first line and the picture is better spent saying which room lit up.
//
// It listens on `server:signal`, not `message:new`: a socket only sits in a
// channel room while that channel is on screen, so `message:new` can't fire
// for the server you aren't looking at. `server:signal` is emitted to the
// member's own `user:<id>` room by the Message post-save hook and arrives with
// the server name, icon and channel already resolved.

const ACCENT = { server_mention: '#ef4444', server_message: '#3b82f6' } as const;
const DWELL_MS = 6000;

interface Signal {
  id: string;
  type: keyof typeof ACCENT;
  serverId: string;
  serverName: string;
  serverIcon: string;
  channelId: string;
  channelName: string;
  senderName: string;
  body: string;
}

export default function ServerSignalBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [signal, setSignal] = useState<Signal | null>(null);
  const slide = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read inside the socket handler so the listener doesn't need re-binding
  // every time the user navigates.
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    let cleanup: (() => void) | undefined;

    (async () => {
      const socket = await getSocket();
      if (!mounted) return;

      const onSignal = (p: any) => {
        if (!p || String(p.senderId) === String(user.id)) return;
        // Already reading that channel — the message is landing in the
        // transcript behind the banner, so a banner would just be noise.
        if (pathRef.current?.includes(`/channel/${p.channelId}`)) return;
        setSignal({
          id: p.messageId || String(Date.now()),
          type: p.type === 'server_mention' ? 'server_mention' : 'server_message',
          serverId: p.serverId || '',
          serverName: p.serverName || '',
          serverIcon: p.serverIcon || '',
          channelId: p.channelId || '',
          channelName: p.channelName || '',
          senderName: p.senderName || 'Someone',
          body: p.body || '',
        });
      };

      socket.on('server:signal', onSignal);
      cleanup = () => socket.off('server:signal', onSignal);
    })();

    return () => { mounted = false; cleanup?.(); };
  }, [user?.id]);

  // Drive the slide whenever a new signal replaces the current one. A rapid
  // second message re-arms the timer rather than stacking a second card.
  useEffect(() => {
    if (!signal) return;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (dismissRef.current) clearTimeout(dismissRef.current);
    dismissRef.current = setTimeout(hide, DWELL_MS);
    return () => { if (dismissRef.current) clearTimeout(dismissRef.current); };
  }, [signal?.id]);

  const hide = () => {
    Animated.timing(slide, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setSignal(null));
  };

  if (!signal) return null;

  const accent = ACCENT[signal.type];
  const isMention = signal.type === 'server_mention';
  const Badge = isMention ? AtSign : MessageCircle;
  const initials = (signal.serverName || 'SP').trim().slice(0, 2).toUpperCase();

  const open = () => {
    if (dismissRef.current) clearTimeout(dismissRef.current);
    hide();
    if (signal.serverId) {
      router.push({ pathname: '/server/[id]', params: { id: signal.serverId } });
    }
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 90,
        opacity: slide,
        transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }],
      }}
    >
      <Pressable
        onPress={open}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          backgroundColor: 'rgba(11,11,13,0.97)',
          borderWidth: 1,
          borderColor: accent + '55',
          borderRadius: 14,
          paddingLeft: 14,
          paddingRight: 12,
          paddingVertical: 10,
          overflow: 'hidden',
          // Mentions carry a red halo so they read differently at a glance.
          shadowColor: isMention ? '#ef4444' : '#000',
          shadowOpacity: isMention ? 0.45 : 0.5,
          shadowRadius: isMention ? 14 : 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        {/* Accent rail */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: accent }} />

        <View style={{ position: 'relative' }}>
          {signal.serverIcon ? (
            <Image
              source={{ uri: signal.serverIcon }}
              style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#2a2a2a' }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View
              style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}
              className="items-center justify-center"
            >
              <Text className="text-white/60 font-black" style={{ fontSize: 12 }}>{initials}</Text>
            </View>
          )}
          <View
            style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: accent,
              borderWidth: 2, borderColor: '#0b0b0d',
            }}
            className="items-center justify-center"
          >
            <Badge size={8} color="#fff" strokeWidth={3} />
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} className="text-white font-bold" style={{ fontSize: 14 }}>
            {signal.senderName}
          </Text>

          {!!signal.serverName && (
            <Text
              numberOfLines={1}
              className="font-semibold uppercase"
              style={{ fontSize: 10, letterSpacing: 0.8, marginTop: 2, color: isMention ? accent : accent + 'cc' }}
            >
              {isMention ? '@ ' : ''}{signal.serverName}
              {signal.channelName ? ` · #${signal.channelName}` : ''}
            </Text>
          )}

          {!!signal.body && (
            <Text numberOfLines={2} className="text-zinc-300" style={{ fontSize: 12, marginTop: 4, lineHeight: 16 }}>
              {signal.body}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
