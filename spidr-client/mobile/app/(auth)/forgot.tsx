import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, Lock, KeyRound, Eye, EyeOff } from 'lucide-react-native';
import { auth } from '../../lib/apiClient';
import AuthShell, { GlassCard } from '../../components/auth/AuthShell';
import { Head, Field, Btn, Notice, PasswordChecklist, C, T } from '../../components/auth/authKit';
import { isPasswordStrong, PASSWORD_REQUIREMENTS_MESSAGE } from '../../lib/passwordPolicy';

/**
 * Password reset — three steps in one card, matching the web ForgotPassword.
 *   identify → email in, recovery code out
 *   verify   → 6-digit code
 *   reset    → new password
 * Calmest of the four auth screens: no web motif, one field per step.
 */
export default function Forgot() {
  const router = useRouter();
  const [step, setStep] = useState<'identify' | 'verify' | 'reset'>('identify');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [token, setToken] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const identify = async () => {
    if (!email) { setError('Enter the email on your account'); return; }
    setBusy(true); setError(null);
    try {
      await auth.overrideRequest(email.trim());
      setStep('verify');
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Failed to locate account');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (code.length < 6) { setError('Enter the 6-digit code'); return; }
    setBusy(true); setError(null);
    try {
      const data = await auth.overrideVerify(email.trim(), code);
      setToken(data.resetToken);
      setStep('reset');
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Invalid code');
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!isPasswordStrong(newPw)) { setError(PASSWORD_REQUIREMENTS_MESSAGE); return; }
    setBusy(true); setError(null);
    try {
      await auth.overrideConfirm(token, newPw);
      setDone(true);
      setTimeout(() => router.replace('/(auth)/login'), 2500);
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Reset failed');
    } finally { setBusy(false); }
  };

  const bodyCopy = {
    identify: "Enter the email on your account and we'll send a recovery code.",
    verify: 'Enter the 6-digit code we just sent you.',
    reset: 'Identity confirmed. Choose a new password.',
  }[step];

  return (
    <AuthShell>
      <GlassCard>
        <Head eyebrow="Lost your thread?" title="Reset your password" body={done ? undefined : bodyCopy} />

        {done ? (
          <Notice tone="ok" title="Password updated" body="Taking you back to sign in…" />
        ) : (
          <View style={{ gap: 16 }}>
            {step === 'identify' && (
              <>
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
                {error && <Notice title={error} />}
                <Btn label="Send recovery code" onPress={identify} busy={busy} />
              </>
            )}

            {step === 'verify' && (
              <>
                <Notice tone="ok" title="Code sent — check your inbox" body="It's valid for 15 minutes." />
                <Field
                  label="Recovery code"
                  icon={KeyRound}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                />
                {error && <Notice title={error} />}
                <Btn label="Enter the code" onPress={verify} busy={busy} disabled={code.length < 6} />
              </>
            )}

            {step === 'reset' && (
              <>
                <Field
                  label="New password"
                  icon={Lock}
                  placeholder="At least 8 characters"
                  secureTextEntry={!showPw}
                  value={newPw}
                  onChangeText={setNewPw}
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
                <PasswordChecklist password={newPw} />
                {error && <Notice title={error} />}
                <Btn label="Save new password" onPress={reset} busy={busy} disabled={!isPasswordStrong(newPw)} />
              </>
            )}
          </View>
        )}

        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={14} strokeWidth={1.75} color={C.ink55} />
            <Text style={T.link}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </AuthShell>
  );
}
