import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Sparkles, Shield, Music, Bot, Plus, Check, Cpu, Loader2 } from 'lucide-react';
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
      const servers = await entities.Server.filter({ id: serverId });
      const server = servers[0];
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
    <div className="flex-1 flex flex-col bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Header */}
      <div className="p-6 border-b border-red-900/20 bg-zinc-900/50 backdrop-blur-xl">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Bot className="w-8 h-8 text-red-500" />
          Bot Laboratory
        </h2>
        <p className="text-zinc-400">Build, import, and deploy bots for your servers</p>

        <div className="flex gap-1 mt-4 bg-zinc-800/50 rounded-xl p-1 w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#FF3333] text-white shadow-lg shadow-red-900/30'
                    : 'text-zinc-500 hover:text-white hover:bg-zinc-700/50'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'store' && (
            <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  placeholder="Search bots..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800/50 border-zinc-700 text-white"
                />
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
                        <div className="flex items-center gap-3 mb-4">
                          <Icon className="w-6 h-6" style={{ color: meta.color }} />
                          <h3 className="text-xl font-bold text-white">{meta.name}</h3>
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
                              <div className="absolute -inset-0.5 bg-gradient-to-r rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur"
                                style={{ backgroundImage: `linear-gradient(90deg, ${meta.color}, #dc2626, ${meta.color})` }}
                              />
                              <div className="relative bg-zinc-800/90 backdrop-blur-xl rounded-2xl p-5 border border-zinc-700/50 h-full flex flex-col">
                                <div className="mb-4 relative">
                                  <motion.div
                                    className="text-6xl transform-gpu"
                                    style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))', transform: 'rotateX(15deg) rotateY(-15deg)' }}
                                    whileHover={{ scale: 1.1, rotateY: 0, rotateX: 0 }}
                                    transition={{ type: 'spring', stiffness: 300 }}
                                  >
                                    {bot.icon_emoji || '🤖'}
                                  </motion.div>
                                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 rounded-full blur-lg"
                                    style={{ backgroundColor: meta.color, opacity: 0.3 }}
                                  />
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-lg font-bold text-white">{bot.name}</h4>
                                  {bot.is_official && (
                                    <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-500/30">
                                      Official
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-zinc-400 mb-4 flex-1">{bot.description}</p>
                                <div className="space-y-1 mb-4">
                                  {(bot.features || []).slice(0, 3).map((feature, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                                      <Sparkles className="w-3 h-3" style={{ color: meta.color }} />
                                      {feature}
                                    </div>
                                  ))}
                                </div>
                                <Button
                                  onClick={() => {
                                    if (myServers.length === 0) {
                                      toast.error('Join or create a server first to install bots');
                                      return;
                                    }
                                    setInstallingBot(bot);
                                    setSelectedServerId(myServers[0].id);
                                  }}
                                  className="bg-[#FF3333] hover:bg-red-500 text-white w-full"
                                  size="sm"
                                >
                                  <Plus size={14} className="mr-1" /> Install to Server
                                </Button>
                                <div className="text-[10px] text-zinc-600 text-center mt-2">
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
