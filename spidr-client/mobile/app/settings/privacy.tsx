import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, MessageCircle, UserPlus, Radar, Radio, EyeOff } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useThemeColors } from '../../lib/theme';
import { Toggle } from '../../components/ui/Toggle';

// ── Privacy (mobile) ─────────────────────────────────────────────────────────
// Extends the web Settings "Privacy & Safety" tab (whose two switches don't
// persist yet) into a real, persisted screen: AsyncStorage for instant local
// state, mirrored to UserProfile.privacy_prefs for cross-device sync.
// Server-side enforcement of these flags rolls out separately — the stored
// prefs are the contract it will read.

const PRIVACY_DEFAULTS = {
  allow_dms: true,        // others can open a DM with you
  friend_requests: true,  // others can send you link requests
  show_online: true,      // your status dot is visible
  discoverable: true,     // you appear in user search / discover
};

type PrivacyPrefs = typeof PRIVACY_DEFAULTS;

export default function Privacy() {
  const router = useRouter();
  const { currentUser } = useAppShell();
  const colors = useThemeColors();

  const [prefs, setPrefs] = useState<PrivacyPrefs>(PRIVACY_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const profileIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next = { ...PRIVACY_DEFAULTS };
      try {
        const raw = await AsyncStorage.getItem('spidr_privacy_prefs');
        if (raw) next = { ...next, ...JSON.parse(raw) };
      } catch {}
      try {
        if (currentUser?.id) {
          const profiles: any = await entities.UserProfile.filter({ user_id: currentUser.id });
          profileIdRef.current = profiles?.[0]?.id ?? null;
          const synced = profiles?.[0]?.privacy_prefs;
          if (synced && typeof synced === 'object') next = { ...next, ...synced };
        }
      } catch {}
      if (!cancelled) {
        setPrefs(next);
        setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const setPref = (key: keyof PrivacyPrefs, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem('spidr_privacy_prefs', JSON.stringify(next)).catch(() => {});
      (async () => {
        try {
          if (!profileIdRef.current && currentUser?.id) {
            const profiles: any = await entities.UserProfile.filter({ user_id: currentUser.id });
            profileIdRef.current = profiles?.[0]?.id ?? null;
          }
          if (profileIdRef.current) {
            await entities.UserProfile.update(profileIdRef.current, { privacy_prefs: next });
          }
        } catch { /* local copy is the source of truth */ }
      })();
      return next;
    });
  };

  // Simple shield score: how locked-down the profile is.
  const lockedCount = Object.values(prefs).filter((v) => !v).length;
  const shield = lockedCount === 0 ? 'OPEN WEB' : lockedCount >= 3 ? 'GHOST PROTOCOL' : 'GUARDED';
  const shieldColor = lockedCount === 0 ? '#22c55e' : lockedCount >= 3 ? '#a855f7' : '#eab308';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={18} color="#60a5fa" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>PRIVACY SHIELD</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Control who can reach and see you.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Shield status card */}
        <View style={[card(colors.surface), { borderColor: shieldColor + '44' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: shieldColor + '22', alignItems: 'center', justifyContent: 'center' }}>
              <EyeOff size={22} color={shieldColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>Shield Status</Text>
              <Text style={{ color: shieldColor, fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, marginTop: 2 }}>
                ● {shield}
              </Text>
            </View>
          </View>
          <Text style={{ color: '#52525b', fontSize: 11, lineHeight: 16, marginTop: 12 }}>
            {lockedCount === 0
              ? 'Everything is open — anyone on Spidr can message you, add you, and find you.'
              : lockedCount >= 3
                ? 'You are running dark. Most people cannot reach or find you.'
                : 'Some channels are locked down. Only the ones you left open can reach you.'}
          </Text>
        </View>

        {/* Reachability */}
        <Text style={sectionLabel}>WHO CAN REACH YOU</Text>
        <View style={[card(colors.surface), { padding: 0 }]}>
          <ToggleRow
            Icon={MessageCircle} iconColor="#60a5fa"
            label="Allow Direct Messages" hint="Others can open a DM with you"
            value={prefs.allow_dms} onChange={(v) => setPref('allow_dms', v)}
            accent={colors.accent} disabled={!hydrated}
          />
          <ToggleRow
            Icon={UserPlus} iconColor="#22c55e"
            label="Allow Link Requests" hint="Others can send you friend requests"
            value={prefs.friend_requests} onChange={(v) => setPref('friend_requests', v)}
            accent={colors.accent} disabled={!hydrated}
            last
          />
        </View>

        {/* Visibility */}
        <Text style={sectionLabel}>WHO CAN SEE YOU</Text>
        <View style={[card(colors.surface), { padding: 0 }]}>
          <ToggleRow
            Icon={Radio} iconColor="#ec4899"
            label="Show Online Status" hint="Friends see your live status dot"
            value={prefs.show_online} onChange={(v) => setPref('show_online', v)}
            accent={colors.accent} disabled={!hydrated}
          />
          <ToggleRow
            Icon={Radar} iconColor="#f97316"
            label="Discoverable" hint="Appear in user search and discover"
            value={prefs.discoverable} onChange={(v) => setPref('discoverable', v)}
            accent={colors.accent} disabled={!hydrated}
            last
          />
        </View>

        <Text style={{ color: '#3f3f46', fontSize: 10, textAlign: 'center', lineHeight: 15 }}>
          Preferences sync to your profile across devices. Enforcement is rolling out server-side patch by patch.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  Icon, iconColor, label, hint, value, onChange, accent, disabled, last,
}: {
  Icon: any; iconColor: string; label: string; hint: string;
  value: boolean; onChange: (v: boolean) => void; accent: string;
  disabled?: boolean; last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: iconColor + '1F', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} color={iconColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{label}</Text>
        <Text style={{ color: '#71717a', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{hint}</Text>
      </View>
      <Toggle value={value} onChange={onChange} accent={accent} disabled={disabled} />
    </View>
  );
}

const card = (surface: string) => ({
  backgroundColor: surface,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
  borderRadius: 14,
  padding: 16,
  overflow: 'hidden' as const,
});

const sectionLabel = {
  color: '#71717a',
  fontSize: 10,
  fontWeight: '900' as const,
  letterSpacing: 2,
  marginLeft: 4,
  marginBottom: -4,
};
