import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Text, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Send, ImagePlus, Smile, Mic, Ghost, X as XIcon, Trash2 } from 'lucide-react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { EmojiGifPicker, EmojiSelection } from './EmojiGifPicker';
import { pickAndUpload } from '../../lib/imageUpload';
import { integrations } from '../../lib/apiClient';

// Format seconds → `M:SS`
function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function MessageInput({
  onSend,
  disabled,
  placeholder,
  ghostMode = false,
  onGhostToggle,
}: {
  // attachments are URL arrays — same storage shape the web writes
  // (MessageInputBar → attachments.map(att => att.url)).
  onSend: (text: string, attachments?: string[]) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  ghostMode?: boolean;
  onGhostToggle?: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Voice-note recorder — expo-audio hook. HIGH_QUALITY preset yields m4a
  // on iOS / mp4 on Android; both play in the existing AudioPlayer.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const secTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!recording) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const startRecording = async () => {
    if (busy || recording) return;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Grant microphone access in Settings to record voice notes.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setSeconds(0);
      setRecording(true);
      secTimer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      Alert.alert('Could not record', err?.message || 'Try again.');
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (secTimer.current) { clearInterval(secTimer.current); secTimer.current = null; }
    try {
      await recorder.stop();
    } catch { /* stop can throw if already stopped; ignore */ }
    setRecording(false);
    // recorder.uri holds the local file:// after stop
    return (recorder as any).uri || null;
  };

  const cancelRecording = async () => {
    await stopRecording();
    setSeconds(0);
  };

  const sendRecording = async () => {
    const uri = await stopRecording();
    if (!uri) return;
    setBusy(true);
    try {
      // Name must include `voice-message-` OR a common audio extension so
      // MessageBubble's isAudioUrl() classifies it correctly on both ends.
      const ext = uri.match(/\.(m4a|mp4|wav|aac|caf)$/i)?.[1]?.toLowerCase() || 'm4a';
      const name = `voice-message-${Date.now()}.${ext}`;
      const type = ext === 'm4a' || ext === 'aac' ? 'audio/m4a' : `audio/${ext}`;
      const res: any = await integrations.Core.UploadFile({ file: { uri, name, type } as any });
      if (res?.url) {
        await onSend('', [res.url]);
      } else {
        Alert.alert('Voice note failed', 'Upload did not return a URL.');
      }
    } catch (err: any) {
      Alert.alert('Voice note failed', err?.message || 'Try again.');
    } finally {
      setBusy(false);
      setSeconds(0);
    }
  };

  const addAttachment = async () => {
    if (uploading || busy) return;
    setUploading(true);
    try {
      const url = await pickAndUpload({ videos: true });
      if (url) setAttachments((prev) => [...prev, url]);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || busy) return;
    setBusy(true);
    try {
      await onSend(trimmed, attachments.length ? attachments : undefined);
      setText('');
      setAttachments([]);
    } finally {
      setBusy(false);
    }
  };

  const handleEmoji = (e: EmojiSelection) => {
    setText((t) => t + (e.type === 'custom' ? `:${e.name}:` : e.emoji));
  };

  const handleGif = async (url: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await onSend('', [url]);
    } finally {
      setBusy(false);
    }
  };

  const stub = (label: string) =>
    Alert.alert('Coming soon', `${label} from mobile is landing in a follow-up patch.`);

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 8,
        paddingBottom: 14,
        backgroundColor: '#0a0a0a',
        borderTopWidth: 1,
        borderTopColor: recording ? 'rgba(239,68,68,0.6)' : ghostMode ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Attachment previews */}
      {!recording && attachments.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {attachments.map((url, i) => (
            <View key={`${url}-${i}`} style={{ position: 'relative' }}>
              <Image
                source={{ uri: url }}
                style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#18181b' }}
                contentFit="cover"
              />
              <TouchableOpacity
                onPress={() => removeAttachment(i)}
                hitSlop={6}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9,
                  backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <XIcon size={10} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {recording ? (
        // ── Recording bar: replaces the composer while capturing audio ────
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={cancelRecording} style={{ padding: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' }} hitSlop={6}>
            <Trash2 size={18} color="#a1a1aa" />
          </TouchableOpacity>
          <View style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 999,
            paddingHorizontal: 14, paddingVertical: 10,
            borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
          }}>
            <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', opacity: pulse }} />
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }}>
              REC {fmt(seconds)}
            </Text>
            <Text style={{ color: '#71717a', fontSize: 11, flex: 1, textAlign: 'right' }} numberOfLines={1}>
              Tap trash to cancel
            </Text>
          </View>
          <TouchableOpacity
            onPress={sendRecording}
            disabled={busy}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Send color="#fff" size={18} />}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Leading icons */}
          <TouchableOpacity onPress={addAttachment} disabled={uploading} style={{ padding: 6 }} hitSlop={6}>
            {uploading ? <ActivityIndicator size="small" color="#71717a" /> : <ImagePlus size={20} color="#71717a" />}
          </TouchableOpacity>
          <TouchableOpacity onPress={onGhostToggle || (() => stub('Ghost mode'))} style={{ padding: 6 }} hitSlop={6}>
            <Ghost size={20} color={ghostMode ? '#a855f7' : '#71717a'} />
          </TouchableOpacity>

          {/* Input */}
          <View
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#1a1a1a', borderRadius: 999, paddingHorizontal: 14,
              minHeight: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={placeholder || 'Message...'}
              placeholderTextColor="#52525b"
              multiline
              editable={!disabled && !busy}
              style={{ flex: 1, color: '#fff', fontSize: 14, maxHeight: 120, paddingVertical: 8 }}
            />
            <TouchableOpacity onPress={() => setPickerOpen(true)} style={{ paddingHorizontal: 4 }} hitSlop={6}>
              <Smile size={18} color={pickerOpen ? '#FF3333' : '#71717a'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={startRecording} style={{ paddingHorizontal: 4 }} hitSlop={6}>
              <Mic size={18} color="#71717a" />
            </TouchableOpacity>
          </View>

          {/* Send */}
          <TouchableOpacity
            onPress={submit}
            disabled={(!text.trim() && attachments.length === 0) || busy}
            style={{
              backgroundColor: text.trim() || attachments.length ? (ghostMode ? '#a855f7' : '#dc2626') : '#3f3f46',
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
            }}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Send color="#fff" size={18} />}
          </TouchableOpacity>
        </View>
      )}

      {/* Emoji + GIF sheet */}
      <EmojiGifPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onEmojiSelect={handleEmoji}
        onGifSelect={handleGif}
      />
    </View>
  );
}
