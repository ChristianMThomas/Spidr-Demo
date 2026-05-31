import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Search, Sparkles, Shield, Music, Bot, Plus, Check, Cpu, Loader2, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { entities } from '@/api/apiClient';
import MyBotsTab from './MyBotsTab';
import ImportBotTab from './ImportBotTab';

const CATEGORY_META = {
  scientists:  { name: 'Scientists',  icon: Sparkles, color: '#3b82f6' },
  entertainers:{ name: 'Entertainers',icon: Music,    color: '#ec4899' },
  guardians:   { name: 'Guardians',   icon: Shield,   color: '#10b981' },
  utility:     { name: 'Utility',     icon: Cpu,      color: '#a855f7' },
  custom:      { name: 'Community',   icon: Bot,      color: '#FF3333' },
};

const TABS = [
  { id: 'store',   label: 'BOT STORE',  icon: Bot },
  { id: 'my_bots', label: 'MY BOTS',    icon: Cpu },
  { id: 'create',  label: 'CREATE',     icon: Plus },
  { id: 'import',  label: 'IMPORT',     icon: Plus },
];

export default function BotLaboratory({ currentUser }) {
  const [activeTab, setActiveTab] = useState('store');
  const [searchQuery, setSearchQuery] = useState('');
  const [installingBot, setInstallingBot] = useState(null); // bot object to show install dialog for
  const [selectedServerId, setSelectedServerId] = useState('');
  const queryClient = useQueryClient();

  // Fetch all public bots (official + user-published)
  const { data: bots = [], isLoading: loadingBots } = useQuery({
    queryKey: ['public-bots'],
    queryFn: async () => {
      const all = await entities.CustomBot.list('-install_count', 200);
      return all.filter(b => b.is_public !== false);
    },
    staleTime: 30000,
  });

  // Fetch user's servers (so we know where to install)
  const { data: allServers = [] } = useQuery({
    queryKey: ['my-servers-bot-lab'],
    queryFn: () => entities.Server.list('-created_date', 100),
    enabled: !!currentUser?.id,
  });
  const myServers = allServers.filter(s =>
    s.owner_id === currentUser?.id ||
    (s.members || []).some(m => m.user_id === currentUser?.id && (m.role === 'Admin' || m.role === 'admin'))
  );

  // Group by category
  const byCategory = React.useMemo(() => {
    const groups = {};
    for (const bot of bots) {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!bot.name?.toLowerCase().includes(q) && !bot.description?.toLowerCase().includes(q)) continue;
      }
      const cat = bot.category || 'custom';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(bot);
    }
    return groups;
  }, [bots, searchQuery]);

  const installMutation = useMutation({
    mutationFn: async ({ bot, serverId }) => {
      let server;
      try { server = await entities.Server.get(serverId); }
      catch { throw new Error('Server not found'); }
      if (!server) throw new Error('Server not found');
      const existingBots = server.bots || [];
      if (existingBots.some(b => b.bot_id === bot.id)) {
        throw new Error('That bot is already installed on this server');
      }
      await entities.Server.update(serverId, {
        bots: [
          ...existingBots,
          {
            bot_id: bot.id,
            name: bot.name,
            icon_emoji: bot.icon_emoji || '🤖',
            installed_by: currentUser?.id,
            installed_at: new Date().toISOString(),
          },
        ],
      });
      // Bump install count
      await entities.CustomBot.update(bot.id, {
        install_count: (bot.install_count || 0) + 1,
      });
      return { bot, server };
    },
    onSuccess: ({ bot, server }) => {
      toast.success(`✓ ${bot.name} installed to ${server.name}`);
      queryClient.invalidateQueries({ queryKey: ['public-bots'] });
      queryClient.invalidateQueries({ queryKey: ['my-servers-bot-lab'] });
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      setInstallingBot(null);
      setSelectedServerId('');
    },
    onError: (err) => {
      toast.error(err?.message || 'Install failed');
    },
  });

  return (
    <div className="flex-1 flex flex-col bg-black/40">
      {/* Header */}
      <div className="p-6 border-b border-red-900/20 bg-black/30 backdrop-blur-xl">
        <h2 className="text-2xl md:text-3xl font-mono font-bold text-white mb-2 flex items-center gap-2">
          <span className="text-red-500">&gt;</span> BOT_LABORATORY
        </h2>
        <p className="text-neutral-500 font-mono text-sm">Build, import, and deploy bots for your servers.</p>

        <div className="flex flex-wrap gap-2 mt-4">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-xs tracking-widest uppercase transition-all ${
                  active
                    ? 'bg-red-950/40 border-red-900/50 text-white'
                    : 'bg-[#0a0a0a] border-white/5 text-neutral-400 hover:border-white/10 hover:text-neutral-200'
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-[55%] bg-red-500 rounded-r-full" />}
                [ {tab.label.replace(/ /g, '_')} ]
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'store' && (
            <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-6 relative group">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-md py-3 pl-4 pr-4 text-white font-mono text-sm outline-none transition-all focus:border-red-500 focus:shadow-[0_0_10px_#ef4444] placeholder-transparent"
                  placeholder="search"
                />
                {/* Terminal prompt overlay — shows when empty, with a blinking cursor */}
                {!searchQuery && (
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-neutral-500 pointer-events-none">
                    &gt; SEARCH_BOTS: <span className="spidr-blink text-red-500">_</span>
                  </div>
                )}
              </div>

              {loadingBots ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={32} className="animate-spin text-zinc-500" />
                </div>
              ) : Object.keys(byCategory).length === 0 ? (
                <div className="text-center py-20 text-zinc-500">
                  {searchQuery ? 'No bots match your search.' : 'No bots yet — be the first to publish one!'}
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(byCategory).map(([categoryKey, categoryBots]) => {
                    const meta = CATEGORY_META[categoryKey] || CATEGORY_META.custom;
                    const Icon = meta.icon;
                    return (
                      <div key={categoryKey}>
                        {/* Category header — glowing concentric node + cyan terminal type */}
                        <div className="flex items-center gap-2.5 mb-4">
                          <span className="relative flex items-center justify-center w-3.5 h-3.5 rounded-full border border-red-500/30 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                          </span>
                          <h3 className="font-mono text-xs tracking-[0.15em] text-cyan-600/80 uppercase">&gt; {meta.name}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoryBots.map((bot, index) => (
                            <motion.div
                              key={bot.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="group relative"
                            >
                              <div className="relative bg-[#0a0a0a]/80 backdrop-blur-md rounded-xl p-5 border border-white/5 h-full flex flex-col transition-all duration-300 group-hover:border-red-900/50 group-hover:shadow-[0_0_24px_rgba(220,38,38,0.12)]">
                                {/* Bot icon — flat glowing node */}
                                <div className="mb-4 flex items-center">
                                  <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-2xl"
                                    style={{ boxShadow: `0 0 16px ${meta.color}33`, borderColor: `${meta.color}40` }}>
                                    {bot.icon_emoji || '◆'}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-lg font-bold text-white font-mono">{bot.name}</h4>
                                  {bot.is_official && (
                                    <span className="border border-purple-500/50 bg-purple-500/10 text-purple-400 text-[10px] uppercase px-1.5 py-0.5 rounded-[3px] font-mono tracking-wider">
                                      Official
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400 mb-4 flex-1">{bot.description}</p>
                                <div className="space-y-1 mb-4">
                                  {(bot.features || []).slice(0, 3).map((feature, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-gray-400 font-mono">
                                      <span className="text-red-500 shrink-0">&gt;</span>
                                      {feature}
                                    </div>
                                  ))}
                                </div>
                                <button
                                  onClick={() => {
                                    if (myServers.length === 0) {
                                      toast.error('Join or create a server first to install bots');
                                      return;
                                    }
                                    setInstallingBot(bot);
                                    setSelectedServerId(myServers[0].id);
                                  }}
                                  className="w-full rounded-md bg-red-600/10 border border-red-500/40 text-red-500 font-mono text-sm tracking-widest uppercase py-2 hover:bg-red-500 hover:text-white transition-all duration-300"
                                >
                                  [ INSTALL_TO_SERVER ]
                                </button>
                                <div className="text-[10px] text-neutral-600 text-center mt-2 font-mono">
                                  {(bot.install_count || 0).toLocaleString()} installs
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'my_bots' && (
            <motion.div key="my_bots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MyBotsTab currentUser={currentUser} />
            </motion.div>
          )}

          {activeTab === 'create' && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CreateBotTab currentUser={currentUser} />
            </motion.div>
          )}

          {activeTab === 'import' && (
            <motion.div key="import" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ImportBotTab currentUser={currentUser} />
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Install dialog — pick which server */}
      <Dialog open={!!installingBot} onOpenChange={(o) => !o && setInstallingBot(null)}>
        <DialogContent className="bg-zinc-900 border-red-900/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-3xl">{installingBot?.icon_emoji || '🤖'}</span>
              Install {installingBot?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">{installingBot?.description}</p>

            {installingBot?.commands?.length > 0 && (
              <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2 tracking-wider">Commands</p>
                <div className="space-y-1">
                  {installingBot.commands.slice(0, 6).map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <code className="bg-zinc-800 text-[#FF3333] px-1.5 py-0.5 rounded font-mono text-[10px]">{c.trigger}</code>
                      <span className="text-zinc-500 truncate">{c.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase text-zinc-500 mb-2 tracking-wider">Install on</p>
              {myServers.length === 0 ? (
                <p className="text-xs text-amber-400">You need to own or admin a server to install bots.</p>
              ) : (
                <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Choose a server..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {myServers.map(s => {
                      const alreadyHas = (s.bots || []).some(b => b.bot_id === installingBot?.id);
                      return (
                        <SelectItem
                          key={s.id}
                          value={s.id}
                          disabled={alreadyHas}
                          className="text-white data-[disabled]:opacity-40"
                        >
                          {s.name} {alreadyHas && <span className="text-[10px] text-zinc-500">(already installed)</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-zinc-700"
                onClick={() => setInstallingBot(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => installMutation.mutate({ bot: installingBot, serverId: selectedServerId })}
                disabled={!selectedServerId || installMutation.isPending}
                className="flex-1 bg-[#FF3333] hover:bg-red-500"
              >
                {installMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className="mr-1" />}
                Install
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * CreateBotTab — user-built bot creator using simple trigger → response pairs.
 *
 * SECURITY MODEL — important to understand the boundaries:
 *   • We do NOT execute user-supplied JavaScript anywhere. The CustomBot
 *     schema has a `code` field reserved for a future sandboxed runtime,
 *     but this UI only writes to the `commands` array, which is a list of
 *     declarative {trigger, response} pairs interpreted by the server bot
 *     engine. No arbitrary code path.
 *   • Triggers are string matches (case-insensitive, exact or prefix).
 *   • Responses are plain text. Template variables {user}, {server},
 *     {channel} are substituted server-side at runtime — no eval.
 *
 * This is the safe MVP. A real "user-coded bots" feature with JS execution
 * would need an isolated VM (vm2, isolated-vm) on the server and is
 * deliberately out of scope here.
 */
function CreateBotTab({ currentUser }) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [iconEmoji, setIconEmoji] = React.useState('🤖');
  const [commands, setCommands] = React.useState([{ trigger: '', response: '', description: '' }]);
  const [testMessage, setTestMessage] = React.useState('');
  const [testResult, setTestResult] = React.useState(null);

  const addCommandRow = () => {
    setCommands(cs => [...cs, { trigger: '', response: '', description: '' }]);
  };

  const updateCommand = (idx, field, value) => {
    setCommands(cs => cs.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeCommand = (idx) => {
    setCommands(cs => cs.filter((_, i) => i !== idx));
  };

  // Local trigger-matching preview — mirrors the server-side logic.
  // If the test message starts with a trigger (case-insensitive), echo the
  // response with template variables substituted.
  const runTest = () => {
    if (!testMessage.trim()) { setTestResult(null); return; }
    const msg = testMessage.trim();
    const lowered = msg.toLowerCase();
    const match = commands.find(c => {
      if (!c.trigger) return false;
      const t = c.trigger.toLowerCase();
      return lowered === t || lowered.startsWith(t + ' ') || lowered.startsWith(t);
    });
    if (!match) {
      setTestResult({ ok: false, text: 'No trigger matched.' });
      return;
    }
    const response = (match.response || '')
      .replace(/\{user\}/g, currentUser?.full_name || currentUser?.username || 'friend')
      .replace(/\{server\}/g, 'Your Server')
      .replace(/\{channel\}/g, '#general');
    setTestResult({ ok: true, text: response, matched: match.trigger });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      // Validation
      if (!name.trim()) throw new Error('Bot name required');
      const validCommands = commands.filter(c => c.trigger?.trim() && c.response?.trim());
      if (validCommands.length === 0) throw new Error('Add at least one trigger + response');

      return entities.CustomBot.create({
        author_id:   currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.username,
        owner_id:    currentUser?.id,
        name:        name.trim(),
        description: description.trim() || `Custom bot by ${currentUser?.full_name || 'you'}`,
        icon_emoji:  iconEmoji,
        category:    'custom',
        commands:    validCommands.map(c => ({
          trigger:     c.trigger.trim(),
          response:    c.response.trim(),
          description: c.description?.trim() || '',
        })),
        is_public:   false,
        is_official: false,
        is_active:   true,
        // Mark as user-built so the bot engine doesn't try to look it up in
        // the built-in registry. The bot engine handles the `commands`
        // array directly for these.
        code:        'user:commands',
      });
    },
    onSuccess: () => {
      toast.success('Bot created! Install it from My Bots.');
      queryClient.invalidateQueries({ queryKey: ['custom-bots'] });
      // Reset form
      setName(''); setDescription(''); setIconEmoji('🤖');
      setCommands([{ trigger: '', response: '', description: '' }]);
      setTestMessage(''); setTestResult(null);
    },
    onError: (err) => toast.error(err?.message || 'Could not save bot'),
  });

  const validCount = commands.filter(c => c.trigger?.trim() && c.response?.trim()).length;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black uppercase italic tracking-tight text-white mb-1">
          Fabricate a Bot
        </h2>
        <p className="text-zinc-500 text-sm">
          Build a simple bot with trigger → response pairs. No code required.
        </p>
      </div>

      {/* Identity card */}
      <div className="bg-zinc-900/60 rounded-2xl border border-white/5 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Cycle through a friendly set of emoji icons. Real implementation
              // would open a picker — this is the shipping MVP.
              const palette = ['🤖','🕷️','👾','🦾','🧠','⚙️','🎲','🎮','📡','🛡️','⚡','🔮'];
              const cur = palette.indexOf(iconEmoji);
              setIconEmoji(palette[(cur + 1) % palette.length]);
            }}
            className="w-14 h-14 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 flex items-center justify-center text-3xl transition-colors"
            title="Click to cycle icon"
          >
            {iconEmoji}
          </button>
          <div className="flex-1 min-w-0">
            <Input
              placeholder="Bot name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white text-base font-bold"
              maxLength={50}
            />
            <Input
              placeholder="Short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white text-xs mt-2"
              maxLength={120}
            />
          </div>
        </div>
        <p className="text-zinc-600 text-[10px]">Click the icon to cycle through preset emojis. Custom images coming soon.</p>
      </div>

      {/* Commands */}
      <div className="bg-zinc-900/60 rounded-2xl border border-white/5 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold">Triggers & Responses</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              When a message matches a trigger, your bot responds. Use <code className="text-red-400 font-mono">{'{user}'}</code>, <code className="text-red-400 font-mono">{'{server}'}</code>, <code className="text-red-400 font-mono">{'{channel}'}</code> as substitutions.
            </p>
          </div>
          <button
            onClick={addCommandRow}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <Plus size={12} /> Add
          </button>
        </div>

        <div className="space-y-2">
          {commands.map((cmd, idx) => (
            <div key={idx} className="bg-zinc-800/60 rounded-lg p-3 border border-white/5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-[10px] font-mono w-6 text-right">{idx + 1}.</span>
                <Input
                  placeholder="Trigger (e.g. !hello or hey bot)"
                  value={cmd.trigger}
                  onChange={(e) => updateCommand(idx, 'trigger', e.target.value)}
                  className="bg-black/40 border-zinc-700 text-white text-sm font-mono flex-1"
                  maxLength={40}
                />
                {commands.length > 1 && (
                  <button
                    onClick={() => removeCommand(idx)}
                    className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-red-900/40 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Textarea
                placeholder={'Response — what the bot says back.\nUse {user} to mention the sender.'}
                value={cmd.response}
                onChange={(e) => updateCommand(idx, 'response', e.target.value)}
                className="bg-black/40 border-zinc-700 text-white text-sm resize-none"
                rows={2}
                maxLength={500}
              />
              <Input
                placeholder="Description (optional, shown in install dialog)"
                value={cmd.description}
                onChange={(e) => updateCommand(idx, 'description', e.target.value)}
                className="bg-black/40 border-zinc-700 text-zinc-400 text-[11px]"
                maxLength={100}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tester */}
      <div className="bg-zinc-900/60 rounded-2xl border border-white/5 p-5 space-y-3">
        <div>
          <p className="text-white font-bold">Test your bot</p>
          <p className="text-zinc-500 text-xs mt-0.5">Type a fake message and see what your bot would say.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Try typing one of your triggers..."
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runTest(); }}
            className="bg-black/40 border-zinc-700 text-white text-sm flex-1"
          />
          <button
            onClick={runTest}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold"
          >
            Run
          </button>
        </div>
        {testResult && (
          <div className={`rounded-lg p-3 border ${testResult.ok ? 'bg-green-900/15 border-green-500/30' : 'bg-zinc-800/60 border-white/5'}`}>
            <p className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${testResult.ok ? 'text-green-400' : 'text-zinc-500'}`}>
              {testResult.ok ? `Matched "${testResult.matched}"` : 'No match'}
            </p>
            <p className="text-white text-sm whitespace-pre-wrap">{testResult.text}</p>
          </div>
        )}
      </div>

      {/* Save action */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-zinc-500 text-xs">
          {validCount} valid command{validCount === 1 ? '' : 's'}
        </p>
        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !name.trim() || validCount === 0}
          className="bg-red-600 hover:bg-red-500 text-white font-bold"
        >
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
          Save Bot
        </Button>
      </div>

      {/* Honest note about the JS path */}
      <div className="bg-yellow-900/15 border border-yellow-500/20 rounded-xl p-4">
        <p className="text-yellow-400 text-xs font-bold mb-1">About JavaScript bots</p>
        <p className="text-zinc-400 text-[11px] leading-relaxed">
          The schema reserves a <code className="text-yellow-300 font-mono">code</code> field for future
          JavaScript-powered bots, but we haven't shipped the sandboxed runtime yet
          and won't until we can guarantee safe isolation. For now, all user-made
          bots are trigger/response pairs — which is enough for greeters, FAQ
          bots, role-grant prompts, and simple commands.
        </p>
      </div>
    </div>
  );
}
