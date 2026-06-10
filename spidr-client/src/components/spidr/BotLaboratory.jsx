import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Search, Sparkles, Shield, Music, Bot, Check, Cpu, Loader2, Settings, X, Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { entities } from '@/api/apiClient';
import MyBotsTab from './MyBotsTab';

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
];

export default function BotLaboratory({ currentUser }) {
  const [activeTab, setActiveTab] = useState('store');
  const [searchQuery, setSearchQuery] = useState('');
  const [installingBot, setInstallingBot] = useState(null);
  const [selectedServerId, setSelectedServerId] = useState('');

  // Auto Mod config
  const [configuringBot, setConfiguringBot] = useState(null); // { bot }
  const [configServerId, setConfigServerId] = useState('');
  const [automodSettings, setAutomodSettings] = useState({
    slurFilter: true,
    spamThreshold: 5,
    spamWindowSecs: 10,
    banned_words: [],
    allowed_words: [],
  });
  const [bannedInput, setBannedInput] = useState('');
  const [allowedInput, setAllowedInput] = useState('');

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
  const myServers = allServers.filter(s => {
    const uid = String(currentUser?.id || '');
    if (!uid) return false;
    if (String(s.owner_id) === uid) return true;
    return (s.members || []).some(m => {
      if (String(m.user_id) !== uid) return false;
      const role = String(m.role || '').toLowerCase();
      return ['admin', 'mod', 'moderator', 'owner'].includes(role);
    });
  });

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
            bot_code: bot.code,
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

  // Populate settings form when the user picks a server to configure
  useEffect(() => {
    if (!configServerId) return;
    const server = myServers.find(s => s.id === configServerId);
    const cfg = server?.bot_config?.automod || {};
    setAutomodSettings({
      slurFilter: cfg.slurFilter !== false,
      spamThreshold: cfg.spamThreshold ?? 5,
      spamWindowSecs: cfg.spamWindowSecs ?? 10,
      banned_words: Array.isArray(cfg.banned_words) ? cfg.banned_words : [],
      allowed_words: Array.isArray(cfg.allowed_words) ? cfg.allowed_words : [],
    });
    setBannedInput('');
    setAllowedInput('');
  }, [configServerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAutomodMutation = useMutation({
    mutationFn: async ({ serverId, settings }) => {
      const server = await entities.Server.get(serverId);
      await entities.Server.update(serverId, {
        bot_config: { ...(server.bot_config || {}), automod: settings },
      });
    },
    onSuccess: () => {
      toast.success('✓ Auto Moderator settings saved');
      queryClient.invalidateQueries({ queryKey: ['my-servers-bot-lab'] });
      setConfiguringBot(null);
      setConfigServerId('');
    },
    onError: () => toast.error('Could not save settings'),
  });

  const addWord = (field, input, setInput) => {
    const word = input.trim().toLowerCase();
    if (!word) return;
    setAutomodSettings(prev => ({
      ...prev,
      [field]: prev[field].includes(word) ? prev[field] : [...prev[field], word],
    }));
    setInput('');
  };

  const removeWord = (field, word) => {
    setAutomodSettings(prev => ({ ...prev, [field]: prev[field].filter(w => w !== word) }));
  };

  return (
    <div className="flex-1 flex flex-col bg-black/40">
      {/* Header — responsive layout with explicit breakpoints so the tabs
          never wrap into an ugly 3+1 or 1+2+1 split:
            <sm  : title stacked above a 2×2 grid of tabs
            sm-lg: title stacked above a 1×4 row of tabs
            lg+  : single row — title left, tabs centered, lg:pr-[200px]
                   reserves room for the shell's top-right cluster.
          On lg+, lg:min-h-14 keeps the row centered at y=28 to match the
          cluster centerline. */}
      <div className="px-4 sm:px-6 lg:pr-[200px] py-3 lg:py-2 lg:min-h-14 border-b border-red-900/20 bg-black/30 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
        <div className="shrink-0">
          <h2 className="text-xl font-mono font-bold text-white flex items-center gap-2 leading-none">
            <span className="text-red-500">&gt;</span> BOT_LABORATORY
          </h2>
          <p className="text-neutral-500 font-mono text-[10px] mt-1 leading-none">Browse and deploy bots for your servers.</p>
        </div>

        <div className="lg:flex-1 grid grid-cols-2 sm:grid-cols-4 lg:flex lg:justify-center gap-2">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center justify-center gap-2 px-4 py-2 rounded-full border font-mono text-xs tracking-widest uppercase transition-all ${
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
                                {(() => {
                                  const installedOn = myServers.filter(s => (s.bots || []).some(b => b.bot_id === bot.id));
                                  const isConfigurable = bot.code === 'builtin:auto-moderator';
                                  return (
                                    <div className="flex flex-col gap-2">
                                      {isConfigurable && installedOn.length > 0 && (
                                        <button
                                          onClick={() => {
                                            setConfiguringBot({ bot });
                                            setConfigServerId(installedOn[0].id);
                                          }}
                                          className="w-full rounded-md bg-emerald-900/20 border border-emerald-500/40 text-emerald-400 font-mono text-sm tracking-widest uppercase py-2 hover:bg-emerald-500/20 hover:text-emerald-300 transition-all duration-300 flex items-center justify-center gap-2"
                                        >
                                          <Settings size={13} /> [ CONFIGURE ]
                                        </button>
                                      )}
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
                                      <div className="text-[10px] text-neutral-600 text-center font-mono">
                                        {(bot.install_count || 0).toLocaleString()} installs
                                      </div>
                                    </div>
                                  );
                                })()}
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

        </AnimatePresence>
      </ScrollArea>

      {/* Auto Mod configure dialog */}
      <Dialog open={!!configuringBot} onOpenChange={(o) => { if (!o) { setConfiguringBot(null); setConfigServerId(''); } }}>
        <DialogContent className="bg-zinc-900 border-red-900/30 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-mono">
              <span className="text-2xl">🛡️</span> Auto Moderator — Config
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {/* Server selector */}
            {myServers.filter(s => (s.bots || []).some(b => b.bot_id === configuringBot?.bot?.id)).length > 1 && (
              <div>
                <p className="text-[10px] font-mono uppercase text-zinc-500 mb-1.5 tracking-wider">Configure for</p>
                <Select value={configServerId} onValueChange={setConfigServerId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Choose server..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {myServers.filter(s => (s.bots || []).some(b => b.bot_id === configuringBot?.bot?.id)).map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-white">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Spam protection */}
            <div className="bg-black/30 rounded-lg p-4 border border-white/5 space-y-3">
              <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Spam Protection</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300 font-mono">Max messages before flag</span>
                <input
                  type="number" min={2} max={30}
                  value={automodSettings.spamThreshold}
                  onChange={e => setAutomodSettings(p => ({ ...p, spamThreshold: Number(e.target.value) }))}
                  className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm font-mono text-center focus:border-red-500 outline-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300 font-mono">Time window (seconds)</span>
                <input
                  type="number" min={2} max={60}
                  value={automodSettings.spamWindowSecs}
                  onChange={e => setAutomodSettings(p => ({ ...p, spamWindowSecs: Number(e.target.value) }))}
                  className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm font-mono text-center focus:border-red-500 outline-none"
                />
              </div>
            </div>

            {/* Slur filter toggle */}
            <div className="bg-black/30 rounded-lg p-4 border border-white/5">
              <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider mb-3">Slur Filter</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Block built-in slur list</span>
                <button
                  onClick={() => setAutomodSettings(p => ({ ...p, slurFilter: !p.slurFilter }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${automodSettings.slurFilter ? 'bg-red-600' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${automodSettings.slurFilter ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2 font-mono">
                Blocks common slurs server-wide. Use allowed words below to add exceptions.
              </p>
            </div>

            {/* Custom banned words */}
            <div className="bg-black/30 rounded-lg p-4 border border-white/5 space-y-3">
              <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Custom Banned Words</p>
              <div className="flex gap-2">
                <input
                  value={bannedInput}
                  onChange={e => setBannedInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWord('banned_words', bannedInput, setBannedInput); } }}
                  placeholder="Type a word..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm font-mono placeholder-zinc-600 focus:border-red-500 outline-none"
                />
                <button
                  onClick={() => addWord('banned_words', bannedInput, setBannedInput)}
                  className="px-3 py-1.5 bg-red-600/20 border border-red-500/40 rounded text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              {automodSettings.banned_words.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {automodSettings.banned_words.map(w => (
                    <span key={w} className="flex items-center gap-1 bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono px-2 py-0.5 rounded-full">
                      {w}
                      <button onClick={() => removeWord('banned_words', w)} className="text-red-500 hover:text-white">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {automodSettings.banned_words.length === 0 && (
                <p className="text-[11px] text-zinc-600 font-mono">No custom words added yet.</p>
              )}
            </div>

            {/* Allowed words (exceptions) */}
            <div className="bg-black/30 rounded-lg p-4 border border-white/5 space-y-3">
              <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">Allowed Words (exceptions)</p>
              <p className="text-[11px] text-zinc-600 font-mono">Words here are never blocked, even if on the slur list.</p>
              <div className="flex gap-2">
                <input
                  value={allowedInput}
                  onChange={e => setAllowedInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWord('allowed_words', allowedInput, setAllowedInput); } }}
                  placeholder="Type a word..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm font-mono placeholder-zinc-600 focus:border-red-500 outline-none"
                />
                <button
                  onClick={() => addWord('allowed_words', allowedInput, setAllowedInput)}
                  className="px-3 py-1.5 bg-emerald-900/20 border border-emerald-500/40 rounded text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              {automodSettings.allowed_words.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {automodSettings.allowed_words.map(w => (
                    <span key={w} className="flex items-center gap-1 bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-mono px-2 py-0.5 rounded-full">
                      {w}
                      <button onClick={() => removeWord('allowed_words', w)} className="text-emerald-500 hover:text-white">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Save */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 border-zinc-700" onClick={() => { setConfiguringBot(null); setConfigServerId(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => saveAutomodMutation.mutate({ serverId: configServerId, settings: automodSettings })}
                disabled={!configServerId || saveAutomodMutation.isPending}
                className="flex-1 bg-[#FF3333] hover:bg-red-500"
              >
                {saveAutomodMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className="mr-1" />}
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

