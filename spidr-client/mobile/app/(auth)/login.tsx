import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import { useAuth } from '../../lib/authContext';
import AuthShell, { GlassCard } from '../../components/auth/AuthShell';
import { Head, Field, Checkbox, Btn, Notice, Foot, C, T } from '../../components/auth/authKit';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email || !password) {
      setError('Email and password required');
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
    <AuthShell motif>
      <GlassCard>
        <Head eyebrow="Welcome back to the web" />

        <View style={{ gap: 16 }}>
          <Field
            label="Email"
            icon={Mail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Field
            label="Password"
            icon={Lock}
            placeholder="••••••••••"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
            trailing={
              <TouchableOpacity
                onPress={() => setShowPw((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPw ? <EyeOff size={16} strokeWidth={1.75} color={C.ink30} />
                        : <Eye size={16} strokeWidth={1.75} color={C.ink30} />}
              </TouchableOpacity>
            }
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Checkbox checked={remember} onChange={setRemember}>
              <Text style={{ fontSize: 13, color: C.ink55 }}>Remember me</Text>
            </Checkbox>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ flexShrink: 0 }}
            >
              <Text style={T.link} numberOfLines={1}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {error && <Notice title={error} />}

          <Btn label="Sign in" onPress={submit} busy={busy} />
        </View>

        <Text style={[T.meta, { textAlign: 'center' }]}>
          We'll send a 6-digit code to your email, or use your authenticator app.
        </Text>

        <Foot
          question="New to Spidr?"
          action="Create an account"
          onPress={() => router.push('/(auth)/register')}
        />
      </GlassCard>
    </AuthShell>
  );
}
