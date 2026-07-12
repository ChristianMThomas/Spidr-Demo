import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, BellOff, MessageCircle, AtSign, UserPlus, Phone, MoonStar, Sparkles } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useThemeColors } from '../../lib/theme';
import { Toggle } from '../../components/ui/Toggle';

// ── Notifications (mobile) ───────────────────────────────────────────────────
// Same pref keys + storage strategy as the web Settings panel: AsyncStorage
// ('spidr_notification_prefs') is the instant source of truth, and each change
// is best-effort mirrored to UserProfile.notification_prefs so the toggles
// sync with web/desktop.

const NOTIF_DEFAULTS = {
  enabled: true,
  dm: true,
  server_mentions: false,
  friend_requests: true,
  voice_calls: true,
  dnd_suppress: true,
  urgent_dms: false,
};

type NotifPrefs = typeof NOTIF_DEFAULTS;

export default function Notifications() {
  const router = useRouter();
  const { currentUser } = useAppShell();
  const colors = useThemeColors();

  const [prefs, setPrefs] = useState<NotifPrefs>(NOTIF_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  // AsyncStorage first (instant), then overlay whatever the profile has synced.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next = { ...NOTIF_DEFAULTS };
      try {
        const raw = await AsyncStorage.getItem('spidr_notification_prefs');
        if (raw) next = { ...next, ...JSON.parse(raw) };
      } catch {}
      try {
        if (currentUser?.id) {
          const profiles: any = await entities.UserProfile.filter({ user_id: currentUser.id });
          const synced = profiles?.[0]?.notification_prefs;
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

  const profileIdRef = useRef<string | null>(null);

  const setPref = (key: keyof NotifPrefs, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem('spidr_notification_prefs', JSON.stringify(next)).catch(() => {});
      (async () => {
        try {
          if (!profileIdRef.current && currentUser?.id) {
            const profiles: any = await entities.UserProfile.filter({ user_id: currentUser.id });
            profileIdRef.current = profiles?.[0]?.id ?? null;
          }
          if (profileIdRef.current) {
            await entities.UserProfile.update(profileIdRef.current, { notification_prefs: next });
          }
        } catch { /* local copy is the source of truth */ }
      })();
      return next;
    });
  };

  const masterOff = !prefs.enabled;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(234,179,8,0.1)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={18} color="#eab308" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>SIGNAL CONTROL</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Choose which pings reach you.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Master switch — hero card */}
        <View style={[card(colors.surface), { borderColor: prefs.enabled ? colors.accent + '44' : colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: prefs.enabled ? colors.accent + '22' : '#1a1a1a', alignItems: 'center', justifyContent: 'center' }}>
              {prefs.enabled
                ? <Bell size={22} color={colors.accent} />
                : <BellOff size={22} color="#555" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>Notifications</Text>
              <Text style={{ color: prefs.enabled ? '#22c55e' : '#555', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, marginTop: 2 }}>
                {prefs.enabled ? '● RECEIVING SIGNALS' : '○ ALL SIGNALS MUTED'}
              </Text>
            </View>
            <Toggle value={prefs.enabled} onChange={(v) => setPref('enabled', v)} accent={colors.accent} disabled={!hydrated} />
          </View>
        </View>

        {/* Per-signal toggles */}
        <Text style={sectionLabel}>SIGNAL TYPES</Text>
        <View style={[card(colors.surface), { padding: 0, opacity: masterOff ? 0.45 : 1 }]}>
          <ToggleRow
            Icon={MessageCircle} iconColor="#60a5fa"
            label="Direct Messages" hint="Notify for all incoming DMs"
            value={prefs.dm} onChange={(v) => setPref('dm', v)}
            accent={colors.accent} disabled={masterOff || !hydrated}
          />
          <ToggleRow
            Icon={AtSign} iconColor="#f97316"
            label="Server Mentions" hint="Notify for @mentions in servers"
            value={prefs.server_mentions} onChange={(v) => setPref('server_mentions', v)}
            accent={colors.accent} disabled={masterOff || !hydrated}
          />
          <ToggleRow
            Icon={UserPlus} iconColor="#22c55e"
            label="Friend Requests" hint="New link requests and accepts"
            value={prefs.friend_requests} onChange={(v) => setPref('friend_requests', v)}
            accent={colors.accent} disabled={masterOff || !hydrated}
          />
          <ToggleRow
            Icon={Phone} iconColor="#ec4899"
            label="Voice Calls" hint="Incoming call notifications"
            value={prefs.voice_calls} onChange={(v) => setPref('voice_calls', v)}
            accent={colors.accent} disabled={masterOff || !hydrated}
            last
          />
        </View>

        {/* Do Not Disturb */}
        <Text style={sectionLabel}>DO NOT DISTURB</Text>
        <View style={[card(colors.surface), { padding: 0 }]}>
          <ToggleRow
            Icon={MoonStar} iconColor="#a855f7"
            label="Suppress While DND" hint="Mute everything when your status is DND"
            value={prefs.dnd_suppress} onChange={(v) => setPref('dnd_suppress', v)}
            accent={colors.accent} disabled={!hydrated}
          />
          <ToggleRow
            Icon={Sparkles} iconColor="#eab308"
            label="Allow Urgent DMs" hint="Close friends break through DND"
            value={prefs.urgent_dms} onChange={(v) => setPref('urgent_dms', v)}
            accent={colors.accent} disabled={!hydrated}
            last
          />
        </View>

        <Text style={{ color: '#3f3f46', fontSize: 10, textAlign: 'center', lineHeight: 15 }}>
          Preferences sync to your profile and apply on web and desktop too.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

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
