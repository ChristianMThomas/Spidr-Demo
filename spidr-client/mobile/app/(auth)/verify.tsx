import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, Mail, CircleCheck } from 'lucide-react-native';
import { useAuth } from '../../lib/authContext';
import AuthShell, { GlassCard } from '../../components/auth/AuthShell';
import { Head, Btn, Notice, C, T, maskEmail } from '../../components/auth/authKit';

export default function Verify() {
  const { verifyOTP, resendOTP, cancelOTP, pendingEmail, otpMode } = useAuth();
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [focusIdx, setFocusIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const submitCode = async (code: string) => {
    if (!pendingEmail) {
      setError('Session expired — please sign in again');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOTP(pendingEmail, code);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Invalid or expired code');
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const handleChange = (i: number, val: string) => {
    // Allow paste of full code
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, 6);
      if (cleaned.length === 6) {
        setDigits(cleaned.split(''));
        refs.current[5]?.focus();
        submitCode(cleaned);
        return;
      }
    }
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
    if (val && i === 5 && next.every(Boolean)) submitCode(next.join(''));
  };

  const handleKey = (i: number, key: string) => {
    if (key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    try {
      await resendOTP(pendingEmail);
      setResent(true);
      setCountdown(60);
      setError(null);
      setTimeout(() => setResent(false), 3000);
    } catch (e: any) {
      setError(e?.data?.error || 'Could not resend');
    }
  };

  const complete = digits.join('').length === 6;

  return (
    <AuthShell>
      <GlassCard>
        <Head
          eyebrow="Almost in"
          title={otpMode === 'verify' ? 'Check your email' : 'Two-factor required'}
        />

        <View style={{ alignItems: 'center', gap: 10, marginTop: -6 }}>
          <Text style={[T.body, { textAlign: 'center' }]}>We sent a 6-digit code to</Text>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
              backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
            }}
          >
            <Mail size={13} strokeWidth={1.75} color="rgba(255,255,255,0.40)" />
            <Text style={{ fontSize: 12, color: C.white, fontWeight: '500' }}>{maskEmail(pendingEmail)}</Text>
          </View>
        </View>

        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={T.label}>Verification code</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(el) => { refs.current[i] = el; }}
                  // @ts-ignore — nativewind's cssInterop escape hatch; see AuthShell.tsx
                  cssInterop={false}
                  value={d}
                  onChangeText={(v) => handleChange(i, v)}
                  onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key)}
                  onFocus={() => setFocusIdx(i)}
                  keyboardType="number-pad"
                  maxLength={i === 0 ? 6 : 1} // allow paste into first box
                  style={{
                    flex: 1, height: 58, borderRadius: 12,
                    backgroundColor: C.inputBg, borderWidth: 1,
                    borderColor: focusIdx === i ? 'rgba(239,68,68,0.70)'
                      : d ? 'rgba(239,68,68,0.60)' : C.border,
                    color: C.white, fontSize: 24, fontWeight: '700', textAlign: 'center',
                  }}
                />
              ))}
            </View>
          </View>

          {error && <Notice title={error} />}

          <Btn
            label="Verify"
            busy={busy}
            disabled={!complete}
            onPress={() => {
              if (!complete) { setError('Enter all 6 digits'); return; }
              submitCode(digits.join(''));
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <TouchableOpacity
            onPress={() => { cancelOTP(); router.replace('/(auth)/login'); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={14} strokeWidth={1.75} color={C.ink55} />
            <Text style={T.link}>Wrong email?</Text>
          </TouchableOpacity>

          {resent ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CircleCheck size={13} strokeWidth={1.75} color={C.red} />
              <Text style={{ fontSize: 13, color: C.red }}>Sent</Text>
            </View>
          ) : countdown > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} strokeWidth={1.75} color={C.ink35} />
              <Text style={{ fontSize: 13, color: C.ink35 }}>Resend in {countdown}s</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleResend}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RefreshCw size={13} strokeWidth={1.75} color={C.ink55} />
              <Text style={T.link}>Resend code</Text>
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>
    </AuthShell>
  );
}
