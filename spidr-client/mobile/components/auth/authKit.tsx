import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image,
  TextInputProps,
} from 'react-native';
import { Check, CircleCheck } from 'lucide-react-native';
import { checkPassword } from '../../lib/passwordPolicy';

/**
 * Shared visual system for the mobile auth screens (login / register / verify /
 * forgot). Mirrors the web tokens in spidr-client/src/components/spidr/LoginPage.jsx
 * so the two platforms stay in step — change one, change the other.
 *
 * Card structure on every screen, top to bottom:
 *   logo → SpidR wordmark → red eyebrow → (title/body) → fields → CTA
 *   → meta line → footer link
 */

export const C = {
  red: '#ef4444',
  redFill: '#dc2626',
  white: '#ffffff',
  ink55: 'rgba(255,255,255,0.55)',
  ink35: 'rgba(255,255,255,0.35)',
  ink30: 'rgba(255,255,255,0.30)',
  ink22: 'rgba(255,255,255,0.22)',
  ink20: 'rgba(255,255,255,0.20)',
  border: 'rgba(255,255,255,0.10)',
  inputBg: 'rgba(0,0,0,0.60)',
};

export const T = {
  eyebrow: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: C.red },
  title: { fontSize: 22, fontWeight: '600' as const, color: C.white, lineHeight: 27 },
  body: { fontSize: 14, lineHeight: 21, color: C.ink55 },
  meta: { fontSize: 12, lineHeight: 17, color: C.ink35 },
  label: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.3, textTransform: 'uppercase' as const, color: C.ink55 },
  link: { fontSize: 13, color: C.ink55 },
};

// ─── Header ───────────────────────────────────────────────────────────────────
export function Head({
  eyebrow, title, body,
}: { eyebrow?: string; title?: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Image source={require('../../assets/spidr-wordmark.png')} accessibilityLabel="Spidr" style={{ width: 208, height: 156 }} resizeMode="contain" />
      {!!eyebrow && <Text style={T.eyebrow}>{eyebrow}</Text>}
      {!!title && <Text style={[T.title, { marginTop: 2, textAlign: 'center' }]}>{title}</Text>}
      {!!body && <Text style={[T.body, { textAlign: 'center' }]}>{body}</Text>}
    </View>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
type FieldProps = TextInputProps & {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  hint?: string;
  trailing?: React.ReactNode;
};

export function Field({ label, icon: Icon, hint, trailing, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={T.label}>{label}</Text>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          height: 46, paddingHorizontal: 14, borderRadius: 12,
          backgroundColor: C.inputBg, borderWidth: 1,
          borderColor: focused ? 'rgba(239,68,68,0.70)' : C.border,
          // Always a real (non-zero) shadow — only its opacity/radius change
          // on focus. Toggling shadowOpacity 0→0.25 crosses Fabric's
          // "no shadow" → "needs its own layer" threshold, which forces this
          // View (and the TextInput it wraps) to be re-parented onto a new
          // native view right as it gains focus — that tore down the
          // just-focused TextInput and caused the keyboard to instantly
          // dismiss. Never letting shadowOpacity hit exactly 0 keeps the
          // view on one stable native layer across the focus transition.
          shadowColor: C.red,
          shadowOpacity: focused ? 0.25 : 0.001,
          shadowRadius: focused ? 8 : 1,
        }}
      >
        <Icon size={16} strokeWidth={1.75} color={focused ? C.red : C.ink30} />
        <TextInput
          // @ts-ignore — nativewind's cssInterop escape hatch; see AuthShell.tsx
          cssInterop={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={C.ink22}
          style={{ flex: 1, minWidth: 0, color: C.white, fontSize: 14, padding: 0 }}
          {...props}
        />
        {trailing}
      </View>
      {!!hint && <Text style={T.meta}>{hint}</Text>}
    </View>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────
export function Checkbox({
  checked, onChange, children,
}: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  // flexShrink (not flex) on both this row and the label below: the label must
  // be able to shrink so Register's long Terms line wraps, but it must NOT
  // grow — with flex:1 the checkbox ate the whole row on Login and pushed
  // "Forgot password?" off the screen edge.
  return (
    <TouchableOpacity
      onPress={() => onChange(!checked)}
      activeOpacity={0.7}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <View
        style={{
          width: 18, height: 18, borderRadius: 5, borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: checked ? C.redFill : C.inputBg,
          borderColor: checked ? C.redFill : C.ink20,
        }}
      >
        {checked && <Check size={12} strokeWidth={3} color={C.white} />}
      </View>
      <View style={{ flexShrink: 1 }}>{children}</View>
    </TouchableOpacity>
  );
}

// ─── Primary button ───────────────────────────────────────────────────────────
export function Btn({
  label, onPress, busy, disabled,
}: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const off = busy || disabled;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      style={{
        height: 48, borderRadius: 12, backgroundColor: C.redFill,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.red, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25, shadowRadius: 20, elevation: 6,
        opacity: off ? 0.4 : 1,
      }}
    >
      {busy
        ? <ActivityIndicator color={C.white} />
        : <Text style={{ color: C.white, fontSize: 15, fontWeight: '600' }}>{label}</Text>}
    </TouchableOpacity>
  );
}

// ─── Notice / error ───────────────────────────────────────────────────────────
export function Notice({
  title, body, tone = 'error',
}: { title: string; body?: string; tone?: 'error' | 'ok' }) {
  return (
    <View
      style={{
        flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12,
        backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.22)',
      }}
    >
      {tone === 'ok' && <CircleCheck size={18} strokeWidth={1.75} color={C.red} style={{ marginTop: 1 }} />}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: tone === 'ok' ? C.white : '#fca5a5' }}>{title}</Text>
        {!!body && <Text style={T.meta}>{body}</Text>}
      </View>
    </View>
  );
}

// ─── Password checklist (Register + Reset) ────────────────────────────────────
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <View style={{ gap: 4, marginTop: -8 }} accessibilityLabel="Password requirements">
      {checkPassword(password).map(({ id, label, passed }) => (
        <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Check size={12} strokeWidth={3} color={passed ? C.red : 'rgba(255,255,255,0.15)'} />
          <Text style={[T.meta, { color: passed ? 'rgba(255,255,255,0.70)' : C.ink35 }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Footer link ("New to Spidr? Create an account") ──────────────────────────
export function Foot({
  question, action, onPress,
}: { question: string; action: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={{ textAlign: 'center', fontSize: 13, color: C.ink35 }}>
        {question} <Text style={{ color: C.white, fontWeight: '500' }}>{action}</Text>
      </Text>
    </TouchableOpacity>
  );
}

// Mask rule: first char + •• + domain.
export const maskEmail = (e?: string | null) =>
  e ? e.replace(/^(.)([^@]*)(@.*)$/, (_m, a, _b, c) => `${a}••${c}`) : 'your email';
