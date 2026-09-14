import React from 'react';
import {
  Dimensions,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Ellipse } from 'react-native-svg';

// Rough allowance for an on-screen keyboard so the card stays scrollable
// past it — not exact, just enough slack that nothing is stuck underneath.
const KEYBOARD_CLEARANCE = 260;

// Subtle spider-web backdrop matching the web LoginPage.
function WebLines() {
  const lines = Array.from({ length: 12 }, (_, i) => {
    const rad = (i / 12) * Math.PI * 2;
    return {
      x2: `${50 + 70 * Math.cos(rad)}%`,
      y2: `${50 + 70 * Math.sin(rad)}%`,
    };
  });
  const ellipses = [8, 18, 30, 45, 62];

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 }}
    >
      <Svg width="100%" height="100%">
        {lines.map((l, i) => (
          <Line
            key={`l-${i}`}
            x1="50%"
            y1="50%"
            x2={l.x2}
            y2={l.y2}
            stroke="#ef4444"
            strokeWidth="0.5"
          />
        ))}
        {ellipses.map((r) => (
          <Ellipse
            key={`e-${r}`}
            cx="50%"
            cy="50%"
            rx={`${r}%`}
            ry={`${r * 0.55}%`}
            stroke="#ef4444"
            strokeWidth="0.4"
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

// `motif` gates the spider-web backdrop to the Login screen only — the other
// three auth screens get the ambient glow alone, so the web reads as a
// welcome rather than as decoration on every step.
//
// Keyboard handling, take 3 — both earlier attempts routed through some
// flavor of RN's built-in keyboard-avoidance (KeyboardAvoidingView, then
// ScrollView's automaticallyAdjustKeyboardInsets) and both still dropped
// focus immediately after granting it. The "Sending onAnimatedValueUpdate
// with no listeners registered" warning nails the reason for at least
// KeyboardAvoidingView: it drives its padding with an internal Animated.Value
// whose listener gets orphaned under React Native's New Architecture (the
// default since Expo SDK 52+, so SDK 54 here), and the same instability
// shows up as the container padding out from under the just-focused input.
//
// Fix: don't use ANY built-in keyboard-avoidance component at all. Plain
// ScrollView, fixed `minHeight` (not `flexGrow`, so the card's layout never
// depends on live keyboard state), generous bottom padding so the card isn't
// flush with the screen edge. The keyboard can cover the lower part of a
// tall card — that's a scroll-to-see tradeoff, not a focus bug — and
// `keyboardShouldPersistTaps="handled"` still lets the user scroll manually
// with the keyboard up. Revisit real keyboard-follow UX once typing itself
// is confirmed solid.
export default function AuthShell({
  children,
  motif = false,
}: { children: React.ReactNode; motif?: boolean }) {
  const insets = useSafeAreaInsets();
  // A real snapshot, not `useWindowDimensions()` — that hook re-subscribes to
  // live dimension-change events, which on some RN/Fabric builds can fire
  // while a keyboard is up, defeating the whole point of a fixed minHeight.
  const [height] = React.useState(() => Dimensions.get('window').height);

  const decorations = (
    <>
      {motif && <WebLines />}
      {[
        { size: 620, opacity: 0.05 },
        { size: 440, opacity: 0.05 },
        { size: 280, opacity: 0.05 },
      ].map(({ size, opacity }) => (
        <View
          key={size}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '38%',
            left: '50%',
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
            borderRadius: 9999,
            backgroundColor: '#dc2626',
            opacity,
          }}
        />
      ))}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {decorations}
      <ScrollView
        contentContainerStyle={{
          minHeight: height - insets.top - insets.bottom,
          justifyContent: 'center',
          padding: 20,
          paddingTop: 20 + insets.top,
          // Extra room below the card so it's still scrollable up past a
          // keyboard covering the lower fields — no auto-follow, but nothing
          // is unreachable either.
          paddingBottom: 40 + insets.bottom + KEYBOARD_CLEARANCE,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function GlassCard({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  // Responsive: phone (default) fills its container; tablet caps at 560 and
  // pads more so it doesn't stretch edge-to-edge on iPads.
  const isTablet = width >= 700;
  const isLarge = width >= 900;
  const maxWidth = isLarge ? 640 : isTablet ? 560 : undefined;
  const padding = isLarge ? 40 : isTablet ? 34 : 30;
  return (
    <View
      style={{
        alignSelf: 'center',
        width: '100%',
        maxWidth,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        padding,
        // Section rhythm — matches the web card's gap-6. No drop shadow:
        // depth comes from the hairlines + inputs sitting darker than the glass.
        gap: isTablet ? 24 : 22,
      }}
    >
      {/* Top accent line */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          marginLeft: -64,
          width: 128,
          height: 1,
          backgroundColor: 'rgba(239,68,68,0.6)',
        }}
      />
      {children}
      {/* Bottom accent line */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          marginLeft: -48,
          width: 96,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}
      />
    </View>
  );
}
