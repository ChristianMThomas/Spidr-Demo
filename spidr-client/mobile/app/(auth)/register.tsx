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

const LABEL = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: 10,
  fontWeight: '800' as const,
  letterSpacing: 2,
  marginBottom: 6,
};

const INPUT = {
  backgroundColor: 'rgba(0,0,0,0.6)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.10)',
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 13,
  color: '#fff',
  fontSize: 14,
};

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [discriminator, setDiscriminator] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username || !email || !password) {
      setError('Username, email, and passcode required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await register({
        username: username.trim(),
        email: email.trim(),
        password,
        // @ts-ignore — passes through to apiClient
        full_name: fullName.trim() || undefined,
        // @ts-ignore
        discriminator: discriminator.trim() || undefined,
      });
      if (res?.requiresVerification) router.push('/(auth)/verify');
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Registration failed');
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
            onPress={() => router.replace('/(auth)/login')}
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
              INITIALIZE
            </Text>
          </TouchableOpacity>
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
              FORM CONNECTION
            </Text>
          </TouchableOpacity>
        </View>

        {/* FULL NAME */}
        <Text style={LABEL}>FULL NAME</Text>
        <TextInput
          style={[INPUT, { marginBottom: 14 }]}
          placeholder="Your name"
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={fullName}
          onChangeText={setFullName}
        />

        {/* ALIAS — @username + #tag in one glass row */}
        <Text style={LABEL}>ALIAS</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#050505',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 14,
            paddingHorizontal: 12,
            marginBottom: 6,
          }}
        >
          <Text style={{ color: 'rgba(239,68,68,0.7)', fontSize: 14, marginRight: 6 }}>@</Text>
          <TextInput
            style={{
              flex: 1,
              color: '#fff',
              fontSize: 14,
              paddingVertical: 13,
            }}
            placeholder="username"
            placeholderTextColor="rgba(255,255,255,0.2)"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, marginHorizontal: 6 }}>#</Text>
          <TextInput
            style={{
              width: 64,
              color: '#fff',
              fontSize: 14,
              paddingVertical: 13,
              textAlign: 'center',
              letterSpacing: 2,
            }}
            placeholder="abcd"
            placeholderTextColor="rgba(255,255,255,0.2)"
            autoCapitalize="none"
            maxLength={4}
            value={discriminator}
            onChangeText={(t) => setDiscriminator(t.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4))}
          />
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginBottom: 14, lineHeight: 14 }}>
          Your @username and a 4-character tag together make you unique. Leave the tag empty and we'll pick one for you.
        </Text>

        {/* SECURE SIGNAL */}
        <Text style={LABEL}>SECURE SIGNAL</Text>
        <TextInput
          style={[INPUT, { marginBottom: 14 }]}
          placeholder="name@domain.com"
          placeholderTextColor="rgba(255,255,255,0.2)"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {/* PASSCODE */}
        <Text style={LABEL}>PASSCODE</Text>
        <View style={{ position: 'relative', marginBottom: 14 }}>
          <TextInput
            style={[INPUT, { paddingRight: 44 }]}
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
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2.5 }}>
              JOIN NETWORK
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
          A verification code will be sent to your email.
        </Text>
      </GlassCard>
    </AuthShell>
  );
}
