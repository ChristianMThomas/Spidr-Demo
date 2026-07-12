import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Palette, Check, Sparkles } from 'lucide-react-native';
import { entities } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useThemeColors } from '../../lib/theme';

// ── Appearance (mobile) ──────────────────────────────────────────────────────
// Small-screen port of the web Theme Studio (spidr-client/src/components/spidr/
// ThemeStudio.jsx). Gradient + solid themes with the same preset list; saves to
// UserProfile.app_theme for cross-device sync and AsyncStorage via setAppTheme.
// Image themes (background URL + blur/opacity) stay web-only for now — an image
// theme synced from web is preserved untouched unless a new type is applied.

const PRESETS = [
  { name: 'Spidr Red',       primary: '#dc2626', secondary: '#7f1d1d' },
  { name: 'Symbiote Sludge', primary: '#4c1d95', secondary: '#000000' },
  { name: 'Cyber Rig',       primary: '#3b82f6', secondary: '#0f172a' },
  { name: 'The Boss',        primary: '#b45309', secondary: '#450a0a' },
  { name: 'Venom',           primary: '#7c3aed', secondary: '#1e0a3c' },
  { name: 'Carbon',          primary: '#18181b', secondary: '#000000' },
  { name: 'Deep Ocean',      primary: '#0ea5e9', secondary: '#0c4a6e' },
  { name: 'Matrix',          primary: '#16a34a', secondary: '#052e16' },
  { name: 'Inferno',         primary: '#ea580c', secondary: '#431407' },
  { name: 'Sakura',          primary: '#ec4899', secondary: '#500724' },
  { name: 'Midnight',        primary: '#1e1b4b', secondary: '#0f0f1a' },
  { name: 'Gold Rush',       primary: '#eab308', secondary: '#422006' },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function Appearance() {
  const router = useRouter();
  const { currentUser, appTheme, setAppTheme } = useAppShell();
  const colors = useThemeColors();

  const [theme, setTheme] = useState({ ...appTheme });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (updates: Partial<typeof theme>) => {
    setTheme((p) => ({ ...p, ...updates }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (theme.type === 'solid' && !HEX_RE.test(theme.primaryColor)) {
      Alert.alert('Invalid color', 'Use a 6-digit hex color like #dc2626.');
      return;
    }
    if (theme.type === 'gradient' && (!HEX_RE.test(theme.primaryColor) || !HEX_RE.test(theme.secondaryColor))) {
      Alert.alert('Invalid color', 'Both colors must be 6-digit hex like #dc2626.');
      return;
    }
    setSaving(true);
    setAppTheme(theme);
    try {
      const profiles: any = await entities.UserProfile.filter({ user_id: currentUser?.id });
      if (profiles?.[0]) {
        await entities.UserProfile.update(profiles[0].id, { app_theme: theme });
      } else {
        await entities.UserProfile.create({ user_id: currentUser?.id, app_theme: theme });
      }
    } catch {
      // Applied locally; DB sync will catch up on next save.
    }
    setSaving(false);
    setHasChanges(false);
    Alert.alert('Theme applied', 'Your theme is saved and will sync across devices.');
  };

  const activePreset = PRESETS.find(
    (p) => p.primary === theme.primaryColor && (theme.type === 'solid' || p.secondary === theme.secondaryColor),
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Palette size={18} color="#f97316" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>THEME STUDIO</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Colors and gradients, synced across devices.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {/* Type tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, gap: 4 }}>
          {(['gradient', 'solid'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => set({ type: t })}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center',
                backgroundColor: theme.type === t ? '#FF3333' : 'transparent',
              }}
            >
              <Text style={{ color: theme.type === t ? '#fff' : '#a1a1aa', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Presets */}
        <View>
          <Text style={sectionLabel}>QUICK PRESETS</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map((p) => {
              const selected = activePreset?.name === p.name;
              return (
                <TouchableOpacity
                  key={p.name}
                  onPress={() => set(theme.type === 'solid'
                    ? { primaryColor: p.primary }
                    : { primaryColor: p.primary, secondaryColor: p.secondary })}
                  activeOpacity={0.85}
                  style={{
                    width: '31%', flexGrow: 1, height: 56, borderRadius: 12, overflow: 'hidden',
                    borderWidth: 2, borderColor: selected ? '#fff' : 'transparent', justifyContent: 'flex-end',
                  }}
                >
                  <TwoTone primary={p.primary} secondary={theme.type === 'solid' ? p.primary : p.secondary} />
                  {selected && (
                    <View style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={10} strokeWidth={4} color="#000" />
                    </View>
                  )}
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', padding: 6, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 }}>
                    {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Hex inputs */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <HexInput
            label={theme.type === 'gradient' ? 'FROM COLOR' : 'COLOR'}
            value={theme.primaryColor}
            onChange={(v) => set({ primaryColor: v })}
          />
          {theme.type === 'gradient' && (
            <HexInput
              label="TO COLOR"
              value={theme.secondaryColor}
              onChange={(v) => set({ secondaryColor: v })}
            />
          )}
        </View>

        {/* Live preview */}
        <View>
          <Text style={sectionLabel}>LIVE PREVIEW</Text>
          <View style={{ height: 110, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <TwoTone
              primary={HEX_RE.test(theme.primaryColor) ? theme.primaryColor : '#111'}
              secondary={theme.type === 'solid'
                ? (HEX_RE.test(theme.primaryColor) ? theme.primaryColor : '#111')
                : (HEX_RE.test(theme.secondaryColor) ? theme.secondaryColor : '#111')}
            />
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)' }} />
            <View style={{ position: 'absolute', inset: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
              <View style={{ gap: 6 }}>
                <View style={{ width: 96, height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                <View style={{ width: 64, height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' }} />
              </View>
            </View>
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !hasChanges}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 13, borderRadius: 12,
            backgroundColor: hasChanges ? '#FF3333' : '#1a1a1a',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Sparkles size={14} color={hasChanges ? '#fff' : '#555'} />
          <Text style={{ color: hasChanges ? '#fff' : '#555', fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>
            {saving ? 'APPLYING…' : 'APPLY THEME'}
          </Text>
        </TouchableOpacity>

        <Text style={{ color: '#3f3f46', fontSize: 10, textAlign: 'center' }}>
          Image backgrounds (wallpaper, blur, overlay) can be set from the web Theme Studio and will sync here.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// RN core has no gradients; approximate the 135° gradient with a two-tone split.
function TwoTone({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' }}>
      <View style={{ flex: 1, backgroundColor: primary }} />
      <View style={{ flex: 1, backgroundColor: secondary }} />
      <View style={{ position: 'absolute', inset: 0, backgroundColor: primary, opacity: 0.35 }} />
    </View>
  );
}

function HexInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = HEX_RE.test(value);
  return (
    <View style={{ flex: 1 }}>
      <Text style={sectionLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111', borderWidth: 1, borderColor: valid ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.5)', borderRadius: 10, paddingHorizontal: 10 }}>
        <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: valid ? value : '#333', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }} />
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.startsWith('#') ? t : '#' + t)}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          placeholder="#dc2626"
          placeholderTextColor="#3f3f46"
          style={{ flex: 1, color: '#fff', fontFamily: 'monospace', fontSize: 13, paddingVertical: 10 }}
        />
      </View>
    </View>
  );
}

const sectionLabel = {
  color: '#71717a',
  fontSize: 10,
  fontWeight: '900' as const,
  letterSpacing: 2,
  marginBottom: 8,
};
