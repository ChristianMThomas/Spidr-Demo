import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Terminal,
  Globe,
  Clock,
  Link2,
  Blocks,
  Pencil,
  Music,
} from 'lucide-react-native';
import { useAppShell } from '../../lib/appShellContext';
import { entities } from '../../lib/apiClient';
import { useTension } from '../../hooks/useTension';
import { Avatar } from '../ui/Avatar';
import { Spinner } from '../ui/Spinner';
import { NowPlayingCard } from '../spidr/NowPlayingCard';

const STATUS_COLOR: Record<string, string> = {
  online: '#22c55e',
  idle: '#eab308',
  dnd: '#ef4444',
  streaming: '#a855f7',
  offline: '#71717a',
};

const phaseTwo = (label: string) =>
  Alert.alert('Phase 2 — Coming soon', `${label} on mobile lands in Phase 2.`);

type TabKey = 'bio' | 'modules' | 'links';
const TABS: { key: TabKey; label: string; Icon: any }[] = [
  { key: 'bio', label: 'BIO', Icon: Terminal },
  { key: 'modules', label: 'MODS', Icon: Blocks },
  { key: 'links', label: 'LINKS', Icon: Link2 },
];

// Reusable rich profile view (own profile). Banner + accent avatar + identity
// + BIO/MODS/LINKS tabs. Renders inside whatever screen wraps it — the wrapper
// owns the header / back button / settings entry.
export function ProfileView() {
  const { currentUser, userLoaded, refreshCurrentUser } = useAppShell();
  const { level, progress } = useTension();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('bio');

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshCurrentUser();
    setRefreshing(false);
  };

  if (!userLoaded) return <Spinner />;
  if (!currentUser) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050505' }}>
        <Text style={{ color: '#fff' }}>Not signed in.</Text>
      </View>
    );
  }

  const isApex = !!currentUser?.apex_features || currentUser?.tier === 'APEX';
  const accentColor = currentUser?.username_color || '#dc2626';
  const status = currentUser?.status || 'offline';
  const statusColor = STATUS_COLOR[status] || STATUS_COLOR.offline;
  const tag = String(currentUser?.id || '').slice(0, 4) || '0000';
  const handle =
    currentUser?.username ||
    String(currentUser?.display_name || 'user').toLowerCase().replace(/\s+/g, '_');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#050505' }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}
    >
      {/* Banner */}
      <View style={{ height: 160, backgroundColor: '#1a0a0a', position: 'relative' }}>
        {currentUser?.banner_url ? (
          <Image source={{ uri: currentUser.banner_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#1a0a0a', opacity: 0.9 }} />
        )}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, backgroundColor: 'rgba(5,5,5,0.85)' }}
        />
        <TouchableOpacity
          onPress={() => phaseTwo('Banner edit')}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: 'rgba(0,0,0,0.65)',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Pencil size={10} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <View style={{ paddingHorizontal: 20, marginTop: -52 }}>
        <View style={{ width: 96, height: 96, position: 'relative' }}>
          {isApex && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                left: -4,
                right: -4,
                bottom: -4,
                borderRadius: 22,
                backgroundColor: accentColor,
                opacity: 0.4,
              }}
            />
          )}
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 20,
              borderWidth: 3,
              borderColor: accentColor + 'A0',
              overflow: 'hidden',
              backgroundColor: '#18181b',
            }}
          >
            <Avatar uri={currentUser?.avatar_url} name={currentUser?.display_name || currentUser?.username} size={90} />
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: statusColor,
              borderWidth: 3,
              borderColor: '#050505',
            }}
          />
          <TouchableOpacity
            onPress={() => phaseTwo('Avatar edit')}
            hitSlop={6}
            style={{
              position: 'absolute',
              bottom: -4,
              left: -4,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#dc2626',
              borderWidth: 2,
              borderColor: '#050505',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pencil size={10} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Identity */}
      <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ color: isApex ? accentColor : '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
            {currentUser?.display_name || currentUser?.username || 'User'}
          </Text>
          {isApex && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#dc2626' }}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>APEX</Text>
            </View>
          )}
        </View>

        <Text style={{ color: '#a1a1aa', fontSize: 13, fontFamily: 'monospace', marginTop: 2 }}>
          <Text style={{ color: '#71717a' }}>@</Text>
          <Text style={{ color: '#d4d4d8', fontWeight: '700' }}>{handle}</Text>
          <Text style={{ color: '#52525b' }}>#{tag}</Text>
        </Text>

        {!!currentUser?.custom_status && (
          <Text style={{ color: '#71717a', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
            {currentUser.custom_status}
          </Text>
        )}
      </View>

      {/* Level + Now Playing */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#0f0f0f',
          marginHorizontal: 16,
          marginTop: 16,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.18)',
        }}
      >
        <Award color="#dc2626" size={20} />
        <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 10 }}>Level {level || 1}</Text>
        {progress?.xp != null && (
          <Text style={{ color: '#a1a1aa', marginLeft: 'auto', fontSize: 12, fontWeight: '700' }}>
            {progress.xp} XP
          </Text>
        )}
      </View>

      <NowPlayingCard userId={currentUser.id} />

      {/* Tab strip */}
      <View
        style={{
          flexDirection: 'row',
          marginTop: 18,
          marginHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                gap: 6,
                borderBottomWidth: 2,
                borderBottomColor: active ? '#FF3333' : 'transparent',
              }}
            >
              <Icon size={12} color={active ? '#fff' : '#71717a'} />
              <Text style={{ color: active ? '#fff' : '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, minHeight: 220 }}>
        {tab === 'bio' && <BioPanel currentUser={currentUser} />}
        {tab === 'modules' && <ModulesPanel userId={currentUser.id} />}
        {tab === 'links' && <LinksPanel socialLinks={currentUser?.social_links} website={currentUser?.website} />}
      </View>
    </ScrollView>
  );
}

// ── BIO ────────────────────────────────────────────────────────────────────
function BioPanel({ currentUser }: { currentUser: any }) {
  const [localTime, setLocalTime] = useState('');
  const tz = currentUser?.timezone || undefined;
  const tzLabel = useMemo(() => {
    if (currentUser?.location) return currentUser.location;
    if (tz) return tz.split('/').slice(-1)[0]?.replace(/_/g, ' ') || tz;
    return 'Local';
  }, [tz, currentUser?.location]);

  useEffect(() => {
    const update = () => {
      try {
        setLocalTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz }));
      } catch {
        setLocalTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [tz]);

  return (
    <View style={{ gap: 10 }}>
      <Row label={`LOCAL TIME (${tzLabel})`} icon={<Globe size={11} color="#60a5fa" />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Clock size={11} color="#a1a1aa" />
          <Text style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>{localTime}</Text>
        </View>
      </Row>

      <View
        style={{
          padding: 12,
          backgroundColor: 'rgba(0,0,0,0.4)',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <Terminal size={10} color="#71717a" />
          <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 2 }}>SIGNAL BIO</Text>
        </View>
        <Text style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 19 }}>
          {currentUser?.bio || 'No bio data transmitted.'}
        </Text>
      </View>

      {currentUser?.profile_anthem?.title && (
        <TouchableOpacity
          onPress={() => phaseTwo('Anthem playback')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: 10,
            backgroundColor: 'rgba(168,85,247,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(168,85,247,0.25)',
          }}
        >
          <Music size={14} color="#a855f7" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#c084fc', fontSize: 9, fontWeight: '900', letterSpacing: 2 }}>PROFILE ANTHEM</Text>
            <Text style={{ color: '#fff', fontSize: 12 }} numberOfLines={1}>
              {currentUser.profile_anthem.title}
              {currentUser.profile_anthem.artist ? ` — ${currentUser.profile_anthem.artist}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <MiniWidget
          label="VIBE CHECK"
          value={currentUser?.activity?.name ? `🎵 ${currentUser.activity.name}` : '🎵 –'}
          onEdit={() => phaseTwo('Vibe Check edit')}
        />
        <MiniWidget
          label="NEON SIGN"
          value={currentUser?.pronouns || '✨ Set sign'}
          valueColor="#ec4899"
          onEdit={() => phaseTwo('Neon Sign edit')}
        />
      </View>
    </View>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        backgroundColor: 'rgba(17,17,17,0.8)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

function MiniWidget({
  label,
  value,
  valueColor,
  onEdit,
}: {
  label: string;
  value: string;
  valueColor?: string;
  onEdit: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onEdit}
      style={{
        flex: 1,
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <Text style={{ color: '#dc2626', fontSize: 9, fontWeight: '900', letterSpacing: 2 }}>{label}</Text>
      <Text
        style={{ color: valueColor || '#fff', fontSize: 12, marginTop: 4, fontWeight: valueColor ? '800' : '500' }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </TouchableOpacity>
  );
}

// ── MODULES ────────────────────────────────────────────────────────────────
function ModulesPanel({ userId }: { userId: string }) {
  const { data: installed = [], isLoading } = useQuery({
    queryKey: ['profile-modules', userId],
    queryFn: () => entities.InstalledModule.filter({ user_id: userId }),
    enabled: !!userId,
  });
  const { data: allModules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: () => entities.Module.list('-install_count', 200),
  });

  const installedIds = (installed as any[]).map((i) => i.module_id);
  const modules = (allModules as any[]).filter((m) => installedIds.includes(m.id));

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <ActivityIndicator color="#dc2626" />
      </View>
    );
  }

  if (modules.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Blocks size={24} color="#27272a" />
        <Text style={{ color: '#52525b', fontSize: 10, fontFamily: 'monospace', marginTop: 6 }}>
          NO MODULES INSTALLED
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {modules.map((mod: any) => (
        <TouchableOpacity
          key={mod.id}
          onPress={() => phaseTwo(`${mod.name || 'Module'} widget`)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            backgroundColor: 'rgba(17,17,17,0.8)',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.05)',
            gap: 10,
          }}
        >
          {mod.icon_url ? (
            <Image source={{ uri: mod.icon_url }} style={{ width: 32, height: 32, borderRadius: 6 }} />
          ) : (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: 'rgba(220,38,38,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Blocks size={16} color="#dc2626" />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
              {mod.name || 'Module'}
            </Text>
            {!!mod.description && (
              <Text style={{ color: '#71717a', fontSize: 11 }} numberOfLines={1}>
                {mod.description}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── LINKS ──────────────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { label: string; color: string }> = {
  twitter: { label: 'Twitter / X', color: '#38bdf8' },
  youtube: { label: 'YouTube', color: '#ef4444' },
  twitch: { label: 'Twitch', color: '#a855f7' },
  github: { label: 'GitHub', color: '#d4d4d8' },
  discord: { label: 'Discord', color: '#818cf8' },
};

function LinksPanel({ socialLinks, website }: { socialLinks?: any; website?: string }) {
  const links = socialLinks || {};
  const entries = Object.entries(links).filter(([, v]) => !!v);
  const hasAnything = entries.length > 0 || !!website;

  if (!hasAnything) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Link2 size={24} color="#27272a" />
        <Text style={{ color: '#52525b', fontSize: 11, marginTop: 6 }}>No external connections linked</Text>
      </View>
    );
  }

  // Strict scheme allowlist — without this a stored social-link value like
  // `javascript:alert(1)` (or `javascript:http://...` to bypass naive prefix
  // checks) would be handed to Linking.openURL. We normalize to https:// when
  // the user typed a bare domain and reject anything that isn't http(s).
  const open = (raw: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return;
    let candidate = trimmed;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
      // bare host (no scheme) — assume https
      candidate = `https://${candidate}`;
    }
    try {
      const u = new URL(candidate);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        Alert.alert('Blocked link', 'Only http and https links can be opened.');
        return;
      }
      Linking.openURL(u.toString()).catch(() => Alert.alert('Could not open link'));
    } catch {
      Alert.alert('Invalid link', 'That URL could not be parsed.');
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {website && <LinkRow label="Website" value={website} color="#34d399" onPress={() => open(website)} />}
      {entries.map(([platform, value]) => {
        const meta = PLATFORM_META[platform] || { label: platform, color: '#a1a1aa' };
        return (
          <LinkRow
            key={platform}
            label={meta.label}
            value={String(value)}
            color={meta.color}
            onPress={() => open(String(value))}
          />
        );
      })}
    </View>
  );
}

function LinkRow({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  value: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        backgroundColor: color + '14',
        borderWidth: 1,
        borderColor: color + '4D',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: color + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        }}
      >
        <Text style={{ color, fontSize: 13, fontWeight: '900' }}>{label.charAt(0)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{label.toUpperCase()}</Text>
        <Text style={{ color: '#fff', fontSize: 13 }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Link2 size={12} color="#71717a" />
    </TouchableOpacity>
  );
}
