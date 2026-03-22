import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { entities, integrations } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Server, User, Bot, Send, MessageCircle,
  Plus, Loader2, Wand2, Palette, Check, RotateCcw, X
} from 'lucide-react';
import { toast } from 'sonner';
import SpiderLogo from './SpiderLogo';
import { scanPrompt } from './ContentScanner';
import ContentBlockedModal from './ContentBlockedModal';

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'server',  Icon: Server,        label: 'Server'  },
  { id: 'profile', Icon: User,          label: 'Profile' },
  { id: 'bot',     Icon: Bot,           label: 'Bot'     },
  { id: 'chat',    Icon: MessageCircle, label: 'Chat'    },
];

// ── Root Panel ────────────────────────────────────────────────────────────────
export default function AIPanel({ currentUser }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('server');
  return (
    <div className="flex-1 flex flex-col bg-[#111111] overflow-hidden">
      {/* Top bar */}
      <div className="h-12 border-b border-white/5 flex items-center px-5 gap-3 flex-shrink-0">
        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
          <SpiderLogo size={28} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">Spidr AI</p>
          <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Your intelligent assistant</p>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* Hero */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 w-20 h-20 flex items-center justify-center">
              <SpiderLogo size={80} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome to <span className="text-red-500">Spidr AI</span>
            </h1>
            <p className="text-zinc-400 text-sm">
              Create servers, customize profiles, and more with AI assistance
            </p>
          </div>

          {/* Tab bar — matches screenshot exactly */}
          <div className="flex rounded-lg bg-zinc-900 border border-white/5 p-1 mb-6">
            {TABS.map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all
                  ${activeTab === id
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === 'server'  && <ServerTab  currentUser={currentUser} queryClient={queryClient} />}
              {activeTab === 'profile' && <ProfileTab currentUser={currentUser} queryClient={queryClient} />}
              {activeTab === 'bot'     && <BotTab     currentUser={currentUser} queryClient={queryClient} />}
              {activeTab === 'chat'    && <ChatTab    currentUser={currentUser} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Shared card wrapper ───────────────────────────────────────────────────────
function Card({ icon: Icon, title, children }) {
  return (
    <div className="bg-zinc-900/80 border border-white/5 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon className="w-5 h-5 text-red-400" />
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Shared generate button ────────────────────────────────────────────────────
function GenerateBtn({ onClick, loading, disabled, label }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold text-sm rounded-lg transition-colors"
    >
      {loading
        ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
        : <><Sparkles className="w-4 h-4" /> {label}</>
      }
    </button>
  );
}

// ── Server Tab ────────────────────────────────────────────────────────────────
function ServerTab({ currentUser, queryClient }) {
  const [prompt,  setPrompt]  = useState('');
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const createMut = useMutation({
    mutationFn: (data) => entities.Server.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['servers']);
      toast.success('Server created!');
      setResult(null);
      setPrompt('');
    },
  });

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const data = await integrations.Core.InvokeLLM({
        prompt: `Create a Discord-like server based on: "${prompt}". Return JSON with: name (string), description (string), theme_color (hex), channels (array of {id, name, type: "text"|"voice"}).`,
        response_json_schema: {
          type: 'object',
          properties: {
            name:        { type: 'string' },
            description: { type: 'string' },
            theme_color: { type: 'string' },
            channels:    { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' } } } },
          },
        },
      });
      setResult({
        ...data,
        owner_id: currentUser?.id,
        members: [{ user_id: currentUser?.id, user_name: currentUser?.full_name || currentUser?.email, user_avatar: currentUser?.avatar_url || '', role: 'admin' }],
      });
    } catch { toast.error('Generation failed — check AI config'); }
    finally  { setLoading(false); }
  };

  return (
    <Card icon={Wand2} title="AI Server Generator">
      <div className="space-y-4">
        <div>
          <Label className="text-zinc-300 text-xs mb-1.5 block">Describe your server</Label>
          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="E.g., A gaming community for retro game enthusiasts, focusing on 80s and 90s arcade games..."
            className="bg-zinc-800 border-zinc-700 text-white resize-none text-sm"
            rows={3}
          />
        </div>
        <GenerateBtn onClick={generate} loading={loading} disabled={!prompt.trim()} label="Generate Server" />

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-800 rounded-xl p-4 border border-red-900/30 space-y-3 overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: result.theme_color || '#dc2626' }}>
                  {result.name?.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{result.name}</p>
                  <p className="text-zinc-400 text-xs">{result.description}</p>
                </div>
              </div>
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1.5">Channels</p>
                <div className="flex flex-wrap gap-1.5">
                  {(result.channels || []).map((ch, i) => (
                    <span key={i} className="px-2 py-0.5 bg-zinc-900 rounded text-xs text-zinc-300">
                      {ch.type === 'voice' ? '🔊' : '#'} {ch.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => createMut.mutate(result)} disabled={createMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  <Check className="w-4 h-4" /> Create Server
                </button>
                <button onClick={generate}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={() => setResult(null)}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ currentUser, queryClient }) {
  const [prompt,      setPrompt]      = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [loading,     setLoading]     = useState(false);

  const applyMut = useMutation({
    mutationFn: async (data) => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      if (profiles[0]) return entities.UserProfile.update(profiles[0].id, data);
      return entities.UserProfile.create({ ...data, user_id: currentUser?.id });
    },
    onSuccess: () => { queryClient.invalidateQueries(['user-profile']); toast.success('Profile updated!'); setSuggestions(null); setPrompt(''); },
  });

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const data = await integrations.Core.InvokeLLM({
        prompt: `Generate profile customization for: "${prompt}". Return JSON with: display_name, bio (1-2 sentences), custom_status, accent_color (hex).`,
        response_json_schema: {
          type: 'object',
          properties: {
            display_name:  { type: 'string' },
            bio:           { type: 'string' },
            custom_status: { type: 'string' },
            accent_color:  { type: 'string' },
          },
        },
      });
      setSuggestions(data);
    } catch { toast.error('Generation failed'); }
    finally  { setLoading(false); }
  };

  return (
    <Card icon={Palette} title="AI Profile Customizer">
      <div className="space-y-4">
        <div>
          <Label className="text-zinc-300 text-xs mb-1.5 block">Describe your vibe</Label>
          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="E.g., I'm a cyberpunk aesthetic enthusiast who loves neon colors and futuristic themes..."
            className="bg-zinc-800 border-zinc-700 text-white resize-none text-sm"
            rows={3}
          />
        </div>
        <GenerateBtn onClick={generate} loading={loading} disabled={!prompt.trim()} label="Generate Suggestions" />

        <AnimatePresence>
          {suggestions && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-800 rounded-xl p-4 border border-red-900/30 space-y-3 overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                  style={{ backgroundColor: suggestions.accent_color || '#dc2626' }}>
                  {suggestions.display_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-semibold">{suggestions.display_name}</p>
                  <p className="text-zinc-400 text-xs">{suggestions.custom_status}</p>
                </div>
              </div>
              <p className="text-zinc-300 text-sm">{suggestions.bio}</p>
              <div className="flex gap-2">
                <button onClick={() => applyMut.mutate(suggestions)} disabled={applyMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  <Check className="w-4 h-4" /> Apply to Profile
                </button>
                <button onClick={generate}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

// ── Bot Tab ───────────────────────────────────────────────────────────────────
function BotTab({ currentUser, queryClient }) {
  const [prompt,  setPrompt]  = useState('');
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const saveMut = useMutation({
    mutationFn: (data) => entities.CustomBot.create({ ...data, owner_id: currentUser?.id }),
    onSuccess: () => { queryClient.invalidateQueries(['custom-bots']); toast.success('Bot saved!'); setResult(null); setPrompt(''); },
  });

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const data = await integrations.Core.InvokeLLM({
        prompt: `Create a chatbot for: "${prompt}". Return JSON with: name, description (2-3 sentences), personality, capabilities (string array of 3-5 items).`,
        response_json_schema: {
          type: 'object',
          properties: {
            name:         { type: 'string' },
            description:  { type: 'string' },
            personality:  { type: 'string' },
            capabilities: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      setResult(data);
    } catch { toast.error('Generation failed'); }
    finally  { setLoading(false); }
  };

  return (
    <Card icon={Bot} title="AI Bot Generator">
      <div className="space-y-4">
        <div>
          <Label className="text-zinc-300 text-xs mb-1.5 block">Describe your bot</Label>
          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="E.g., A helpful moderation bot that can ban spammers, manage roles, and send welcome messages..."
            className="bg-zinc-800 border-zinc-700 text-white resize-none text-sm"
            rows={3}
          />
        </div>
        <GenerateBtn onClick={generate} loading={loading} disabled={!prompt.trim()} label="Generate Bot" />

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-800 rounded-xl p-4 border border-red-900/30 space-y-3 overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">{result.name}</p>
                  <p className="text-zinc-400 text-xs">{result.personality}</p>
                </div>
              </div>
              <p className="text-zinc-300 text-sm">{result.description}</p>
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1.5">Capabilities</p>
                <div className="space-y-1">
                  {(result.capabilities || []).map((cap, i) => (
                    <div key={i} className="px-3 py-1.5 bg-zinc-900 rounded text-xs text-zinc-300">• {cap}</div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveMut.mutate(result)} disabled={saveMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  <Check className="w-4 h-4" /> Save Bot
                </button>
                <button onClick={generate}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

// ── Chat Tab — matches screenshot 2 exactly ───────────────────────────────────
function ChatTab({ currentUser }) {
  const [messages,       setMessages]       = useState([]);
  const [input,          setInput]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [blockedCat,     setBlockedCat]     = useState(null);
  const bottomRef = useRef(null);
  const { data: conversations = [] } = useQuery({
    queryKey: ['ai-conversations', currentUser?.id],
    queryFn:  () => entities.AIConversation.filter({ user_id: currentUser?.id }),
    enabled:  !!currentUser?.id,
  });

  const { data: chatLogs = [] } = useQuery({
    queryKey: ['ai-chat-logs', selectedConvId],
    queryFn:  () => entities.AIChatLog.filter({ conversation_id: selectedConvId, user_id: currentUser?.id }),
    enabled:  !!selectedConvId && !!currentUser?.id,
  });

  // Load messages from DB when conversation selected
  useEffect(() => {
    if (chatLogs.length > 0) {
      setMessages(chatLogs.map(l => ({ role: l.role, content: l.content })));
    } else if (selectedConvId) {
      setMessages([{ role: 'assistant', content: "Hey there! 🕷️ I'm Spidr AI. Ask me anything — servers, Spidr features, or just chat!" }]);
    }
  }, [chatLogs, selectedConvId]);

  // Auto-select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !selectedConvId) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const createConvMut = useMutation({
    mutationFn: () => entities.AIConversation.create({ user_id: currentUser?.id, title: 'New Chat', last_message: '' }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries(['ai-conversations']);
      setSelectedConvId(conv.id);
      setMessages([{ role: 'assistant', content: "Hey there! 🕷️ I'm Spidr AI. Ask me anything!" }]);
    },
  });

  const saveLog = useMutation({
    mutationFn: (d) => entities.AIChatLog.create(d),
    onSuccess:  () => queryClient.invalidateQueries(['ai-chat-logs']),
  });

  const updateConv = useMutation({
    mutationFn: ({ id, data }) => entities.AIConversation.update(id, data),
    onSuccess:  () => queryClient.invalidateQueries(['ai-conversations']),
  });

  const handleSend = async () => {
    if (!input.trim() || loading || !selectedConvId) return;
    const text = input.trim();

    // Content scan
    setLoading(true);
    const scan = await scanPrompt(text);
    if (!scan?.safe) {
      setBlockedCat(scan?.category || 'unknown');
      setLoading(false);
      return;
    }

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    saveLog.mutate({ user_id: currentUser?.id, conversation_id: selectedConvId, role: 'user', content: text });

    const conv = conversations.find(c => c.id === selectedConvId);
    if (conv?.title === 'New Chat') {
      updateConv.mutate({ id: selectedConvId, data: { title: text.slice(0, 50), last_message: text.slice(0, 100) } });
    }

    try {
      const reply = await integrations.Core.InvokeLLM({
        prompt: `You are Spidr AI — a helpful, cool assistant in a gaming/Discord-like app called Spidr. Be friendly, concise, and occasionally use spider/web metaphors. Keep responses under 200 words unless detail is truly needed.\n\nUser: ${text}`,
      });

      const replyText = typeof reply === 'string' ? reply : JSON.stringify(reply);
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
      saveLog.mutate({ user_id: currentUser?.id, conversation_id: selectedConvId, role: 'assistant', content: replyText });
      updateConv.mutate({ id: selectedConvId, data: { last_message: replyText.slice(0, 100) } });
    } catch {
      toast.error('Spidr AI is temporarily unavailable');
    }
    setLoading(false);
  };

  // ── Layout matches screenshot 2: left sidebar + right chat area ─────────────
  return (
    <div className="flex gap-0 bg-zinc-900/80 border border-white/5 rounded-2xl overflow-hidden" style={{ minHeight: 460 }}>
      <ContentBlockedModal open={!!blockedCat} onClose={() => setBlockedCat(null)} category={blockedCat} />

      {/* Left: conversation list */}
      <div className="w-56 border-r border-white/5 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-white/5">
          <button
            onClick={() => createConvMut.mutate()}
            disabled={createConvMut.isPending}
            className="w-full flex items-center justify-center gap-2 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                selectedConvId === conv.id ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <p className="text-xs font-medium truncate">{conv.title}</p>
              {conv.last_message && (
                <p className="text-[10px] opacity-60 truncate mt-0.5">{conv.last_message}</p>
              )}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="text-center text-zinc-600 text-xs py-6">No chats yet</p>
          )}
        </div>
      </div>

      {/* Right: chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Empty state — matches screenshot */}
        {!selectedConvId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <SpiderLogo size={64} />
            <p className="text-zinc-400 text-sm">Start a new chat with Spidr AI</p>
            <button
              onClick={() => createConvMut.mutate()}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <SpiderLogo size={16} />
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-white rounded-br-sm'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                      {currentUser?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* AI config notice — only shows when not configured */}
            {messages.some(m => m.content?.includes('OPENAI_API_KEY')) && (
              <div className="mx-3 mb-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                <span className="text-amber-400 text-sm">⚠️</span>
                <div>
                  <p className="text-amber-400 text-xs font-bold">AI Not Configured</p>
                  <p className="text-zinc-400 text-[10px]">Add <code className="bg-zinc-800 px-1 rounded">OPENAI_API_KEY</code> or <code className="bg-zinc-800 px-1 rounded">ANTHROPIC_API_KEY</code> to <code className="bg-zinc-800 px-1 rounded">spidr-server/.env</code> to enable AI chat.</p>
                </div>
              </div>
            )}

            {/* Input bar */}
            <div className="p-3 border-t border-white/5">
              <div className="flex gap-2 bg-zinc-800 rounded-xl p-1.5">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask Spidr AI anything…"
                  className="flex-1 bg-transparent text-white text-sm px-2 focus:outline-none placeholder-zinc-500"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 text-center mt-1.5">Spidr AI — powered by your configured LLM</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
