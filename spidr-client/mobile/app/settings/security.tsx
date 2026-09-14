import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft, ShieldCheck, Key, Lock, Smartphone, Check, X, LogOut, AlertTriangle, Eye, EyeOff, Copy,
} from 'lucide-react-native';
import { auth, account } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useAuth } from '../../lib/authContext';
import { useThemeColors } from '../../lib/theme';
import { isPasswordStrong, PASSWORD_REQUIREMENTS_MESSAGE } from '../../lib/passwordPolicy';

// ── Security & 2FA (mobile) ──────────────────────────────────────────────────
// Small-screen port of spidr-client/src/components/spidr/SecurityMatrix.jsx.
// Password change goes to Spring Boot via auth.changePassword; TOTP setup /
// verify / disable route to Node (/auth/setup-totp etc. — AUTH-F3).

export default function Security() {
  const router = useRouter();
  const { currentUser, refreshCurrentUser } = useAppShell();
  const { logout } = useAuth();

  const colors = useThemeColors();
  const [showPassword, setShowPassword] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const totpEnabled = currentUser?.twoFactorMethod === 'totp';
  const accountAge = currentUser?.created_date
    ? Math.floor((Date.now() - new Date(currentUser.created_date).getTime()) / 86400000)
    : 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} color="#ef4444" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>SECURITY MATRIX</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Identity protection and access management.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Identity */}
        <Card>
          <Text style={sectionLabel}>IDENTITY CREDENTIALS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: '#a1a1aa', fontSize: 10, letterSpacing: 1.5 }}>OPERATIVE ID</Text>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={14} color="#22c55e" />
            </View>
          </View>
          <Text style={{ color: '#fff', fontFamily: 'monospace', fontSize: 14, marginBottom: 12 }}>{currentUser?.email}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat label="LINK STATUS" value="ACTIVE" green />
            <Stat label="LINK AGE" value={`${accountAge} DAYS`} />
          </View>
        </Card>

        {/* Password */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <IconBox color="#ef4444"><Key size={18} color="#ef4444" /></IconBox>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Access Key Management</Text>
              <Text style={{ color: '#71717a', fontSize: 11 }}>Update your encryption passphrase</Text>
            </View>
          </View>
          <BigButton label="CHANGE PASSWORD" onPress={() => setShowPassword(true)} />
        </Card>

        {/* 2FA */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <IconBox color={totpEnabled ? '#22c55e' : '#ef4444'}>
              <Smartphone size={18} color={totpEnabled ? '#4ade80' : '#ef4444'} />
            </IconBox>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Two-Factor Authentication</Text>
                {totpEnabled && (
                  <View style={{ backgroundColor: 'rgba(34,197,94,0.2)', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' }}>
                    <Text style={{ color: '#4ade80', fontSize: 8, fontWeight: '900' }}>ACTIVE</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: '#71717a', fontSize: 11 }}>
                {totpEnabled ? 'Authenticator app linked' : 'Protect your account with an authenticator app'}
              </Text>
            </View>
          </View>
          <BigButton
            label={totpEnabled ? 'MANAGE AUTHENTICATOR' : 'GENERATE SYNC'}
            red={!totpEnabled}
            onPress={() => setShow2FA(true)}
          />
        </Card>

        {/* Email 2FA note */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 24 }}>✉️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Email Verification</Text>
              <Text style={{ color: '#71717a', fontSize: 11 }}>Already active — codes sent to {currentUser?.email}</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(59,130,246,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
              <Text style={{ color: '#60a5fa', fontSize: 8, fontWeight: '900' }}>ON</Text>
            </View>
          </View>
        </Card>

        {/* Danger zone */}
        <View style={{ backgroundColor: 'rgba(69,10,10,0.2)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 14, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <AlertTriangle size={14} color="#f87171" />
            <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '800' }}>DANGER ZONE</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Log out?', 'This will log you out of this device.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => logout() },
              ])
            }
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)',
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
            }}
          >
            <LogOut size={14} color="#f87171" />
            <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>LOGOUT</Text>
          </TouchableOpacity>

          {/* Deactivate — reversible; account goes dark until you log back in */}
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Deactivate account?',
                'Your profile goes offline and hidden. Logging back in restores everything — nothing is deleted.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Deactivate',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await account.deactivate();
                        await logout();
                      } catch (err: any) {
                        Alert.alert('Could not deactivate', err?.message || 'Try again.');
                      }
                    },
                  },
                ],
              )
            }
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 11, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)',
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginTop: 8,
            }}
          >
            <EyeOff size={14} color="#f87171" />
            <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>DEACTIVATE ACCOUNT</Text>
          </TouchableOpacity>

          {/* Delete — permanent; Apple 5.1.1(v) / Play deletion requirement */}
          <TouchableOpacity
            onPress={() => setShowDelete(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 11, borderRadius: 10, backgroundColor: '#7f1d1d',
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', marginTop: 8,
            }}
          >
            <AlertTriangle size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>DELETE ACCOUNT PERMANENTLY</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DeleteAccountModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        username={currentUser?.username || currentUser?.display_name || ''}
        onDeleted={() => logout()}
      />
      <PasswordModal visible={showPassword} onClose={() => setShowPassword(false)} />
      <TwoFAModal
        visible={show2FA}
        onClose={() => setShow2FA(false)}
        totpEnabled={totpEnabled}
        onChanged={refreshCurrentUser}
      />
    </SafeAreaView>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
const sectionLabel = {
  color: '#71717a', fontSize: 9, fontWeight: '900' as const, letterSpacing: 2, marginBottom: 12,
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 16 }}>
      {children}
    </View>
  );
}

function IconBox({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '1A', borderWidth: 1, borderColor: color + '33', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

function Stat({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 10 }}>
      <Text style={{ color: '#71717a', fontSize: 8, letterSpacing: 1.5, marginBottom: 3 }}>{label}</Text>
      <Text style={{ color: green ? '#4ade80' : '#fff', fontSize: 12, fontWeight: '800', fontFamily: 'monospace' }}>{value}</Text>
    </View>
  );
}

function BigButton({ label, onPress, red, disabled }: { label: string; onPress: () => void; red?: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 11, borderRadius: 10, alignItems: 'center',
        backgroundColor: red ? '#dc2626' : '#27272a',
        borderWidth: red ? 0 : 1, borderColor: 'rgba(255,255,255,0.05)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SheetShell({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: '#0a0a0a', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 20, paddingBottom: 34 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <X size={18} color="#71717a" />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ── Delete account — type-to-confirm, irreversible ──────────────────────────
function DeleteAccountModal({
  visible, onClose, username, onDeleted,
}: { visible: boolean; onClose: () => void; username: string; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const expected = 'DELETE';

  const close = () => { setConfirm(''); onClose(); };

  const submit = async () => {
    if (confirm !== expected || loading) return;
    setLoading(true);
    try {
      await account.deleteAccount();
      close();
      Alert.alert('Account deleted', 'Your account and data have been removed.');
      onDeleted();
    } catch (err: any) {
      Alert.alert('Deletion failed', err?.data?.error || err?.message || 'Try again.');
    }
    setLoading(false);
  };

  return (
    <SheetShell visible={visible} onClose={close} title="Delete Account Permanently">
      <View style={{ gap: 12 }}>
        <View style={{ padding: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12 }}>
          <Text style={{ color: '#f87171', fontSize: 12, lineHeight: 18 }}>
            This permanently deletes {username ? `@${username}'s` : 'your'} account: profile, friends,
            clips, and wallet. Your messages are anonymized. This cannot be undone.
          </Text>
        </View>
        <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>
          Type <Text style={{ color: '#fff', fontFamily: 'monospace' }}>{expected}</Text> to confirm
        </Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          placeholder={expected}
          placeholderTextColor="#3f3f46"
          style={{
            backgroundColor: '#18181b', borderWidth: 1,
            borderColor: confirm === expected ? '#ef4444' : '#3f3f46', borderRadius: 10,
            color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
            fontFamily: 'monospace', letterSpacing: 2,
          }}
        />
        <TouchableOpacity
          onPress={submit}
          disabled={confirm !== expected || loading}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 12, borderRadius: 12, backgroundColor: '#7f1d1d',
            opacity: confirm !== expected || loading ? 0.4 : 1,
          }}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <AlertTriangle size={14} color="#fff" />}
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
            {loading ? 'DELETING…' : 'DELETE MY ACCOUNT'}
          </Text>
        </TouchableOpacity>
      </View>
    </SheetShell>
  );
}

// ── Password change ──────────────────────────────────────────────────────────
function PasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [curr, setCurr] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const close = () => { setCurr(''); setNext(''); setConfirm(''); setShow(false); onClose(); };

  const submit = async () => {
    if (next !== confirm) { Alert.alert('Passwords do not match'); return; }
    if (!isPasswordStrong(next)) { Alert.alert('Weak password', PASSWORD_REQUIREMENTS_MESSAGE); return; }
    setLoading(true);
    try {
      await auth.changePassword({ currentPassword: curr, newPassword: next });
      Alert.alert('Access key re-encrypted!');
      close();
    } catch (err: any) {
      Alert.alert('Failed', err?.data?.error || err?.message || 'Could not change password');
    }
    setLoading(false);
  };

  const fields: [string, string, (v: string) => void][] = [
    ['Current Password', curr, setCurr],
    ['New Password', next, setNext],
    ['Confirm Password', confirm, setConfirm],
  ];

  return (
    <SheetShell visible={visible} onClose={close} title="Re-Encrypt Access Key">
      <View style={{ gap: 12 }}>
        {fields.map(([label, val, set]) => (
          <View key={label}>
            <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700', marginBottom: 5 }}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 10 }}>
              <TextInput
                value={val}
                onChangeText={set}
                secureTextEntry={!show}
                autoCapitalize="none"
                style={{ flex: 1, color: '#fff', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }}
              />
              <TouchableOpacity onPress={() => setShow((v) => !v)} style={{ paddingHorizontal: 12 }} hitSlop={8}>
                {show ? <EyeOff size={14} color="#71717a" /> : <Eye size={14} color="#71717a" />}
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <Text style={{ color: '#71717a', fontSize: 11 }}>
          8+ characters, no spaces, with upper and lowercase letters, a number, and a special character.
        </Text>
        <TouchableOpacity
          onPress={submit}
          disabled={loading || !curr || !next || !confirm}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 12, borderRadius: 12, backgroundColor: '#dc2626',
            opacity: loading || !curr || !next || !confirm ? 0.4 : 1, marginTop: 4,
          }}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Lock size={14} color="#fff" />}
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{loading ? 'Encrypting…' : 'UPDATE PASSWORD'}</Text>
        </TouchableOpacity>
      </View>
    </SheetShell>
  );
}

// ── 2FA / TOTP ───────────────────────────────────────────────────────────────
function TwoFAModal({
  visible, onClose, totpEnabled, onChanged,
}: { visible: boolean; onClose: () => void; totpEnabled: boolean; onChanged: () => void }) {
  const [step, setStep] = useState<'choice' | 'scan' | 'verify'>('choice');
  const [qrData, setQrData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const close = () => { setStep('choice'); setQrData(null); setCode(''); onClose(); };

  const startTotp = async () => {
    setLoading(true);
    try {
      const data: any = await auth.setupTotp();
      setQrData(data);
      setStep('scan');
    } catch (err: any) {
      Alert.alert('Setup failed', err?.data?.error || err?.message || '');
    }
    setLoading(false);
  };

  const verifyTotp = async () => {
    if (code.length < 6) { Alert.alert('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      await auth.verifyTotpSetup(code);
      Alert.alert('🔒 Authenticator linked!', 'Your account is now secured with TOTP 2FA.');
      onChanged();
      close();
    } catch (err: any) {
      Alert.alert('Invalid code', err?.data?.error || err?.message || '');
    }
    setLoading(false);
  };

  const disableTotp = () => {
    Alert.alert('Disable authenticator 2FA?', 'This weakens your account security.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await auth.disableTotp();
            onChanged();
            close();
          } catch {
            Alert.alert('Failed to disable');
          }
          setLoading(false);
        },
      },
    ]);
  };

  const copySecret = async () => {
    if (!qrData?.secret) return;
    await Clipboard.setStringAsync(qrData.secret);
    Alert.alert('Copied', 'Manual entry key copied to clipboard.');
  };

  const title = step === 'choice' ? 'Two-Factor Authentication' : step === 'scan' ? 'Scan QR Code' : 'Verify Code';

  return (
    <SheetShell visible={visible} onClose={close} title={title}>
      {step === 'choice' && (
        totpEnabled ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: 12 }}>
              <Check size={18} color="#4ade80" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#4ade80', fontSize: 13, fontWeight: '800' }}>Authenticator App Active</Text>
                <Text style={{ color: '#71717a', fontSize: 11 }}>Your account is protected with TOTP 2FA</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={disableTotp}
              disabled={loading}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', opacity: loading ? 0.4 : 1,
              }}
            >
              {loading ? <ActivityIndicator size="small" color="#f87171" /> : <X size={14} color="#f87171" />}
              <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '800' }}>DISABLE 2FA</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={startTotp}
            disabled={loading}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
              backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 28 }}>📱</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>Authenticator App</Text>
              <Text style={{ color: '#71717a', fontSize: 11 }}>Authy, Google, or Microsoft Authenticator (Recommended)</Text>
            </View>
            {loading && <ActivityIndicator size="small" color="#a1a1aa" />}
          </TouchableOpacity>
        )
      )}

      {step === 'scan' && qrData && (
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>
            Scan this QR code with your authenticator app — or copy the key below into it manually.
          </Text>
          <View style={{ backgroundColor: '#fff', padding: 10, borderRadius: 16, borderWidth: 3, borderColor: '#ef4444' }}>
            <Image source={{ uri: qrData.qrCodeUrl }} style={{ width: 180, height: 180 }} />
          </View>
          <TouchableOpacity
            onPress={copySecret}
            style={{ width: '100%', padding: 12, backgroundColor: '#18181b', borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46' }}
          >
            <Text style={{ color: '#71717a', fontSize: 9, letterSpacing: 1.5, marginBottom: 4 }}>MANUAL ENTRY KEY · TAP TO COPY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12, flex: 1 }}>{qrData.secret}</Text>
              <Copy size={13} color="#71717a" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setStep('verify')}
            style={{ width: '100%', paddingVertical: 13, borderRadius: 12, backgroundColor: '#dc2626', alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>I'VE SCANNED IT → ENTER CODE</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'verify' && (
        <View style={{ alignItems: 'center', gap: 16 }}>
          <Text style={{ color: '#a1a1aa', fontSize: 12, textAlign: 'center' }}>
            Enter the 6-digit code from your authenticator app
          </Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor="#3f3f46"
            autoFocus
            style={{
              width: '100%', backgroundColor: '#18181b', borderWidth: 1,
              borderColor: code.length === 6 ? '#ef4444' : '#3f3f46', borderRadius: 12,
              color: '#fff', textAlign: 'center', fontSize: 26, fontWeight: '900',
              letterSpacing: 12, paddingVertical: 14, fontFamily: 'monospace',
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <TouchableOpacity
              onPress={() => setStep('scan')}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#27272a', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>← BACK</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={verifyTotp}
              disabled={loading || code.length < 6}
              style={{
                flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
                paddingVertical: 12, borderRadius: 12, backgroundColor: '#dc2626',
                opacity: loading || code.length < 6 ? 0.4 : 1,
              }}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Check size={14} color="#fff" />}
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{loading ? 'VERIFYING…' : 'VERIFY'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SheetShell>
  );
}
