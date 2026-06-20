import React from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Svg, { Line, Ellipse } from 'react-native-svg';

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

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#080808' }}
    >
      <WebLines />

      {/* Ambient red blobs */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '15%',
          left: '-20%',
          width: 360,
          height: 360,
          borderRadius: 9999,
          backgroundColor: '#dc2626',
          opacity: 0.07,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '-15%',
          width: 300,
          height: 300,
          borderRadius: 9999,
          backgroundColor: '#7f1d1d',
          opacity: 0.06,
        }}
      />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        padding: 26,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 60,
        elevation: 12,
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
