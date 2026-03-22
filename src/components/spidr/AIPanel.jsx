import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Server, User, Palette, Wand2, Loader2, Bot, Send, MessageCircle, Plus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import SpiderLogo from './SpiderLogo';
import { scanPrompt } from './ContentScanner';
import ContentBlockedModal from './ContentBlockedModal';

export default function AIPanel({ currentUser }) {
  const queryClient = useQueryClient();
  
  return (
    <div className="flex-1 flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="h-14 border-b border-red-900/20 flex items-center px-6 gap-3">
        <SpiderLogo size={36} />
        <div>
          <h2 className="font-semibold text-white">Spidr AI</h2>
          <p className="text-xs text-zinc-500">Your intelligent assistant</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <SpiderLogo size={100} className="mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome to <span className="text-red-500">Spidr AI</span>
            </h1>
            <p className="text-zinc-400">
              Create servers, customize profiles, and more with AI assistance
            </p>
          </motion.div>

          <Tabs defaultValue="server" className="w-full">
            <TabsList className="w-full grid grid-cols-4 bg-zinc-800/50 border border-red-900/20 mb-6">
              <TabsTrigger value="server" className="data-[state=active]:bg-red-600">
                <Server className="w-4 h-4 mr-2" /> Server
              </TabsTrigger>
              <TabsTrigger value="profile" className="data-[state=active]:bg-red-600">
                <User className="w-4 h-4 mr-2" /> Profile
              </TabsTrigger>
              <TabsTrigger value="bot" className="data-[state=active]:bg-red-600">
                <Bot className="w-4 h-4 mr-2" /> Bot
              </TabsTrigger>
              <TabsTrigger value="chat" className="data-[state=active]:bg-red-600">
                <MessageCircle className="w-4 h-4 mr-2" /> Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="server">
              <CreateServerAI currentUser={currentUser} queryClient={queryClient} />
            </TabsContent>

            <TabsContent value="profile">
              <CustomizeProfileAI currentUser={currentUser} queryClient={queryClient} />
            </TabsContent>

            <TabsContent value="bot">
              <CreateBotAI currentUser={currentUser} queryClient={queryClient} />
            </TabsContent>

            <TabsContent value="chat">
              <AIAssistant currentUser={currentUser} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// AI Assistant Chat
function AIAssistant({ currentUser }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [blockedCategory, setBlockedCategory] = useState(null);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery({
    queryKey: ['ai-conversations', currentUser?.id],
    queryFn: () => base44.entities.AIConversation.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id
  });

  const { data: chatLogs = [] } = useQuery({
    queryKey: ['ai-chat-logs', selectedConversationId],
    queryFn: () => base44.entities.AIChatLog.filter({ 
      conversation_id: selectedConversationId,
      user_id: currentUser?.id 
    }),
    enabled: !!selectedConversationId && !!currentUser?.id
  });

  useEffect(() => {
    if (chatLogs.length > 0) {
      setMessages(chatLogs.map(log => ({ role: log.role, content: log.content })));
    } else if (selectedConversationId) {
      setMessages([
        { role: 'assistant', content: 'Hey there! 🕷️ I\'m Spidr AI, your tactical assistant. Ask me anything about servers, Spidr features, gaming strategies, or just chat!' }
      ]);
    }
  }, [chatLogs, selectedConversationId]);

  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const createConversationMutation = useMutation({
    mutationFn: () => base44.entities.AIConversation.create({
      user_id: currentUser?.id,
      title: 'New Chat',
      last_message: ''
    }),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      setSelectedConversationId(newConv.id);
      setMessages([
        { role: 'assistant', content: 'Hey there! 🕷️ I\'m Spidr AI, your tactical assistant. Ask me anything about servers, Spidr features, gaming strategies, or just chat!' }
      ]);
    }
  });

  const updateConversationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AIConversation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    }
  });

  const saveMutation = useMutation({
    mutationFn: (logData) => base44.entities.AIChatLog.create(logData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-chat-logs'] });
    }
  });

  const handleNewChat = () => {
    createConversationMutation.mutate();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !selectedConversationId) return;

    const userMessageContent = input;

    // Scan prompt for inappropriate content requests
    setIsLoading(true);
    const promptScan = await scanPrompt(userMessageContent);
    if (!promptScan.safe) {
      setBlockedCategory(promptScan.category);
      setIsLoading(false);
      return;
    }

    const userMessage = { role: 'user', content: userMessageContent };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Save user message
    saveMutation.mutate({
      user_id: currentUser?.id,
      conversation_id: selectedConversationId,
      role: 'user',
      content: userMessageContent
    });

    // Update conversation title if it's the first message
    const selectedConv = conversations.find(c => c.id === selectedConversationId);
    if (selectedConv && selectedConv.title === 'New Chat') {
      const title = userMessageContent.slice(0, 50) + (userMessageContent.length > 50 ? '...' : '');
      updateConversationMutation.mutate({
        id: selectedConversationId,
        data: { title, last_message: userMessageContent.slice(0, 100) }
      });
    }

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Spidr AI, a cool and tactical AI assistant in a gaming/Discord-like app. Be helpful, casual, and use occasional spider/web metaphors. User: ${userMessageContent}`,
        add_context_from_internet: true
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      
      // Save assistant response
      saveMutation.mutate({
        user_id: currentUser?.id,
        conversation_id: selectedConversationId,
        role: 'assistant',
        content: response
      });

      // Update last message
      updateConversationMutation.mutate({
        id: selectedConversationId,
        data: { last_message: response.slice(0, 100) }
      });
    } catch (error) {
      toast.error('Spidr AI is temporarily unavailable');
      setMessages(prev => prev.filter(m => m !== userMessage));
    }
    setIsLoading(false);
  };

  return (
    <div className="flex h-full">
      {/* Chat History Sidebar */}
      <div className="w-64 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <Button 
            onClick={handleNewChat}
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={createConversationMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversationId(conv.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedConversationId === conv.id 
                    ? 'bg-red-600 text-white' 
                    : 'hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                <div className="font-medium text-sm truncate">{conv.title}</div>
                {conv.last_message && (
                  <div className="text-xs opacity-70 truncate mt-1">{conv.last_message}</div>
                )}
              </button>
            ))}
            
            {conversations.length === 0 && (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No chats yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col p-6">
        <ScrollArea className="flex-1 mb-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                    <SpiderLogo size={20} />
                  </div>
                )}
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-zinc-800 text-zinc-100'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-white text-lg shrink-0">
                    {currentUser?.full_name?.charAt(0) || 'U'}
                  </div>
                )}
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
                <div className="bg-zinc-800 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <ContentBlockedModal
        open={!!blockedCategory}
        onClose={() => setBlockedCategory(null)}
        category={blockedCategory}
      />

      {!selectedConversationId && conversations.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <SpiderLogo size={80} className="mx-auto mb-4 opacity-50" />
            <p className="text-zinc-500 mb-4">Start a new chat with Spidr AI</p>
            <Button onClick={handleNewChat} className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto w-full">
        <div className="flex gap-2 bg-zinc-800 rounded-2xl p-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask Spidr AI anything..."
            className="flex-1 bg-transparent border-0 text-white focus-visible:ring-0"
          />
          <Button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-red-600 hover:bg-red-700 rounded-xl"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-zinc-600 mt-2 text-center">
          Spidr AI can search the web for real-time info
        </p>
      </div>
      )}
    </div>
    </div>
  );
}

function CreateServerAI({ currentUser, queryClient }) {
  const [prompt, setPrompt] = useState('');
  const [generatedServer, setGeneratedServer] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const createServerMutation = useMutation({
    mutationFn: (data) => base44.entities.Server.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      toast.success('Server created successfully!');
      setGeneratedServer(null);
      setPrompt('');
    }
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a Discord-like server configuration based on this description: "${prompt}"
        
Generate a creative and fitting:
- Server name (short, memorable)
- Server description (1-2 sentences)
- Theme color (hex code)
- 3-5 text channels (relevant to the theme)
- 1-2 voice channels`,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            theme_color: { type: "string" },
            channels: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  type: { type: "string", enum: ["text", "voice"] }
                }
              }
            }
          }
        }
      });
      
      setGeneratedServer({
        ...result,
        owner_id: currentUser?.id,
        members: [{
          user_id: currentUser?.id,
          user_name: currentUser?.full_name || currentUser?.email,
          user_avatar: currentUser?.avatar_url || '',
          role: 'admin'
        }]
      });
    } catch (error) {
      toast.error('Failed to generate server');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-800/50 rounded-2xl p-6 border border-red-900/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <Wand2 className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-semibold text-white">AI Server Generator</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label className="text-zinc-300">Describe your server</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., A gaming community for retro game enthusiasts, focusing on 80s and 90s arcade games..."
            className="bg-zinc-900 border-zinc-700 text-white mt-1"
            rows={3}
          />
        </div>
        
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-red-600 hover:bg-red-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Server
            </>
          )}
        </Button>

        <AnimatePresence>
          {generatedServer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-900 rounded-xl p-4 border border-red-900/30 space-y-3"
            >
              <h4 className="font-semibold text-white">{generatedServer.name}</h4>
              <p className="text-zinc-400 text-sm">{generatedServer.description}</p>
              
              <div>
                <p className="text-xs text-zinc-500 mb-2">Channels:</p>
                <div className="flex flex-wrap gap-2">
                  {generatedServer.channels?.map((ch, i) => (
                    <span key={i} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300">
                      {ch.type === 'voice' ? '🔊' : '#'} {ch.name}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => createServerMutation.mutate(generatedServer)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={createServerMutation.isPending}
                >
                  Create Server
                </Button>
                <Button
                  onClick={handleGenerate}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Regenerate
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function CustomizeProfileAI({ currentUser, queryClient }) {
  const [prompt, setPrompt] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate creative profile customization suggestions based on this description: "${prompt}"
        
Provide:
- A creative display name
- A short, catchy bio (1-2 sentences)
- A custom status message
- An accent color that fits the theme (hex code)`,
        response_json_schema: {
          type: "object",
          properties: {
            display_name: { type: "string" },
            bio: { type: "string" },
            custom_status: { type: "string" },
            accent_color: { type: "string" }
          }
        }
      });
      
      setSuggestions(result);
    } catch (error) {
      toast.error('Failed to generate suggestions');
    } finally {
      setIsGenerating(false);
    }
  };

  const applyMutation = useMutation({
    mutationFn: async (data) => {
      const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser?.id });
      if (profiles[0]) {
        return base44.entities.UserProfile.update(profiles[0].id, data);
      } else {
        return base44.entities.UserProfile.create({ ...data, user_id: currentUser?.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated!');
      setSuggestions(null);
      setPrompt('');
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-800/50 rounded-2xl p-6 border border-red-900/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-semibold text-white">AI Profile Customizer</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label className="text-zinc-300">Describe your vibe</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., I'm a cyberpunk aesthetic enthusiast who loves neon colors and futuristic themes..."
            className="bg-zinc-900 border-zinc-700 text-white mt-1"
            rows={3}
          />
        </div>
        
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-red-600 hover:bg-red-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Suggestions
            </>
          )}
        </Button>

        <AnimatePresence>
          {suggestions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-900 rounded-xl p-4 border border-red-900/30 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: suggestions.accent_color }}
                >
                  {suggestions.display_name?.charAt(0)}
                </div>
                <div>
                  <h4 className="font-semibold text-white">{suggestions.display_name}</h4>
                  <p className="text-zinc-500 text-sm">{suggestions.custom_status}</p>
                </div>
              </div>
              
              <p className="text-zinc-300 text-sm">{suggestions.bio}</p>
              
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => applyMutation.mutate(suggestions)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={applyMutation.isPending}
                >
                  Apply to Profile
                </Button>
                <Button
                  onClick={handleGenerate}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Regenerate
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function CreateBotAI({ currentUser, queryClient }) {
  const [prompt, setPrompt] = useState('');
  const [generatedBot, setGeneratedBot] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a chatbot/assistant configuration based on this description: "${prompt}"
        
Generate:
- Bot name (creative, memorable)
- Bot description (2-3 sentences explaining what it does)
- Bot personality (friendly, professional, sarcastic, etc.)
- 3-5 example commands or capabilities`,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            personality: { type: "string" },
            capabilities: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });
      
      setGeneratedBot(result);
    } catch (error) {
      toast.error('Failed to generate bot');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-800/50 rounded-2xl p-6 border border-red-900/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-5 h-5 text-red-400" />
        <h3 className="text-lg font-semibold text-white">AI Bot Generator</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label className="text-zinc-300">Describe your bot</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., A helpful moderation bot that can ban spammers, manage roles, and send welcome messages..."
            className="bg-zinc-900 border-zinc-700 text-white mt-1"
            rows={3}
          />
        </div>
        
        <Button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-red-600 hover:bg-red-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Bot
            </>
          )}
        </Button>

        <AnimatePresence>
          {generatedBot && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-900 rounded-xl p-4 border border-red-900/30 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">{generatedBot.name}</h4>
                  <p className="text-zinc-500 text-xs">{generatedBot.personality}</p>
                </div>
              </div>
              
              <p className="text-zinc-400 text-sm">{generatedBot.description}</p>
              
              <div>
                <p className="text-xs text-zinc-500 mb-2">Capabilities:</p>
                <div className="space-y-1">
                  {generatedBot.capabilities?.map((cap, i) => (
                    <div key={i} className="px-3 py-2 bg-zinc-800 rounded text-sm text-zinc-300">
                      • {cap}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    toast.success('Bot configuration saved!');
                    setGeneratedBot(null);
                    setPrompt('');
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Save Bot
                </Button>
                <Button
                  onClick={handleGenerate}
                  variant="outline"
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Regenerate
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}