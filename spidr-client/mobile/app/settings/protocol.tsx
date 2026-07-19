import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { ArrowLeft, Cpu, RefreshCw, Radio, Server as ServerIcon, KeyRound, Activity } from 'lucide-react-native';
import { getSocket, reconnectSocket } from '../../lib/socket';
import { BASE_URL, AUTH_URL } from '../../lib/config';
import { useThemeColors } from '../../lib/theme';

// ── Protocol (mobile) ────────────────────────────────────────────────────────
// Live network & socket diagnostics — the mobile counterpart of the web's
// nerve-center readouts. Everything here is measured on the device, right now:
// socket state/transport, core-API round-trip, and the endpoints in play.

export default function Protocol() {
  const router = useRouter();
  const colors = useThemeColors();

  const [socketInfo, setSocketInfo] = useState<{ connected: boolean; id?: string; transport?: string }>({ connected: false });
  const [ping, setPing] = useState<number | null>(null);
  const [pinging, setPinging] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const readSocket = useCallback(async () => {
    try {
      const s = await getSocket();
      setSocketInfo({
        connected: s.connected,
        id: s.id ?? undefined,
        transport: (s as any).io?.engine?.transport?.name,
      });
    } catch {
      setSocketInfo({ connected: false });
    }
  }, []);

  const measurePing = useCallback(async () => {
    setPinging(true);
    try {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/health`);
      setPing(res.ok ? Date.now() - t0 : null);
    } catch {
      setPing(null);
    }
    setPinging(false);
  }, []);

  useEffect(() => {
    readSocket();
    measurePing();
    const interval = setInterval(readSocket, 3000);
    return () => clearInterval(interval);
  }, [readSocket, measurePing]);

  const reconnect = async () => {
    setReconnecting(true);
    try { await reconnectSocket(); } catch {}
    setTimeout(() => { readSocket(); setReconnecting(false); }, 1200);
  };

  const pingColor = ping === null ? '#ef4444' : ping < 150 ? '#22c55e' : ping < 400 ? '#eab308' : '#ef4444';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(132,204,22,0.1)', borderWidth: 1, borderColor: 'rgba(132,204,22,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Cpu size={18} color="#84cc16" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>PROTOCOL</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Live network and socket diagnostics.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Socket */}
        <View style={[card(colors.surface), { borderColor: socketInfo.connected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }]}>
          <Row Icon={Radio} iconColor={socketInfo.connected ? '#22c55e' : '#ef4444'} label="Realtime Socket">
            <Mono color={socketInfo.connected ? '#22c55e' : '#ef4444'}>
              {socketInfo.connected ? '● CONNECTED' : '○ DISCONNECTED'}
            </Mono>
          </Row>
          <KV k="SOCKET ID" v={socketInfo.id || '—'} />
          <KV k="TRANSPORT" v={(socketInfo.transport || 'none').toUpperCase()} />
          <TouchableOpacity
            onPress={reconnect}
            disabled={reconnecting}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <RefreshCw size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>
              {reconnecting ? 'RECONNECTING…' : 'FORCE RECONNECT'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Latency */}
        <View style={card(colors.surface)}>
          <Row Icon={Activity} iconColor={pingColor} label="Core API Round-Trip">
            <Mono color={pingColor}>{pinging ? 'MEASURING…' : ping === null ? 'UNREACHABLE' : `${ping} MS`}</Mono>
          </Row>
          <TouchableOpacity
            onPress={measurePing}
            disabled={pinging}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
          >
            <Activity size={12} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>PING AGAIN</Text>
          </TouchableOpacity>
        </View>

        {/* Endpoints */}
        <View style={card(colors.surface)}>
          <Row Icon={ServerIcon} iconColor="#60a5fa" label="Core API" />
          <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace' }} numberOfLines={2}>{BASE_URL}</Text>
          <View style={{ height: 12 }} />
          <Row Icon={KeyRound} iconColor="#a855f7" label="Auth Service" />
          <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace' }} numberOfLines={2}>{AUTH_URL}</Text>
        </View>

        {/* Build */}
        <View style={card(colors.surface)}>
          <KV k="APP VERSION" v={`v${Constants.expoConfig?.version ?? '1.9'}`} />
          <KV k="RUNTIME" v={Constants.executionEnvironment === 'storeClient' ? 'EXPO GO' : 'NATIVE BUILD'} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ Icon, iconColor, label, children }: { Icon: any; iconColor: string; label: string; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: iconColor + '1F', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={iconColor} />
      </View>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', flex: 1 }}>{label}</Text>
      {children}
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ color: '#52525b', fontSize: 10, letterSpacing: 1.5 }}>{k}</Text>
      <Text style={{ color: '#a1a1aa', fontSize: 11, fontFamily: 'monospace' }} numberOfLines={1}>{v}</Text>
    </View>
  );
}

function Mono({ children, color }: { children: React.ReactNode; color: string }) {
  return <Text style={{ color, fontSize: 10, fontFamily: 'monospace', letterSpacing: 1.5 }}>{children}</Text>;
}

const card = (surface: string) => ({
  backgroundColor: surface,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
  borderRadius: 14,
  padding: 16,
});
