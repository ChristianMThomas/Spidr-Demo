import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronDown, Camera, Image as ImageIcon } from 'lucide-react-native';
import { useAppShell } from '../lib/appShellContext';
import { entities } from '../lib/apiClient';
import { Avatar } from '../components/ui/Avatar';
import { emitter } from '../lib/eventEmitter';
import { pickAndUpload } from '../lib/imageUpload';

// "My Profile" editor — the small-screen equivalent of the web app's
// USER SETTINGS → My Profile panel: banner + avatar preview up top, then
// Display Name / Bio / Status / Custom Status fields that PATCH the
// UserProfile doc. Avatar + banner uploads need expo-image-picker (Phase 2);
// the preview is display-only for now.
const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'online',  label: 'Online',         color: '#22c55e' },
  { value: 'idle',    label: 'Idle',           color: '#eab308' },
  { value: 'dnd',     label: 'Do Not Disturb', color: '#ef4444' },
  { value: 'offline', label: 'Invisible',      color: '#71717a' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentUser, refreshCurrentUser } = useAppShell();

  // The AppShell merge overwrites the profile doc's own id with the auth
  // user id, so refetch the raw profile row to get the PATCHable doc id.
  const { data: profileRow, isLoading } = useQuery({
    queryKey: ['profile-row', currentUser?.id],
    queryFn: async () => {
      const rows = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return (rows as any[])[0] || null;
    },
    enabled: !!currentUser?.id,
  });

  const [displayName,  setDisplayName]  = useState('');
  const [bio,          setBio]          = useState('');
  const [status,       setStatus]       = useState('online');
  const [customStatus, setCustomStatus] = useState('');
  const [statusOpen,   setStatusOpen]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [hydrated,     setHydrated]     = useState(false);
  const [uploadingKind, setUploadingKind] = useState<'banner' | 'avatar' | null>(null);

  // Pick an image, upload, PATCH the profile row directly. Keeps the picker
  // → upload → save round-trip snappy so the user sees the new banner/avatar
  // land without hitting Save.
  const uploadImage = async (kind: 'banner' | 'avatar') => {
    if (!profileRow?.id) return;
    setUploadingKind(kind);
    try {
      const url = await pickAndUpload({
        crop: true,
        aspect: kind === 'banner' ? [16, 9] : [1, 1],
      });
      if (!url) return;
      const patch = kind === 'banner' ? { banner_url: url } : { avatar_url: url };
      await entities.UserProfile.update(profileRow.id, patch);
      emitter.emit('spidr-profile-updated', { profile: patch });
      await refreshCurrentUser();
      queryClient.invalidateQueries({ queryKey: ['profile-row'] });
      queryClient.invalidateQueries({ queryKey: ['profile-of'] });
    } finally {
      setUploadingKind(null);
    }
  };

  useEffect(() => {
    if (!profileRow || hydrated) return;
    setDisplayName(profileRow.display_name || '');
    setBio(profileRow.bio || '');
    setStatus(profileRow.status || 'online');
    setCustomStatus(profileRow.custom_status || '');
    setHydrated(true);
  }, [profileRow, hydrated]);

  const save = async () => {
    if (!profileRow?.id) {
      Alert.alert('Profile not loaded', 'Pull to refresh and try again.');
      return;
    }
    setSaving(true);
    try {
      const patch = {
        display_name:  displayName.trim(),
        bio:           bio.trim(),
        status,
        custom_status: customStatus.trim(),
      };
      await entities.UserProfile.update(profileRow.id, patch);
      // Sync the shell so the Settings card / tab bar / profile view update
      // immediately without waiting for the next auth.me() round-trip.
      emitter.emit('spidr-profile-updated', { profile: patch });
      await refreshCurrentUser();
      queryClient.invalidateQueries({ queryKey: ['profile-of'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      router.back();
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const activeStatus = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#050505' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
          gap: 8,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <ArrowLeft size={20} color="#a1a1aa" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, flex: 1 }}>
          EDIT PROFILE
        </Text>
        <TouchableOpacity
          onPress={save}
          disabled={saving || !hydrated}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#dc2626',
            opacity: saving || !hydrated ? 0.5 : 1,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Check size={14} color="#fff" />
          )}
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
          {isLoading || !hydrated ? (
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <ActivityIndicator color="#dc2626" />
            </View>
          ) : (
            <>
              {/* Live preview card — banner + avatar + identity, like web */}
              <View
                style={{
                  margin: 16,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: '#18181b',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => uploadImage('banner')}
                  disabled={uploadingKind !== null}
                  style={{ height: 110, backgroundColor: '#1a0a0a', position: 'relative' }}
                >
                  {profileRow?.banner_url ? (
                    <Image
                      source={{ uri: profileRow.banner_url }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {uploadingKind === 'banner' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ImageIcon size={11} color="#fff" />
                    )}
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                      {uploadingKind === 'banner' ? 'Uploading…' : 'Change banner'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => uploadImage('avatar')}
                    disabled={uploadingKind !== null}
                    style={{
                      marginTop: -34,
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      borderWidth: 4,
                      borderColor: '#18181b',
                      overflow: 'hidden',
                      backgroundColor: '#0a0a0a',
                      position: 'relative',
                    }}
                  >
                    <Avatar
                      uri={profileRow?.avatar_url}
                      name={displayName || currentUser?.username}
                      size={64}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 4,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                      }}
                    >
                      {uploadingKind === 'avatar' ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Camera size={12} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 8 }}>
                    {displayName || currentUser?.username || 'User'}
                  </Text>
                  <Text style={{ color: '#71717a', fontSize: 12, fontFamily: 'monospace' }}>
                    @{currentUser?.username || 'user'}
                    {profileRow?.discriminator ? `#${profileRow.discriminator}` : ''}
                  </Text>
                  {!!bio && (
                    <Text style={{ color: '#d4d4d8', fontSize: 13, marginTop: 6 }} numberOfLines={2}>
                      {bio}
                    </Text>
                  )}
                </View>
              </View>

              {/* Fields */}
              <View style={{ paddingHorizontal: 16, gap: 18 }}>
                <Field label="Display Name">
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Your display name"
                    placeholderTextColor="#52525b"
                    maxLength={40}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Bio">
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell the web about yourself…"
                    placeholderTextColor="#52525b"
                    multiline
                    maxLength={300}
                    style={[inputStyle, { height: 110, textAlignVertical: 'top', paddingTop: 12 }]}
                  />
                </Field>

                <Field label="Status">
                  <TouchableOpacity
                    onPress={() => setStatusOpen((o) => !o)}
                    style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: activeStatus.color,
                      }}
                    />
                    <Text style={{ color: '#fff', fontSize: 14, flex: 1 }}>{activeStatus.label}</Text>
                    <ChevronDown size={16} color="#71717a" />
                  </TouchableOpacity>
                  {statusOpen && (
                    <View
                      style={{
                        marginTop: 6,
                        borderRadius: 12,
                        backgroundColor: '#111113',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                      }}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => {
                            setStatus(opt.value);
                            setStatusOpen(false);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            backgroundColor:
                              opt.value === status ? 'rgba(220,38,38,0.12)' : 'transparent',
                          }}
                        >
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: opt.color,
                            }}
                          />
                          <Text style={{ color: '#fff', fontSize: 14, flex: 1 }}>{opt.label}</Text>
                          {opt.value === status && <Check size={14} color="#dc2626" />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </Field>

                <Field label="Custom Status">
                  <TextInput
                    value={customStatus}
                    onChangeText={setCustomStatus}
                    placeholder="What's happening?"
                    placeholderTextColor="#52525b"
                    maxLength={80}
                    style={inputStyle}
                  />
                </Field>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const inputStyle = {
  backgroundColor: '#111113',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: '#fff',
  fontSize: 14,
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text
        style={{
          color: '#a1a1aa',
          fontSize: 12,
          fontWeight: '800',
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}
