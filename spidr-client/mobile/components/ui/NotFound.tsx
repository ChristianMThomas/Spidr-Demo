import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

interface NotFoundProps {
  /** What the user tried to open — "server", "conversation", "clip"… */
  what?: string;
  /** Overrides the default "go back, or home if there's nothing to go back to". */
  onBack?: () => void;
}

// Shown when a linked resource 404s — a stale invite, a deleted server, a DM
// with someone whose account is gone. Beats the infinite spinner these
// screens used to sit on when their query errored and the data stayed
// undefined forever.
export function NotFound({ what = 'page', onBack }: NotFoundProps) {
  const router = useRouter();

  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) return router.back();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050505' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        {/* Web-strand accent */}
        <Text
          style={{
            color: '#ef4444',
            fontSize: 56,
            fontWeight: '900',
            fontStyle: 'italic',
            letterSpacing: -2,
          }}
        >
          404
        </Text>

        <Text
          style={{
            color: '#fff',
            fontSize: 18,
            fontWeight: '900',
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          Oops — you got lost in the web
        </Text>

        <Text
          style={{
            color: '#71717a',
            fontSize: 13,
            marginTop: 10,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          This {what} doesn't exist, or the strand leading to it was cut.
        </Text>

        <Text
          style={{
            color: '#3f3f46',
            fontSize: 10,
            fontFamily: 'monospace',
            letterSpacing: 2,
            marginTop: 16,
          }}
        >
          STRAND_BROKEN
        </Text>

        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 28,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: 'rgba(220,38,38,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.4)',
          }}
        >
          <ArrowLeft size={15} color="#ef4444" />
          <Text
            style={{
              color: '#ef4444',
              fontSize: 11,
              fontFamily: 'monospace',
              letterSpacing: 3,
              fontWeight: '700',
            }}
          >
            GO BACK
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
