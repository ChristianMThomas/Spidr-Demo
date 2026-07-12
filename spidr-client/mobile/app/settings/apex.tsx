import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Crown, Check } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useThemeColors } from '../../lib/theme';

// ── APEX customization (mobile) ──────────────────────────────────────────────
// Small-screen port of the web ApexVisuals panel: avatar frame, nameplate
// style, and badge glow. Writes the same top-level profile fields AND mirrors
// them into apex_features, exactly like the web save path, so both clients
// read a consistent state. Frame ids come from web FrameRegistry.jsx and
// nameplate styles from ApexVisuals.jsx — keep the lists in sync with those.

const FRAMES = [
  { id: 'symbiote-tear', label: 'Symbiote Tear' },
  { id: 'liquid-metal',  label: 'Liquid Metal' },
  { id: 'cyber-glitch',  label: 'Cyber Glitch' },
  { id: 'void-pulse',    label: 'Void Pulse' },
];

const NAMEPLATES = ['default', 'glitch', 'neon', 'terminal'];

const GLOWS = [
  { id: '#fb923c', label: 'Ember' },
  { id: '#ef4444', label: 'Crimson' },
  { id: '#a855f7', label: 'Void' },
  { id: '#22c55e', label: 'Toxin' },
  { id: '#38bdf8', label: 'Cryo' },
  { id: '#eab308', label: 'Gold' },
];

export default function Apex() {
  const router = useRouter();
  const colors = useThemeColors();
  const { currentUser, refreshCurrentUser } = useAppShell();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery<any>({
    queryKey: ['user-profile', currentUser?.id],
    queryFn: async () => {
      const res: any = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return res?.[0] ?? null;
    },
    enabled: !!currentUser?.id,
  });

  const apexFeatures = profile?.apex_features || {};
  const frame = apexFeatures.apexFrameStyle || profile?.apexFrameStyle || 'symbiote-tear';
  const nameplate = profile?.apexNameplateStyle || apexFeatures.apexNameplateStyle || 'default';
  const glow = profile?.apexBadgeGlow || '#fb923c';

  // Same dual-write the web does: top-level field + apex_features mirror.
  const save = async (patch: Record<string, string>) => {
    if (!profile?.id || saving) return;
    setSaving(true);
    try {
      await entities.UserProfile.update(profile.id, {
        ...patch,
        apex_features: { ...apexFeatures, ...patch },
      });
      queryClient.invalidateQueries({ queryKey: ['user-profile', currentUser?.id] });
      refreshCurrentUser();
    } catch {
      Alert.alert('Save failed', 'Could not update your APEX look. Try again.');
    }
    setSaving(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(234,179,8,0.12)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Crown size={18} color="#eab308" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>APEX PROTOCOL</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Frame, nameplate and halo — visible everywhere.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Frame */}
        <Text style={sectionLabel}>AVATAR FRAME</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FRAMES.map((f) => (
            <ChoiceChip
              key={f.id}
              label={f.label}
              selected={frame === f.id}
              accent="#eab308"
              surface={colors.surface}
              onPress={() => save({ apexFrameStyle: f.id })}
              disabled={saving || !profile}
            />
          ))}
        </View>

        {/* Nameplate */}
        <Text style={sectionLabel}>NAMEPLATE STYLE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {NAMEPLATES.map((n) => (
            <ChoiceChip
              key={n}
              label={n.toUpperCase()}
              selected={nameplate === n}
              accent="#eab308"
              surface={colors.surface}
              onPress={() => save({ apexNameplateStyle: n })}
              disabled={saving || !profile}
            />
          ))}
        </View>

        {/* Badge glow */}
        <Text style={sectionLabel}>BADGE GLOW</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {GLOWS.map((g) => {
            const selected = glow.toLowerCase() === g.id.toLowerCase();
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => save({ apexBadgeGlow: g.id })}
                disabled={saving || !profile}
                style={{ alignItems: 'center', gap: 5 }}
              >
                <View
                  style={{
                    width: 46, height: 46, borderRadius: 23, backgroundColor: g.id + '33',
                    borderWidth: 2, borderColor: selected ? '#fff' : g.id + '77',
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: g.id, shadowOpacity: 0.8, shadowRadius: 8,
                  }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: g.id, alignItems: 'center', justifyContent: 'center' }}>
                    {selected && <Check size={12} strokeWidth={4} color="#000" />}
                  </View>
                </View>
                <Text style={{ color: selected ? '#fff' : '#71717a', fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
                  {g.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ color: '#3f3f46', fontSize: 10, textAlign: 'center', lineHeight: 15, marginTop: 8 }}>
          Changes save instantly and apply on web, desktop and mobile. Nameplate image cropping lives on desktop.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoiceChip({
  label, selected, onPress, accent, surface, disabled,
}: { label: string; selected: boolean; onPress: () => void; accent: string; surface: string; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
        backgroundColor: selected ? accent + '22' : surface,
        borderWidth: 1, borderColor: selected ? accent + '88' : 'rgba(255,255,255,0.08)',
        flexDirection: 'row', alignItems: 'center', gap: 6,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {selected && <Check size={11} strokeWidth={4} color={accent} />}
      <Text style={{ color: selected ? '#fff' : '#a1a1aa', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const sectionLabel = {
  color: '#71717a',
  fontSize: 10,
  fontWeight: '900' as const,
  letterSpacing: 2,
  marginLeft: 4,
  marginBottom: -4,
};
