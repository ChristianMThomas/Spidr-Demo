import React from 'react';
import { View, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type FeedTab = 'web' | 'linked';

interface FeedTabBarProps {
  active: FeedTab;
  onChange: (t: FeedTab) => void;
}

// Floats over the top of the video. Two pills (WEB / LINKED) with a red
// underline on the active one. Mirrors the web's THE WEB / LINKED NODES
// sub-tabs — other 5 web sub-tabs deferred to Phase 2.
export function FeedTabBar({ active, onChange }: FeedTabBarProps) {
  // The feed is full-bleed (no SafeAreaView, so video runs under the status
  // bar) — the pills have to clear the notch themselves. Android insets can
  // report 0 outside edge-to-edge, so fall back to the status bar height.
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        paddingTop: topInset + 12,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
      }}
    >
      <Pill label="THE WEB" active={active === 'web'} onPress={() => onChange('web')} />
      <Pill label="LINKED" active={active === 'linked'} onPress={() => onChange('linked')} />
    </View>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={6} activeOpacity={0.7}>
      <Text
        style={{
          color: active ? '#fff' : 'rgba(255,255,255,0.6)',
          fontSize: 13,
          fontWeight: '900',
          letterSpacing: 2,
          textShadowColor: 'rgba(0,0,0,0.85)',
          textShadowRadius: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          height: 2,
          marginTop: 4,
          backgroundColor: active ? '#ef4444' : 'transparent',
          borderRadius: 1,
        }}
      />
    </TouchableOpacity>
  );
}
