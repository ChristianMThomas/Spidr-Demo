import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, User, AtSign } from 'lucide-react-native';
import { useAuth } from '../../lib/authContext';
import AuthShell, { GlassCard } from '../../components/auth/AuthShell';
import { Head, Field, Checkbox, Btn, Notice, Foot, PasswordChecklist, C, T } from '../../components/auth/authKit';
import { isPasswordStrong, PASSWORD_REQUIREMENTS_MESSAGE } from '../../lib/passwordPolicy';

// Terms + Privacy live on the public marketing site. Linking.openURL hands off
// to the system browser, so the half-filled signup form survives in the app.
const LEGAL_URL = 'https://www.spidrapp.com/#privacy';
const openLegal = () => { Linking.openURL(LEGAL_URL).catch(() => {}); };

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
  const [agreed, setAgreed] = useState(false);

  const submit = async () => {
    if (!username || !email || !password) {
      setError('Alias, email, and password required');
      return;
    }
    if (!isPasswordStrong(password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
      return;
    }
    if (!agreed) {
      setError('Please accept the Terms and Privacy Policy to continue.');
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
        <Head eyebrow="Join the web" />

        <View style={{ gap: 16 }}>
          <Field
            label="Display name"
            icon={User}
            placeholder="What should we call you?"
            value={fullName}
            onChangeText={setFullName}
          />

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
            placeholder="At least 8 characters"
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
          <PasswordChecklist password={password} />

          {/* Alias — the API needs @username#tag, so this takes the single
              optional slot rather than adding a fifth field. One container
              hosts both inputs; Field's single input can't express the split. */}
          <View style={{ gap: 6 }}>
            <Text style={T.label}>Your alias</Text>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                height: 46, paddingHorizontal: 14, borderRadius: 12,
                backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
              }}
            >
              <AtSign size={16} strokeWidth={1.75} color={C.ink30} />
              <TextInput
                // @ts-ignore — nativewind's cssInterop escape hatch; see AuthShell.tsx
                cssInterop={false}
                placeholder="username"
                placeholderTextColor={C.ink22}
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
                style={{ flex: 1, minWidth: 0, color: C.white, fontSize: 14, padding: 0 }}
              />
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>#</Text>
              <TextInput
                // @ts-ignore — nativewind's cssInterop escape hatch; see AuthShell.tsx
                cssInterop={false}
                placeholder="abcd"
                placeholderTextColor={C.ink22}
                maxLength={4}
                autoCapitalize="none"
                value={discriminator}
                onChangeText={(v) => setDiscriminator(v.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4))}
                style={{ width: 52, color: C.white, fontSize: 14, textAlign: 'center', letterSpacing: 2, padding: 0 }}
              />
            </View>
            <Text style={T.meta}>Leave the tag blank and we'll pick one for you.</Text>
          </View>

          <Checkbox checked={agreed} onChange={setAgreed}>
            <Text style={{ fontSize: 13, color: C.ink55 }}>
              I agree to the{' '}
              <Text style={{ color: C.white }} onPress={openLegal}>Terms</Text>
              {' '}and{' '}
              <Text style={{ color: C.white }} onPress={openLegal}>Privacy Policy</Text>
            </Text>
          </Checkbox>

          {error && <Notice title={error} />}

          <Btn label="Create account" onPress={submit} busy={busy} />
        </View>

        <Text style={[T.meta, { textAlign: 'center' }]}>
          We'll send a verification code to your email.
        </Text>

        <Foot
          question="Already have an account?"
          action="Sign in"
          onPress={() => router.replace('/(auth)/login')}
        />
      </GlassCard>
    </AuthShell>
  );
}
