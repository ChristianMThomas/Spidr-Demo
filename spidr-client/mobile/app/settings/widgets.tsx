import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Blocks, Download, Trash2, Star } from 'lucide-react-native';
import { entities, moduleActions } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useThemeColors } from '../../lib/theme';

// ── Widgets (mobile) ─────────────────────────────────────────────────────────
// Manage the profile MODS: your installed modules (uninstall) and the public
// module catalog (install). Same entities + /modules/:id/install|uninstall
// endpoints the web nexus store uses; installed widgets render on the
// profile's MODS tab.

const TYPE_LABELS: Record<string, string> = {
  static_text: 'STATIC',
  display_widget: 'DISPLAY',
  api_sync: 'API SYNC',
  live_feed: 'LIVE FEED',
};

export default function Widgets() {
  const router = useRouter();
  const colors = useThemeColors();
  const { currentUser } = useAppShell();
  const queryClient = useQueryClient();

  const { data: modules = [], isLoading: loadingModules } = useQuery<any[]>({
    queryKey: ['modules-catalog'],
    queryFn: () => entities.Module.list('-install_count', 100),
    staleTime: 60_000,
  });

  const { data: installed = [], isLoading: loadingInstalled } = useQuery<any[]>({
    queryKey: ['installed-modules', currentUser?.id],
    queryFn: () => entities.InstalledModule.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
  });

  const installedIds = new Set(installed.map((i: any) => i.module_id));
  const byId = new Map(modules.map((m: any) => [m.id, m]));
  const installedRows = installed
    .map((i: any) => ({ install: i, module: byId.get(i.module_id) }))
    .filter((r) => r.module);
  const available = modules.filter((m: any) => !installedIds.has(m.id) && m.is_public !== false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['installed-modules', currentUser?.id] });
    queryClient.invalidateQueries({ queryKey: ['modules-catalog'] });
  };

  const installMutation = useMutation({
    mutationFn: (moduleId: string) => moduleActions.install(moduleId),
    onSuccess: refresh,
    onError: () => Alert.alert('Install failed', 'Could not install this module. Try again.'),
  });

  const uninstallMutation = useMutation({
    mutationFn: (moduleId: string) => moduleActions.uninstall(moduleId),
    onSuccess: refresh,
    onError: () => Alert.alert('Uninstall failed', 'Could not remove this module. Try again.'),
  });

  const confirmUninstall = (m: any) =>
    Alert.alert('Remove widget?', `${m.name} will disappear from your profile MODS.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => uninstallMutation.mutate(m.id) },
    ]);

  const loading = loadingModules || loadingInstalled;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(96,165,250,0.1)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Blocks size={18} color="#60a5fa" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>MOD BAY</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Widgets rendered on your profile's MODS tab.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}

        {!loading && (
          <>
            <Text style={sectionLabel}>INSTALLED ({installedRows.length})</Text>
            {installedRows.length === 0 ? (
              <View style={card(colors.surface)}>
                <Text style={{ color: '#71717a', fontSize: 12 }}>
                  No mods installed yet. Grab one from the catalog below — it shows up on your profile instantly.
                </Text>
              </View>
            ) : (
              installedRows.map(({ module }) => (
                <ModuleCard key={module.id} module={module} surface={colors.surface}>
                  <ActionButton
                    label={uninstallMutation.isPending ? 'REMOVING…' : 'REMOVE'}
                    Icon={Trash2}
                    color="#f87171"
                    onPress={() => confirmUninstall(module)}
                    disabled={uninstallMutation.isPending}
                  />
                </ModuleCard>
              ))
            )}

            <Text style={sectionLabel}>CATALOG ({available.length})</Text>
            {available.map((m: any) => (
              <ModuleCard key={m.id} module={m} surface={colors.surface}>
                <ActionButton
                  label={installMutation.isPending ? 'INSTALLING…' : 'INSTALL'}
                  Icon={Download}
                  color="#22c55e"
                  onPress={() => installMutation.mutate(m.id)}
                  disabled={installMutation.isPending}
                />
              </ModuleCard>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModuleCard({ module, surface, children }: { module: any; surface: string; children: React.ReactNode }) {
  return (
    <View style={card(surface)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{module.name}</Text>
          <Text style={{ color: '#52525b', fontSize: 10, marginTop: 2 }} numberOfLines={1}>
            by {module.author_name || 'unknown'} · v{module.version || '1.0.0'}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)' }}>
          <Text style={{ color: '#60a5fa', fontSize: 8, fontWeight: '900', letterSpacing: 1 }}>
            {TYPE_LABELS[module.type] || 'MOD'}
          </Text>
        </View>
      </View>

      {!!module.description && (
        <Text style={{ color: '#71717a', fontSize: 11, lineHeight: 16, marginBottom: 10 }} numberOfLines={2}>
          {module.description}
        </Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Download size={10} color="#52525b" />
            <Text style={{ color: '#52525b', fontSize: 10, fontFamily: 'monospace' }}>{module.install_count || 0}</Text>
          </View>
          {module.rating > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Star size={10} color="#eab308" />
              <Text style={{ color: '#52525b', fontSize: 10, fontFamily: 'monospace' }}>{module.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        {children}
      </View>
    </View>
  );
}

function ActionButton({
  label, Icon, color, onPress, disabled,
}: { label: string; Icon: any; color: string; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9,
        backgroundColor: color + '1A', borderWidth: 1, borderColor: color + '55',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={11} color={color} />
      <Text style={{ color, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const card = (surface: string) => ({
  backgroundColor: surface,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.06)',
  borderRadius: 14,
  padding: 14,
});

const sectionLabel = {
  color: '#71717a',
  fontSize: 10,
  fontWeight: '900' as const,
  letterSpacing: 2,
  marginLeft: 4,
  marginBottom: -4,
};
