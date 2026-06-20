import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../../lib/authContext';
import AuthShell, { GlassCard } from '../../components/auth/AuthShell';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password) {
      setError('Email and passcode required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await login(email.trim(), password);
      if (res?.requires2FA) {
        router.push('/(auth)/verify');
        return;
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(
        e?.data?.error ||
          e?.message ||
          'Connection failed — make sure the server is running'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <GlassCard>
        {/* Logo + title */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 56, height: 56, marginBottom: 10 }}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1.5 }}>
              SPID
            </Text>
            <Text style={{ color: '#ef4444', fontSize: 36, fontWeight: '900', letterSpacing: -1.5 }}>
              R
            </Text>
          </View>
          <Text
            style={{
              color: 'rgba(255,255,255,0.25)',
              fontSize: 10,
              letterSpacing: 3.5,
              marginTop: 4,
            }}
          >
            MODULE NEXUS GATEWAY
          </Text>
        </View>

        {/* Mode toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 14,
            padding: 4,
            marginBottom: 22,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 11,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: '#dc2626',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>
              INITIALIZE
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            style={{ flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontWeight: '800',
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              FORM CONNECTION
            </Text>
          </TouchableOpacity>
        </View>

        {/* SECURE SIGNAL */}
        <Text
          style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          SECURE SIGNAL
        </Text>
        <TextInput
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 13,
            color: '#fff',
            fontSize: 14,
            marginBottom: 14,
          }}
          placeholder="name@domain.com"
          placeholderTextColor="rgba(255,255,255,0.2)"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {/* PASSCODE */}
        <Text
          style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          PASSCODE
        </Text>
        <View style={{ position: 'relative', marginBottom: 6 }}>
          <TextInput
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingRight: 44,
              paddingVertical: 13,
              color: '#fff',
              fontSize: 14,
            }}
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.2)"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPw((v) => !v)}
            style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showPw ? (
              <EyeOff size={16} color="rgba(255,255,255,0.5)" />
            ) : (
              <Eye size={16} color="rgba(255,255,255,0.5)" />
            )}
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: 'flex-end', marginBottom: 14 }}>
          <TouchableOpacity onPress={() => {}}>
            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
              Forgot passcode? → Override Protocol
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.3)',
              borderRadius: 10,
              padding: 10,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#f87171', fontSize: 12, textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={submit}
          disabled={busy}
          style={{
            backgroundColor: '#dc2626',
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            shadowColor: '#ef4444',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 6,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={{ color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2.5 }}
            >
              ACCESS GRID
            </Text>
          )}
        </TouchableOpacity>

        <Text
          style={{
            color: 'rgba(255,255,255,0.15)',
            fontSize: 10,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          A 6-digit code will be sent to your email — or use your authenticator app.
        </Text>
      </GlassCard>
    </AuthShell>
  );
}
