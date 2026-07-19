import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Video as VideoIcon, UploadCloud, Film, Hash, CheckCircle2 } from 'lucide-react-native';
import { entities, integrations } from '../../lib/apiClient';
import { useAppShell } from '../../lib/appShellContext';
import { useThemeColors } from '../../lib/theme';

// ── A/V Lab (mobile) ─────────────────────────────────────────────────────────
// Pocket clip uploader for THE WEB. Picks a video from the library, uploads it
// through the same /upload endpoint as everything else, then creates a Clip
// with the exact field shape the web VideoStudio publishes (so the FYP
// algorithm, likes and comments treat mobile strands identically). The web
// studio's trim/filter/thumbnail tooling stays desktop-only — this is the
// fast lane: pick, caption, deploy.

export default function AvLab() {
  const router = useRouter();
  const colors = useThemeColors();
  const { currentUser } = useAppShell();
  const queryClient = useQueryClient();

  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [hashtagsRaw, setHashtagsRaw] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,   // lets iOS/Android trim natively
      quality: 0.9,
      videoMaxDuration: 180,
    });
    if (!result.canceled && result.assets?.[0]) {
      setVideo(result.assets[0]);
      setPublished(false);
    }
  };

  const publish = async () => {
    if (!video) return;
    if (!caption.trim()) {
      Alert.alert('Add a caption', 'Every strand needs a caption before it deploys.');
      return;
    }
    setPublishing(true);
    try {
      const file = {
        uri: video.uri,
        name: video.fileName || `clip-${Date.now()}.mp4`,
        type: video.mimeType || 'video/mp4',
      };
      const up: any = await integrations.Core.UploadFile({ file });
      if (!up?.url) throw new Error('upload failed');

      const hashtags = hashtagsRaw
        .split(/[\s,#]+/)
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10);

      const ratio = video.width && video.height && video.width > video.height ? '16:9' : '9:16';

      // Field shape mirrors web VideoStudio.jsx publish payload.
      await entities.Clip.create({
        video_url: up.url,
        thumbnail_url: '',
        caption: caption.trim(),
        hashtags,
        author_id: currentUser?.id,
        author_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
        author_avatar: currentUser?.avatar_url || '',
        duration: video.duration ? Math.round(video.duration / 1000) : 0,
        aspect_ratio: ratio,
        crop_data: null,
        style: { ratio, filter: 'none' },
        likes: [],
        comments_count: 0,
        shares_count: 0,
        views: 0,
        audio_id: '',
        grafted_audio: null,
      });

      queryClient.invalidateQueries({ queryKey: ['clips'] });
      queryClient.invalidateQueries({ queryKey: ['algo-feed'] });
      setPublished(true);
      setVideo(null);
      setCaption('');
      setHashtagsRaw('');
    } catch {
      Alert.alert('Deploy failed', 'The clip could not be uploaded. Check your connection and try again.');
    }
    setPublishing(false);
  };

  const durationLabel = video?.duration ? `${Math.round(video.duration / 1000)}s` : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(6,182,212,0.1)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <VideoIcon size={18} color="#06b6d4" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>A/V LAB</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Deploy a strand to THE WEB from your phone.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Picker */}
        <TouchableOpacity
          onPress={pickVideo}
          activeOpacity={0.85}
          style={{
            height: 150, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: colors.surface, borderWidth: 2, borderStyle: 'dashed',
            borderColor: video ? colors.accent + '88' : 'rgba(255,255,255,0.12)',
          }}
        >
          <Film size={30} color={video ? colors.accent : '#52525b'} />
          {video ? (
            <>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>
                {video.fileName || 'Selected clip'}
              </Text>
              <Text style={{ color: '#71717a', fontSize: 11, fontFamily: 'monospace' }}>
                {durationLabel ? `${durationLabel} · ` : ''}{video.width}×{video.height} · tap to change
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '700' }}>Pick a video</Text>
              <Text style={{ color: '#52525b', fontSize: 11 }}>Up to 3 minutes · trims natively on select</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Caption */}
        <View style={card(colors.surface)}>
          <Text style={sectionLabel}>CAPTION</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="What's this strand about?"
            placeholderTextColor="#3f3f46"
            multiline
            maxLength={220}
            style={{ color: '#fff', fontSize: 14, minHeight: 60, textAlignVertical: 'top' }}
          />
          <Text style={{ color: '#3f3f46', fontSize: 10, textAlign: 'right' }}>{caption.length}/220</Text>
        </View>

        {/* Hashtags */}
        <View style={card(colors.surface)}>
          <Text style={sectionLabel}>HASHTAGS</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Hash size={14} color="#52525b" />
            <TextInput
              value={hashtagsRaw}
              onChangeText={setHashtagsRaw}
              placeholder="gaming clutch spidr (space-separated, max 10)"
              placeholderTextColor="#3f3f46"
              autoCapitalize="none"
              style={{ color: '#fff', fontSize: 13, flex: 1, paddingVertical: 6 }}
            />
          </View>
        </View>

        {/* Deploy */}
        <TouchableOpacity
          onPress={publish}
          disabled={!video || publishing}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 14, borderRadius: 12,
            backgroundColor: video && !publishing ? colors.accent : '#1a1a1a',
          }}
        >
          {publishing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <UploadCloud size={16} color={video ? '#fff' : '#555'} />
          )}
          <Text style={{ color: video && !publishing ? '#fff' : '#555', fontSize: 12, fontWeight: '900', letterSpacing: 2 }}>
            {publishing ? 'DEPLOYING…' : 'DEPLOY STRAND'}
          </Text>
        </TouchableOpacity>

        {published && (
          <View style={[card(colors.surface), { flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: 'rgba(34,197,94,0.4)' }]}>
            <CheckCircle2 size={18} color="#22c55e" />
            <Text style={{ color: '#22c55e', fontSize: 12, fontWeight: '700', flex: 1 }}>
              Strand deployed! It's live on THE WEB feed now.
            </Text>
          </View>
        )}

        <Text style={{ color: '#3f3f46', fontSize: 10, textAlign: 'center', lineHeight: 15 }}>
          Trims, filters, thumbnails and audio grafting live in the desktop Video Studio.
        </Text>
      </ScrollView>
    </SafeAreaView>
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
  marginBottom: 8,
};
