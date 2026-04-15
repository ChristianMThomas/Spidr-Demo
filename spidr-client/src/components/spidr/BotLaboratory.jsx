import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Sparkles, Shield, Music, Zap, Bot, Plus, Check, Cpu, Globe } from 'lucide-react';
import { toast } from 'sonner';
import MyBotsTab from './MyBotsTab';
import ImportBotTab from './ImportBotTab';

const botCategories = {
  scientists: {
    name: 'Scientists',
    icon: Sparkles,
    color: '#3b82f6',
    bots: [
      {
        id: 'ai-assistant',
        name: 'Spidr AI Assistant',
        description: 'Intelligent chatbot with knowledge retrieval and task automation',
        features: ['Natural language processing', 'Context awareness', 'Task scheduling'],
        icon: '🧠'
      },
      {
        id: 'data-analyst',
        name: 'Data Analyst',
        description: 'Analyze server statistics and generate reports',
        features: ['Analytics dashboard', 'Custom reports', 'Trend analysis'],
        icon: '📊'
      }
    ]
  },
  entertainers: {
    name: 'Entertainers',
    icon: Music,
    color: '#ec4899',
    bots: [
      {
        id: 'music-player',
        name: 'Music Master',
        description: 'Stream music from various platforms with queue management',
        features: ['Multi-platform support', 'Playlist creation', 'Audio effects'],
        icon: '🎵'
      },
      {
        id: 'game-master',
        name: 'Game Master',
        description: 'Host interactive games and trivia for your community',
        features: ['Trivia games', 'Leaderboards', 'Custom games'],
        icon: '🎮'
      }
    ]
  },
  guardians: {
    name: 'Guardians',
    icon: Shield,
    color: '#10b981',
    bots: [
      {
        id: 'moderator',
        name: 'Auto Moderator',
        description: 'Automated moderation with spam detection and auto-actions',
        features: ['Spam filtering', 'Auto-ban', 'Custom rules'],
        icon: '🛡️'
      },
      {
        id: 'welcome-bot',
        name: 'Welcome Bot',
        description: 'Greet new members and assign roles automatically',
        features: ['Custom welcome messages', 'Auto-role assignment', 'DM greetings'],
        icon: '👋'
      }
    ]
  }
};

const TABS = [
  { id: 'store', label: 'BOT STORE', icon: Bot },
  { id: 'my_bots', label: 'MY BOTS', icon: Cpu },
  { id: 'import', label: 'IMPORT (Discord)', icon: Globe },
];

export default function BotLaboratory({ onClose, currentUser }) {
  const [activeTab, setActiveTab] = useState('store');
  const [searchQuery, setSearchQuery] = useState('');
  const [installedBots, setInstalledBots] = useState(new Set());

  // Load installed bots from DB
  useQuery({
    queryKey: ['installed-bots', currentUser?.id],
    queryFn: async () => {
      const recs = await entities.InstalledModule.filter({ user_id: currentUser.id });
      setInstalledBots(new Set(recs.map(r => r.module_id)));
      return recs;
    },
    enabled: !!currentUser?.id,
    staleTime: 30000,
  });

  const handleInstall = async (botId) => {
    try {
      if (!currentUser?.id) { toast.error('Please log in first'); return; }
      await entities.InstalledModule.create({ user_id: currentUser.id, module_id: botId });
      const bot = bots.find(b => b.id === botId);
      if (bot) await entities.CustomBot.update(botId, { install_count: (bot.install_count || 0) + 1 });
      setInstalledBots(prev => new Set([...prev, botId]));
      toast.success('Bot installed successfully!');
    } catch { toast.error('Installation failed'); }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      {/* Header */}
      <div className="p-6 border-b border-red-900/20 bg-zinc-900/50 backdrop-blur-xl">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Bot className="w-8 h-8 text-red-500" />
          Bot Laboratory
        </h2>
        <p className="text-zinc-400">Build, import, and deploy bots for your servers</p>

        {/* Tab Navigation */}
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

      {/* Content */}
      <ScrollArea className="flex-1 p-6">
        <AnimatePresence mode="wait">
          {/* STORE TAB */}
          {activeTab === 'store' && (
            <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Search */}
              <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <Input
                  placeholder="Search bots..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-800/50 border-zinc-700 text-white"
                />
              </div>

              <div className="space-y-8">
                {Object.entries(botCategories).map(([key, category]) => {
                  const Icon = category.icon;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-3 mb-4">
                        <Icon className="w-6 h-6" style={{ color: category.color }} />
                        <h3 className="text-xl font-bold text-white">{category.name}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {category.bots.map((bot, index) => (
                          <motion.div
                            key={bot.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group relative"
                          >
                            <div className="absolute -inset-0.5 bg-gradient-to-r rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur"
                              style={{ backgroundImage: `linear-gradient(90deg, ${category.color}, #dc2626, ${category.color})` }}
                            />
                            <div className="relative bg-zinc-800/90 backdrop-blur-xl rounded-2xl p-5 border border-zinc-700/50 h-full flex flex-col">
                              <div className="mb-4 relative">
                                <motion.div
                                  className="text-6xl transform-gpu"
                                  style={{ filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))', transform: 'rotateX(15deg) rotateY(-15deg)' }}
                                  whileHover={{ scale: 1.1, rotateY: 0, rotateX: 0 }}
                                  transition={{ type: 'spring', stiffness: 300 }}
                                >
                                  {bot.icon}
                                </motion.div>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 rounded-full blur-lg"
                                  style={{ backgroundColor: category.color, opacity: 0.3 }}
                                />
                              </div>
                              <h4 className="text-lg font-bold text-white mb-2">{bot.name}</h4>
                              <p className="text-sm text-zinc-400 mb-4 flex-1">{bot.description}</p>
                              <div className="space-y-1 mb-4">
                                {bot.features.map((feature, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                                    <Zap className="w-3 h-3" style={{ color: category.color }} />
                                    {feature}
                                  </div>
                                ))}
                              </div>
                              <Button
                                onClick={() => handleInstall(bot.id)}
                                disabled={installedBots.has(bot.id)}
                                className={`w-full transition-all ${
                                  installedBots.has(bot.id) ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                                }`}
                              >
                                {installedBots.has(bot.id) ? (
                                  <><Check className="w-4 h-4 mr-2" /> Installed</>
                                ) : (
                                  <><Plus className="w-4 h-4 mr-2" /> Quick Install</>
                                )}
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* MY BOTS TAB */}
          {activeTab === 'my_bots' && (
            <motion.div key="my_bots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MyBotsTab currentUser={currentUser} />
            </motion.div>
          )}

          {/* IMPORT TAB */}
          {activeTab === 'import' && (
            <motion.div key="import" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ImportBotTab currentUser={currentUser} />
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}