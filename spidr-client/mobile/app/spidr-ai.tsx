import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Sparkles,
  Server as ServerIcon,
  User as UserIcon,
  MessageCircle,
  Settings as SettingsIcon,
  Wand2,
  Palette,
  Check,
  RotateCcw,
  X as XIcon,
  Plus,
  Send,
  Trash2,
} from 'lucide-react-native';
import { entities, integrations } from '../lib/apiClient';
import { useAppShell } from '../lib/appShellContext';
import { AI_PERSONALITIES, getPersonality } from '../lib/roguePersonalities';

// ── Spidr AI (mobile) — small-screen twin of the web AIPanel ─────────────────
// Same four tabs (Server / Profile / Chat / Settings), same LLM calls through
// /ai/invoke, same AIConversation + AIChatLog persistence. Web-only bits
// (ContentScanner safe-mode modal, framer-motion) are simplified: safe mode
// remains a settings toggle honored by the preamble, animations are omitted.

type TabKey = 'server' | 'profile' | 'chat' | 'settings';

const TABS: { id: TabKey; Icon: any; label: string }[] = [
  { id: 'server', Icon: ServerIcon, label: 'Server' },
  { id: 'profile', Icon: UserIcon, label: 'Profile' },
  { id: 'chat', Icon: MessageCircle, label: 'Chat' },
  { id: 'settings', Icon: SettingsIcon, label: 'Settings' },
];

// AsyncStorage-backed AI preferences (web uses localStorage with same keys).
const PREF_KEYS = {
  persona: 'spidr_ai_persona',
  personality: 'spidr_ai_personality',
  verbosity: 'spidr_ai_verbosity',
  tone: 'spidr_ai_tone',
  rememberChat: 'spidr_ai_remember_chat',
  safeMode: 'spidr_ai_safe_mode',
};

async function getAIPreferences() {
  try {
    const [persona, personality, verbosity, tone, remember, safe] = await Promise.all([
      AsyncStorage.getItem(PREF_KEYS.persona),
      AsyncStorage.getItem(PREF_KEYS.personality),
      AsyncStorage.getItem(PREF_KEYS.verbosity),
      AsyncStorage.getItem(PREF_KEYS.tone),
      AsyncStorage.getItem(PREF_KEYS.rememberChat),
      AsyncStorage.getItem(PREF_KEYS.safeMode),
    ]);
    return {
      persona: persona || '',
      personality: personality || 'standard',
      verbosity: verbosity || 'normal',
      tone: tone || 'neutral',
      rememberChat: remember !== 'false',
      safeMode: safe !== 'false',
    };
  } catch {
    return { persona: '', personality: 'standard', verbosity: 'normal', tone: 'neutral', rememberChat: true, safeMode: true };
  }
}

export default function SpidrAI() {
  const router = useRouter();
  const { currentUser } = useAppShell();
  const [tab, setTab] = useState<TabKey>('server');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#111111' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
          gap: 10,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#a1a1aa" size={20} />
        </TouchableOpacity>
        <Image source={require('../assets/logo.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
        <View>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Spidr AI</Text>
          <Text style={{ color: '#71717a', fontSize: 10 }}>Your intelligent assistant</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={{ alignItems: 'center', marginBottom: 22 }}>
            <Image source={require('../assets/logo.png')} style={{ width: 72, height: 72, marginBottom: 12 }} resizeMode="contain" />
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>
              Welcome to <Text style={{ color: '#ef4444' }}>Spidr AI</Text>
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
              Create servers, customize profiles, and more with AI assistance
            </Text>
          </View>

          {/* Tab bar — icons only, like the web's small-screen collapse */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#18181b',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
              borderRadius: 10,
              padding: 4,
              marginBottom: 18,
            }}
          >
            {TABS.map(({ id, Icon }) => {
              const active = tab === id;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setTab(id)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 9,
                    borderRadius: 7,
                    backgroundColor: active ? '#dc2626' : 'transparent',
                  }}
                >
                  <Icon size={16} color={active ? '#fff' : '#a1a1aa'} />
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === 'server' && <ServerTab currentUser={currentUser} />}
          {tab === 'profile' && <ProfileTab currentUser={currentUser} />}
          {tab === 'chat' && <ChatTab currentUser={currentUser} />}
          {tab === 'settings' && <AISettingsTab />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function Card({ Icon, title, children }: { Icon: any; title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(24,24,27,0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 18,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon size={17} color="#f87171" />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const inputStyle = {
  backgroundColor: '#27272a',
  borderWidth: 1,
  borderColor: '#3f3f46',
  borderRadius: 10,
  color: '#fff',
  fontSize: 13,
  padding: 12,
  textAlignVertical: 'top' as const,
};

function GenerateBtn({ onPress, loading, disabled, label }: { onPress: () => void; loading: boolean; disabled?: boolean; label: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading || disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: '#dc2626',
        opacity: loading || disabled ? 0.4 : 1,
        marginTop: 14,
      }}
    >
      {loading ? <ActivityIndicator size="small" color="#fff" /> : <Sparkles size={15} color="#fff" />}
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{loading ? 'Generating…' : label}</Text>
    </TouchableOpacity>
  );
}

function ResultActions({
  onAccept, acceptLabel, accepting, onRetry, onDismiss,
}: { onAccept: () => void; acceptLabel: string; accepting: boolean; onRetry: () => void; onDismiss?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
      <TouchableOpacity
        onPress={onAccept}
        disabled={accepting}
        style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          paddingVertical: 10, borderRadius: 10, backgroundColor: '#16a34a', opacity: accepting ? 0.5 : 1,
        }}
      >
        {accepting ? <ActivityIndicator size="small" color="#fff" /> : <Check size={15} color="#fff" />}
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{acceptLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onRetry}
        style={{ paddingHorizontal: 13, justifyContent: 'center', borderRadius: 10, backgroundColor: '#3f3f46' }}
      >
        <RotateCcw size={15} color="#fff" />
      </TouchableOpacity>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          style={{ paddingHorizontal: 13, justifyContent: 'center', borderRadius: 10, backgroundColor: '#3f3f46' }}
        >
          <XIcon size={15} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Server tab ───────────────────────────────────────────────────────────────
function ServerTab({ currentUser }: { currentUser: any }) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const createMut = useMutation({
    mutationFn: (data: any) => entities.Server.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      Alert.alert('Server created!', 'Find it in your Servers tab.');
      setResult(null);
      setPrompt('');
    },
    onError: (err: any) => Alert.alert('Could not create server', err?.message || 'Try again.'),
  });

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const data: any = await integrations.Core.InvokeLLM({
        prompt: `Create a Discord-like server based on: "${prompt}". Return JSON with: name (string), description (string), theme_color (hex), channels (array of {id, name, type: "text"|"voice"}).`,
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            theme_color: { type: 'string' },
            channels: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' } } } },
          },
        },
      });
      setResult({
        ...data,
        owner_id: currentUser?.id,
        members: [{
          user_id: currentUser?.id,
          user_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
          user_avatar: currentUser?.avatar_url || '',
          role: 'admin',
        }],
      });
    } catch {
      Alert.alert('Generation failed', 'Check the AI configuration on the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card Icon={Wand2} title="AI Server Generator">
      <Text style={{ color: '#d4d4d8', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Describe your server</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="E.g., A gaming community for retro game enthusiasts, focusing on 80s and 90s arcade games..."
        placeholderTextColor="#52525b"
        multiline
        style={[inputStyle, { minHeight: 76 }]}
      />
      <GenerateBtn onPress={generate} loading={loading} disabled={!prompt.trim()} label="Generate Server" />

      {result && (
        <View
          style={{
            backgroundColor: '#27272a',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(127,29,29,0.4)',
            padding: 14,
            marginTop: 14,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: result.theme_color || '#dc2626',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>{result.name?.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{result.name}</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 11 }} numberOfLines={2}>{result.description}</Text>
            </View>
          </View>
          <View>
            <Text style={{ color: '#71717a', fontSize: 9, letterSpacing: 1.5, fontWeight: '800', marginBottom: 6 }}>CHANNELS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {(result.channels || []).map((ch: any, i: number) => (
                <View key={i} style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#18181b', borderRadius: 6 }}>
                  <Text style={{ color: '#d4d4d8', fontSize: 11 }}>
                    {ch.type === 'voice' ? '🔊' : '#'} {ch.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <ResultActions
            onAccept={() => createMut.mutate(result)}
            acceptLabel="Create Server"
            accepting={createMut.isPending}
            onRetry={generate}
            onDismiss={() => setResult(null)}
          />
        </View>
      )}
    </Card>
  );
}

// ── Profile tab ──────────────────────────────────────────────────────────────
function ProfileTab({ currentUser }: { currentUser: any }) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const applyMut = useMutation({
    mutationFn: async (data: any) => {
      const profiles: any = await entities.UserProfile.filter({ user_id: currentUser?.id });
      if (profiles[0]) return entities.UserProfile.update(profiles[0].id, data);
      return entities.UserProfile.create({ ...data, user_id: currentUser?.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-row'] });
      queryClient.invalidateQueries({ queryKey: ['profile-of'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      Alert.alert('Profile updated!', 'Check it out in Settings → My Profile.');
      setSuggestions(null);
      setPrompt('');
    },
    onError: (err: any) => Alert.alert('Could not apply', err?.message || 'Try again.'),
  });

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const data = await integrations.Core.InvokeLLM({
        prompt: `Generate a full Spidr profile customization for: "${prompt}".
Return JSON with these fields. Pick values that match the requested vibe:
- display_name: short, memorable (max 25 chars)
- bio: 1-2 sentence personality bio
- custom_status: short status line (max 30 chars)
- accent_color: hex color (e.g. "#22d3ee")
- profile_gradient: pick ONE of "neon", "sunset", "ocean", "cyber", "blood", "void", or "" for none
- username_font: pick ONE of "default", "serif", "mono", "display", "handwriting", "rounded"
- username_weight: pick ONE of "normal", "medium", "bold", "black"
- username_style: pick "normal" or "italic"
- username_color: hex color (often same as accent_color, can differ)
- username_effect: pick ONE of "none", "glow", "gradient", "rainbow", "pulse", "shimmer"

Be tasteful — don't combine wild colors with wild effects unless the prompt explicitly asks for it.`,
        response_json_schema: {
          type: 'object',
          properties: {
            display_name: { type: 'string' },
            bio: { type: 'string' },
            custom_status: { type: 'string' },
            accent_color: { type: 'string' },
            profile_gradient: { type: 'string' },
            username_font: { type: 'string' },
            username_weight: { type: 'string' },
            username_style: { type: 'string' },
            username_color: { type: 'string' },
            username_effect: { type: 'string' },
          },
        },
      });
      setSuggestions(data);
    } catch {
      Alert.alert('Generation failed', 'Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card Icon={Palette} title="AI Profile Customizer">
      <Text style={{ color: '#d4d4d8', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Describe your vibe</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="E.g., I'm a cyberpunk aesthetic enthusiast who loves neon colors and futuristic themes..."
        placeholderTextColor="#52525b"
        multiline
        style={[inputStyle, { minHeight: 76 }]}
      />
      <GenerateBtn onPress={generate} loading={loading} disabled={!prompt.trim()} label="Generate Suggestions" />

      {suggestions && (
        <View
          style={{
            backgroundColor: '#27272a',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: 'rgba(127,29,29,0.4)',
            padding: 14,
            marginTop: 14,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
                backgroundColor: suggestions.accent_color || '#dc2626',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800' }}>
                {suggestions.display_name?.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: suggestions.username_color || suggestions.accent_color || '#fff',
                  fontSize: 15,
                  fontWeight: suggestions.username_weight === 'black' ? '900' : suggestions.username_weight === 'bold' ? '700' : suggestions.username_weight === 'medium' ? '500' : '400',
                  fontStyle: suggestions.username_style === 'italic' ? 'italic' : 'normal',
                }}
                numberOfLines={1}
              >
                {suggestions.display_name}
              </Text>
              <Text style={{ color: '#a1a1aa', fontSize: 11 }} numberOfLines={1}>{suggestions.custom_status}</Text>
            </View>
          </View>
          <Text style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 19 }}>{suggestions.bio}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.username_effect && suggestions.username_effect !== 'none' && (
              <Chip label={`effect: ${suggestions.username_effect}`} />
            )}
            {suggestions.username_font && suggestions.username_font !== 'default' && (
              <Chip label={`font: ${suggestions.username_font}`} />
            )}
            {!!suggestions.profile_gradient && <Chip label={`theme: ${suggestions.profile_gradient}`} />}
            {!!suggestions.accent_color && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: suggestions.accent_color }}>
                <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'monospace' }}>{suggestions.accent_color}</Text>
              </View>
            )}
          </View>
          <ResultActions
            onAccept={() => applyMut.mutate(suggestions)}
            acceptLabel="Apply to Profile"
            accepting={applyMut.isPending}
            onRetry={generate}
          />
          <Text style={{ color: '#52525b', fontSize: 10, lineHeight: 14 }}>
            Note: avatar and banner images aren't generated here — edit those from Settings → My Profile.
          </Text>
        </View>
      )}
    </Card>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#3f3f46' }}>
      <Text style={{ color: '#d4d4d8', fontSize: 10 }}>{label}</Text>
    </View>
  );
}

// ── Chat tab ─────────────────────────────────────────────────────────────────
interface ChatMsg { role: 'user' | 'assistant'; content: string }

function ChatTab({ currentUser }: { currentUser: any }) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [aiMode, setAiMode] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEYS.personality).then((v) => v && setAiMode(v));
  }, []);

  const { data: conversations = [] } = useQuery({
    queryKey: ['ai-conversations', currentUser?.id],
    queryFn: () => entities.AIConversation.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
  });

  const { data: chatLogs = [] } = useQuery({
    queryKey: ['ai-chat-logs', selectedConvId],
    queryFn: () => entities.AIChatLog.filter({ conversation_id: selectedConvId, user_id: currentUser?.id }),
    enabled: !!selectedConvId && !!currentUser?.id,
  });

  useEffect(() => {
    if ((chatLogs as any[]).length > 0) {
      setMessages((chatLogs as any[]).map((l) => ({ role: l.role, content: l.content })));
    } else if (selectedConvId) {
      setMessages([{ role: 'assistant', content: "Hey there! 🕷️ I'm Spidr AI. Ask me anything — servers, Spidr features, or just chat!" }]);
    }
  }, [chatLogs, selectedConvId]);

  useEffect(() => {
    if ((conversations as any[]).length > 0 && !selectedConvId) {
      setSelectedConvId((conversations as any[])[0].id);
    }
  }, [conversations, selectedConvId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages, loading]);

  const createConvMut = useMutation({
    mutationFn: () => entities.AIConversation.create({ user_id: currentUser?.id, title: 'New Chat', last_message: '' }),
    onSuccess: (conv: any) => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      setSelectedConvId(conv.id);
      setMessages([{ role: 'assistant', content: "Hey there! 🕷️ I'm Spidr AI. Ask me anything!" }]);
    },
  });

  const deleteConv = (convId: string) =>
    Alert.alert('Delete this chat?', 'Its history will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const logs: any = await entities.AIChatLog.filter({ conversation_id: convId });
            await Promise.all((logs as any[]).map((l) => entities.AIChatLog.delete(l.id).catch(() => {})));
          } catch { /* non-fatal */ }
          try {
            await entities.AIConversation.delete(convId);
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            if (selectedConvId === convId) {
              const remaining = (conversations as any[]).filter((c) => c.id !== convId);
              setSelectedConvId(remaining[0]?.id || null);
            }
          } catch (err: any) {
            Alert.alert('Could not delete chat', err?.message || 'Try again.');
          }
        },
      },
    ]);

  const handleSend = async () => {
    if (!input.trim() || loading || !selectedConvId) return;
    const text = input.trim();
    const prefs = await getAIPreferences();

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    if (prefs.rememberChat) {
      entities.AIChatLog.create({ user_id: currentUser?.id, conversation_id: selectedConvId, role: 'user', content: text }).catch(() => {});
      const conv = (conversations as any[]).find((c) => c.id === selectedConvId);
      if (conv?.title === 'New Chat') {
        entities.AIConversation.update(selectedConvId, { title: text.slice(0, 50), last_message: text.slice(0, 100) })
          .then(() => queryClient.invalidateQueries({ queryKey: ['ai-conversations'] }))
          .catch(() => {});
      }
    }

    const verbosityHint =
      prefs.verbosity === 'concise' ? 'Keep responses under 80 words. Be direct and skip filler.'
      : prefs.verbosity === 'detailed' ? 'Provide thorough, detailed explanations. Use examples when helpful.'
      : 'Keep responses under 200 words unless detail is truly needed.';
    const toneHint =
      prefs.tone === 'playful' ? 'Use a playful, casual tone with light humor.'
      : prefs.tone === 'professional' ? 'Maintain a professional, formal tone.'
      : 'Use a neutral, friendly tone.';
    const personaLine = prefs.persona?.trim() ? `Persona instruction from the user: ${prefs.persona.trim()}\n\n` : '';
    const activePersonality = getPersonality(aiMode);
    const personalityLine = activePersonality.id !== 'standard'
      ? `Active personality mode — ${activePersonality.name}: ${activePersonality.prompt}\n\n`
      : '';
    const safeLine = prefs.safeMode
      ? 'Safe mode is ON: refuse unsafe, explicit, or harmful requests politely.\n'
      : '';
    const systemPreamble = `You are Spidr AI — a helpful assistant in a gaming/Discord-like app called Spidr.\n${safeLine}${personalityLine}${personaLine}${verbosityHint} ${toneHint} You may occasionally use spider/web metaphors.`;

    try {
      const reply = await integrations.Core.InvokeLLM({ prompt: `${systemPreamble}\n\nUser: ${text}` });
      const replyText = typeof reply === 'string' ? reply : JSON.stringify(reply);
      setMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
      if (prefs.rememberChat) {
        entities.AIChatLog.create({ user_id: currentUser?.id, conversation_id: selectedConvId, role: 'assistant', content: replyText }).catch(() => {});
        entities.AIConversation.update(selectedConvId, { last_message: replyText.slice(0, 100) }).catch(() => {});
      }
    } catch {
      Alert.alert('Spidr AI is temporarily unavailable', 'Try again in a moment.');
    }
    setLoading(false);
  };

  // Catch Me Up — recap of recent DMs + group messages (web parity).
  const catchMeUp = async () => {
    if (loading || !selectedConvId) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: '⚡ Catch me up on what I missed.' }]);
    try {
      let dms: any[] = [];
      let groupMsgs: any[] = [];
      try { dms = (await entities.DirectMessage.list('-created_date', 30)) as any[]; } catch {}
      try { groupMsgs = (await entities.GroupChatMessage.list('-created_date', 30)) as any[]; } catch {}

      const lines: string[] = [];
      for (const m of dms) {
        if (m.content) lines.push(`DM from ${m.sender_name || m.user_name || 'someone'}: ${String(m.content).slice(0, 140)}`);
      }
      for (const m of groupMsgs) {
        if (m.content) lines.push(`Group (${m.group_id?.slice(0, 6) || '—'}) ${m.user_name || m.sender_name || 'someone'}: ${String(m.content).slice(0, 140)}`);
      }

      if (lines.length === 0) {
        setMessages((prev) => [...prev, { role: 'assistant', content: "You're all caught up — no recent activity to summarize. 🕸️" }]);
        setLoading(false);
        return;
      }

      const activePersonality = getPersonality(aiMode);
      const personalityLine = activePersonality.id !== 'standard'
        ? `Respond in your ${activePersonality.name} personality: ${activePersonality.prompt}\n`
        : '';
      const prompt = `You are Spidr AI. ${personalityLine}Summarize the following recent activity for the user as a short, scannable recap. Group by conversation where possible, highlight anything that seems to need a reply, and keep it under 150 words. Use short bullet points.\n\nRecent activity (newest first):\n${lines.slice(0, 40).join('\n')}`;

      const reply = await integrations.Core.InvokeLLM({ prompt });
      const replyText = typeof reply === 'string' ? reply : JSON.stringify(reply);
      setMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
    } catch {
      Alert.alert('Could not generate a recap right now.');
    }
    setLoading(false);
  };

  return (
    <View
      style={{
        backgroundColor: 'rgba(24,24,27,0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 460,
      }}
    >
      {/* Conversation strip — horizontal on mobile, like the web's collapse */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', padding: 10, gap: 8 }}>
        <TouchableOpacity
          onPress={() => createConvMut.mutate()}
          disabled={createConvMut.isPending}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            paddingVertical: 9, borderRadius: 10, backgroundColor: '#dc2626',
            opacity: createConvMut.isPending ? 0.5 : 1,
          }}
        >
          <Plus size={14} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>New Chat</Text>
        </TouchableOpacity>
        {(conversations as any[]).length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(conversations as any[]).map((conv) => {
              const active = selectedConvId === conv.id;
              return (
                <TouchableOpacity
                  key={conv.id}
                  onPress={() => setSelectedConvId(conv.id)}
                  onLongPress={() => deleteConv(conv.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    maxWidth: 180,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 10,
                    backgroundColor: active ? '#dc2626' : '#27272a',
                  }}
                >
                  <Text style={{ color: active ? '#fff' : '#a1a1aa', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                    {conv.title}
                  </Text>
                  {active && (
                    <TouchableOpacity onPress={() => deleteConv(conv.id)} hitSlop={6}>
                      <Trash2 size={11} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {!selectedConvId ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <Image source={require('../assets/logo.png')} style={{ width: 56, height: 56 }} resizeMode="contain" />
          <Text style={{ color: '#a1a1aa', fontSize: 13 }}>Start a new chat with Spidr AI</Text>
        </View>
      ) : (
        <>
          {/* Messages — fixed-height inner scroll so the outer page still scrolls */}
          <ScrollView
            ref={scrollRef}
            style={{ height: 300 }}
            contentContainerStyle={{ padding: 12, gap: 12 }}
            nestedScrollEnabled
          >
            {messages.map((msg, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 8,
                }}
              >
                {msg.role === 'assistant' && (
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}>
                    <Image source={require('../assets/logo.png')} style={{ width: 16, height: 16 }} resizeMode="contain" />
                  </View>
                )}
                <View
                  style={{
                    maxWidth: '78%',
                    borderRadius: 16,
                    borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                    borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16,
                    paddingHorizontal: 13,
                    paddingVertical: 9,
                    backgroundColor: msg.role === 'user' ? '#dc2626' : '#27272a',
                    borderWidth: msg.role === 'assistant' ? 1 : 0,
                    borderColor: 'rgba(255,255,255,0.05)',
                  }}
                >
                  <Text style={{ color: msg.role === 'user' ? '#fff' : '#e4e4e7', fontSize: 13, lineHeight: 19 }}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))}
            {loading && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
                <View style={{ backgroundColor: '#27272a', borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 11 }}>
                  <Text style={{ color: '#a1a1aa', fontSize: 12 }}>Spidr AI is thinking…</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Personality strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 8, gap: 6, alignItems: 'center' }}
          >
            <TouchableOpacity
              onPress={catchMeUp}
              disabled={loading}
              style={{
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                backgroundColor: 'rgba(255,51,51,0.25)', borderWidth: 1, borderColor: 'rgba(255,51,51,0.5)',
                opacity: loading ? 0.5 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>⚡ Catch Me Up</Text>
            </TouchableOpacity>
            <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            {AI_PERSONALITIES.map((p) => {
              const active = aiMode === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    setAiMode(p.id);
                    AsyncStorage.setItem(PREF_KEYS.personality, p.id).catch(() => {});
                  }}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                    backgroundColor: active ? 'rgba(255,51,51,0.2)' : 'rgba(39,39,42,0.6)',
                    borderWidth: 1, borderColor: active ? 'rgba(255,51,51,0.6)' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <Text style={{ color: active ? '#fff' : '#a1a1aa', fontSize: 11, fontWeight: '700' }}>
                    {p.emoji} {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Input bar */}
          <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, backgroundColor: '#27272a', borderRadius: 12, padding: 6, alignItems: 'center' }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask Spidr AI anything…"
                placeholderTextColor="#52525b"
                onSubmitEditing={handleSend}
                style={{ flex: 1, color: '#fff', fontSize: 13, paddingHorizontal: 8, paddingVertical: 6 }}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  width: 32, height: 32, borderRadius: 8, backgroundColor: '#dc2626',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: loading || !input.trim() ? 0.4 : 1,
                }}
              >
                <Send size={14} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#52525b', fontSize: 9, textAlign: 'center', marginTop: 6 }}>
              Spidr AI — powered by your configured LLM · long-press a chat to delete it
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────────────
function AISettingsTab() {
  const [persona, setPersona] = useState('');
  const [verbosity, setVerbosity] = useState('normal');
  const [tone, setTone] = useState('neutral');
  const [rememberChat, setRememberChat] = useState(true);
  const [safeMode, setSafeMode] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    getAIPreferences().then((p) => {
      setPersona(p.persona);
      setVerbosity(p.verbosity);
      setTone(p.tone);
      setRememberChat(p.rememberChat);
      setSafeMode(p.safeMode);
      setHydrated(true);
    });
  }, []);

  // Persist on change (after hydration so we don't clobber saved values).
  useEffect(() => { if (hydrated) AsyncStorage.setItem(PREF_KEYS.persona, persona).catch(() => {}); }, [persona, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(PREF_KEYS.verbosity, verbosity).catch(() => {}); }, [verbosity, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(PREF_KEYS.tone, tone).catch(() => {}); }, [tone, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(PREF_KEYS.rememberChat, String(rememberChat)).catch(() => {}); }, [rememberChat, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(PREF_KEYS.safeMode, String(safeMode)).catch(() => {}); }, [safeMode, hydrated]);

  const reset = () => {
    setPersona('');
    setVerbosity('normal');
    setTone('neutral');
    setRememberChat(true);
    setSafeMode(true);
    Alert.alert('Reset', 'AI settings restored to defaults.');
  };

  const optionRow = (
    options: { id: string; label: string; desc?: string }[],
    value: string,
    onSelect: (id: string) => void,
  ) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: active ? '#ef4444' : '#3f3f46',
              backgroundColor: active ? 'rgba(239,68,68,0.1)' : 'rgba(39,39,42,0.5)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{opt.label}</Text>
            {!!opt.desc && <Text style={{ color: '#71717a', fontSize: 9, marginTop: 2 }}>{opt.desc}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Card Icon={SettingsIcon} title="Spidr AI Settings">
      <View style={{ gap: 18 }}>
        <View>
          <Text style={{ color: '#d4d4d8', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Persona (optional)</Text>
          <TextInput
            value={persona}
            onChangeText={(v) => setPersona(v.slice(0, 500))}
            placeholder="E.g., Speak like a sarcastic hacker friend who loves '80s sci-fi."
            placeholderTextColor="#52525b"
            multiline
            style={[inputStyle, { minHeight: 70 }]}
          />
          <Text style={{ color: '#52525b', fontSize: 9, marginTop: 4 }}>{persona.length}/500 — prepended to every AI prompt.</Text>
        </View>

        <View>
          <Text style={{ color: '#d4d4d8', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Response length</Text>
          {optionRow(
            [
              { id: 'concise', label: 'Concise', desc: 'Short and direct' },
              { id: 'normal', label: 'Normal', desc: 'Balanced' },
              { id: 'detailed', label: 'Detailed', desc: 'Long explanations' },
            ],
            verbosity,
            setVerbosity,
          )}
        </View>

        <View>
          <Text style={{ color: '#d4d4d8', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>Tone</Text>
          {optionRow(
            [
              { id: 'neutral', label: 'Neutral' },
              { id: 'playful', label: 'Playful' },
              { id: 'professional', label: 'Pro' },
            ],
            tone,
            setTone,
          )}
        </View>

        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Remember conversations</Text>
              <Text style={{ color: '#71717a', fontSize: 10, marginTop: 2 }}>
                Save your AI chat history so you can revisit it.
              </Text>
            </View>
            <Switch
              value={rememberChat}
              onValueChange={setRememberChat}
              trackColor={{ false: '#3f3f46', true: '#dc2626' }}
              thumbColor="#fff"
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Safe mode</Text>
              <Text style={{ color: '#71717a', fontSize: 10, marginTop: 2 }}>
                Extra content filtering on prompts and responses. Recommended.
              </Text>
            </View>
            <Switch
              value={safeMode}
              onValueChange={setSafeMode}
              trackColor={{ false: '#3f3f46', true: '#dc2626' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={reset}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            paddingVertical: 9, borderRadius: 10, backgroundColor: '#27272a',
          }}
        >
          <RotateCcw size={12} color="#a1a1aa" />
          <Text style={{ color: '#a1a1aa', fontSize: 11, fontWeight: '700' }}>Reset to Defaults</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}
