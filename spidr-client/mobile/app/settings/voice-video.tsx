import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mic, MicOff, Volume2, Waves, Video as VideoIcon, Info } from 'lucide-react-native';
import { useThemeColors } from '../../lib/theme';
import { Toggle } from '../../components/ui/Toggle';
import { AV_DEFAULTS, AvPrefs, loadAvPrefs, saveAvPrefs } from '../../lib/avPrefs';

// ── Voice & Video (mobile) ───────────────────────────────────────────────────
// Device-local A/V preferences (lib/avPrefs.ts owns the storage key and
// defaults). These are hardware defaults for THIS device, so unlike
// notification / privacy prefs they deliberately don't sync to the profile.
// callManager reads them at media-join time (native call support lands with
// the dev-client build — see patches/native-calls/).

export default function VoiceVideo() {
  const router = useRouter();
  const colors = useThemeColors();

  const [prefs, setPrefs] = useState<AvPrefs>(AV_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadAvPrefs().then((p) => {
      setPrefs(p);
      setHydrated(true);
    });
  }, []);

  const setPref = (key: keyof AvPrefs, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      saveAvPrefs(next);
      return next;
    });
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(236,72,153,0.1)', borderWidth: 1, borderColor: 'rgba(236,72,153,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Mic size={18} color="#ec4899" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>VOICE & VIDEO</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Defaults for calls and voice webs on this device.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Text style={sectionLabel}>MICROPHONE</Text>
        <View style={[card(colors.surface), { padding: 0 }]}>
          <ToggleRow
            Icon={MicOff} iconColor="#ef4444"
            label="Join Muted" hint="Enter every call and voice web muted"
            value={prefs.join_muted} onChange={(v) => setPref('join_muted', v)}
            accent={colors.accent} disabled={!hydrated}
          />
          <ToggleRow
            Icon={Waves} iconColor="#22c55e"
            label="Noise Suppression" hint="Filter background noise from your mic"
            value={prefs.noise_suppression} onChange={(v) => setPref('noise_suppression', v)}
            accent={colors.accent} disabled={!hydrated}
          />
          <ToggleRow
            Icon={Waves} iconColor="#60a5fa"
            label="Echo Cancellation" hint="Prevent your speaker feeding back into calls"
            value={prefs.echo_cancellation} onChange={(v) => setPref('echo_cancellation', v)}
            accent={colors.accent} disabled={!hydrated}
            last
          />
        </View>

        <Text style={sectionLabel}>OUTPUT & CAMERA</Text>
        <View style={[card(colors.surface), { padding: 0 }]}>
          <ToggleRow
            Icon={Volume2} iconColor="#eab308"
            label="Speakerphone by Default" hint="Start voice calls on loudspeaker"
            value={prefs.speaker_default} onChange={(v) => setPref('speaker_default', v)}
            accent={colors.accent} disabled={!hydrated}
          />
          <ToggleRow
            Icon={VideoIcon} iconColor="#a855f7"
            label="Camera Off on Join" hint="Video calls start with your camera disabled"
            value={prefs.camera_default_off} onChange={(v) => setPref('camera_default_off', v)}
            accent={colors.accent} disabled={!hydrated}
            last
          />
        </View>

        <View style={[card(colors.surface), { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }]}>
          <Info size={14} color="#71717a" style={{ marginTop: 1 }} />
          <Text style={{ color: '#71717a', fontSize: 11, lineHeight: 16, flex: 1 }}>
            Live call audio and voice webs on mobile need the full Spidr build (not Expo Go). These
            defaults are saved on this device and apply the moment that lands — until then you can
            join any call from the web or desktop app.
          </Text>
        </View>
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
