import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated } from 'react-native';

// Animated pill switch tinted with the active theme accent.
export function Toggle({
  value, onChange, accent, disabled,
}: { value: boolean; onChange: (v: boolean) => void; accent: string; disabled?: boolean }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [value, anim]);

  return (
    <TouchableOpacity
      onPress={() => !disabled && onChange(!value)}
      activeOpacity={0.8}
      disabled={disabled}
      hitSlop={6}
      style={{
        width: 50, height: 28, borderRadius: 999, justifyContent: 'center',
        backgroundColor: value ? accent + '33' : '#0a0a0a',
        borderWidth: 1, borderColor: value ? accent + '88' : 'rgba(255,255,255,0.1)',
      }}
    >
      <Animated.View
        style={{
          width: 20, height: 20, borderRadius: 999,
          backgroundColor: value ? accent : '#3f3f46',
          marginLeft: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 25] }),
        }}
      />
    </TouchableOpacity>
  );
}
