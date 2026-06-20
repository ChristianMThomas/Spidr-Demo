import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  User as UserIcon,
  Palette,
  Bell,
  Lock,
  Mic,
  Video,
  Plug,
  Shield,
  Cpu,
  Blocks,
  Crown,
  LogOut,
  Info,
} from 'lucide-react-native';
import { useAppShell } from '../../lib/appShellContext';
import { useAuth } from '../../lib/authContext';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Spinner';

const phaseTwo = (label: string) =>
  Alert.alert('Phase 2 — Coming soon', `${label} on mobile lands in Phase 2.`);

interface Row {
  key: string;
  label: string;
  hint?: string;
  Icon: any;
  color?: string;
  onPress: () => void;
}

interface Section {
  title: string;
  rows: Row[];
}

export default function Settings() {
  const { currentUser, userLoaded } = useAppShell();
  const { logout } = useAuth();
  const router = useRouter();

  if (!userLoaded) return <Spinner />;

  const isApex = !!currentUser?.apex_features || currentUser?.tier === 'APEX';

  const sections: Section[] = [
    {
      title: 'ACCOUNT',
      rows: [
        {
          key: 'profile',
          label: 'My Profile',
          hint: 'View and edit your public profile',
          Icon: UserIcon,
          color: '#dc2626',
          onPress: () => router.push('/profile-edit'),
        },
        {
          key: 'connections',
          label: 'Connections',
          hint: 'Spotify, Steam, Twitch, etc.',
          Icon: Plug,
          color: '#a855f7',
          onPress: () => phaseTwo('Connections'),
        },
        {
          key: 'security',
          label: 'Security & 2FA',
          hint: 'Password, two-factor, sessions',
          Icon: Shield,
          color: '#22c55e',
          onPress: () => phaseTwo('Security'),
        },
      ],
    },
    {
      title: 'APP',
      rows: [
        {
          key: 'appearance',
          label: 'Appearance',
          hint: 'Theme, accent color, layout',
          Icon: Palette,
          color: '#f97316',
          onPress: () => phaseTwo('Appearance'),
        },
        {
          key: 'notifications',
          label: 'Notifications',
          hint: 'Push, sound, badge',
          Icon: Bell,
          color: '#eab308',
          onPress: () => phaseTwo('Notifications'),
        },
        {
          key: 'privacy',
          label: 'Privacy',
          hint: 'Who can DM, friend, find you',
          Icon: Lock,
          color: '#60a5fa',
          onPress: () => phaseTwo('Privacy'),
        },
      ],
    },
    {
      title: 'MEDIA',
      rows: [
        {
          key: 'voice',
          label: 'Voice & Video',
          hint: 'Mic, camera, push-to-talk',
          Icon: Mic,
          color: '#ec4899',
          onPress: () => phaseTwo('Voice & Video'),
        },
        {
          key: 'avlab',
          label: 'A/V Lab',
          hint: 'Studio + clip uploader',
          Icon: Video,
          color: '#06b6d4',
          onPress: () => phaseTwo('A/V Lab'),
        },
      ],
    },
    {
      title: 'SYSTEM',
      rows: [
        {
          key: 'protocol',
          label: 'Protocol',
          hint: 'Network & socket diagnostics',
          Icon: Cpu,
          color: '#84cc16',
          onPress: () => phaseTwo('Protocol'),
        },
        {
          key: 'widgets',
          label: 'Widgets',
          hint: 'Manage installed modules',
          Icon: Blocks,
          color: '#60a5fa',
          onPress: () => phaseTwo('Widgets'),
        },
        ...(isApex
          ? [
              {
                key: 'apex',
                label: 'APEX',
                hint: 'Frame, nameplate, halo',
                Icon: Crown,
                color: '#eab308',
                onPress: () => phaseTwo('APEX customization'),
              } as Row,
            ]
          : []),
        {
          key: 'about',
          label: 'About',
          hint: 'Patch notes, version, credits',
          Icon: Info,
          color: '#a1a1aa',
          onPress: () => phaseTwo('About'),
        },
      ],
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#050505' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
            Settings
          </Text>
        </View>

        {/* Profile preview card → /profile-edit */}
        <TouchableOpacity
          onPress={() => router.push('/profile-edit')}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 16,
            backgroundColor: '#0f0f0f',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.18)',
            gap: 12,
          }}
        >
          <Avatar
            uri={currentUser?.avatar_url}
            name={currentUser?.display_name || currentUser?.username}
            size={52}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                {currentUser?.display_name || currentUser?.username || 'User'}
              </Text>
              {isApex && (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 999,
                    backgroundColor: '#dc2626',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1 }}>
                    APEX
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              @{currentUser?.username || 'user'} · View profile
            </Text>
          </View>
          <ChevronRight color="#71717a" size={18} />
        </TouchableOpacity>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={{ marginTop: 22 }}>
            <Text
              style={{
                color: '#71717a',
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 2,
                marginLeft: 22,
                marginBottom: 8,
              }}
            >
              {section.title}
            </Text>
            <View
              style={{
                marginHorizontal: 16,
                backgroundColor: '#0f0f0f',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}
            >
              {section.rows.map((row, i) => (
                <SettingsRow
                  key={row.key}
                  row={row}
                  isLast={i === section.rows.length - 1}
                />
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <View style={{ marginTop: 28, marginHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Log out?', 'You can log back in at any time.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => logout() },
              ])
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#180a0a',
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.25)',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <LogOut color="#dc2626" size={18} />
            <Text style={{ color: '#dc2626', fontWeight: '900', letterSpacing: 1 }}>LOG OUT</Text>
          </TouchableOpacity>
        </View>

        {/* Footer / version */}
        <View style={{ alignItems: 'center', marginTop: 18 }}>
          <Text style={{ color: '#3f3f46', fontSize: 10, fontFamily: 'monospace' }}>
            SPIDR MOBILE · PATCH 1.9
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({ row, isLast }: { row: Row; isLast: boolean }) {
  const { Icon, label, hint, color, onPress } = row;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: (color || '#dc2626') + '1F',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={color || '#dc2626'} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
          {label}
        </Text>
        {!!hint && (
          <Text style={{ color: '#71717a', fontSize: 11, marginTop: 1 }} numberOfLines={1}>
            {hint}
          </Text>
        )}
      </View>
      <ChevronRight color="#52525b" size={16} />
    </TouchableOpacity>
  );
}
