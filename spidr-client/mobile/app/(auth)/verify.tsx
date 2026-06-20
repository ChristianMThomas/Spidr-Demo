import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../lib/authContext';
import AuthShell, { GlassCard } from '../../components/auth/AuthShell';

export default function Verify() {
  const { verifyOTP, resendOTP, cancelOTP, pendingEmail, otpMode } = useAuth();
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

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
    if (key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
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

  const masked = pendingEmail
    ? pendingEmail.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 16)) + c)
    : 'your email';

  return (
    <AuthShell>
      <GlassCard>
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <ShieldCheck size={28} color="#f87171" />
          </View>
          <Text
            style={{
              color: '#fff',
              fontSize: 22,
              fontWeight: '900',
              letterSpacing: -0.5,
            }}
          >
            {otpMode === 'verify' ? 'Verify Account' : '2FA Required'}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: 13,
              marginTop: 6,
              textAlign: 'center',
            }}
          >
            Signal sent to{' '}
            <Text style={{ color: '#f87171', fontFamily: 'monospace' }}>{masked}</Text>
          </Text>
        </View>

        {/* 6 digit boxes */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChangeText={(v) => handleChange(i, v)}
              onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={i === 0 ? 6 : 1} // allow paste into first box
              style={{
                width: 44,
                height: 56,
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderWidth: 1,
                borderColor: d ? '#ef4444' : 'rgba(255,255,255,0.10)',
                borderRadius: 14,
                color: '#fff',
                fontSize: 22,
                fontWeight: '900',
                textAlign: 'center',
              }}
            />
          ))}
        </View>

        {error && (
          <View
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.3)',
              borderRadius: 10,
              padding: 10,
              marginBottom: 14,
            }}
          >
            <Text style={{ color: '#f87171', fontSize: 12, textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          onPress={() => {
            const c = digits.join('');
            if (c.length < 6) {
              setError('Enter all 6 digits');
              return;
            }
            submitCode(c);
          }}
          disabled={busy || digits.join('').length < 6}
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
            opacity: busy || digits.join('').length < 6 ? 0.4 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 2.5 }}>
              ESTABLISH CONNECTION
            </Text>
          )}
        </TouchableOpacity>

        {/* Footer row */}
        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity
            onPress={() => {
              cancelOTP();
              router.replace('/(auth)/login');
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={12} color="rgba(255,255,255,0.4)" />
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 4 }}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResend}
            disabled={countdown > 0}
            style={{ flexDirection: 'row', alignItems: 'center', opacity: countdown > 0 ? 0.3 : 1 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <RefreshCw size={11} color="rgba(255,255,255,0.5)" />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginLeft: 4 }}>
              {resent ? '✓ Sent!' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend signal'}
            </Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </AuthShell>
  );
}
