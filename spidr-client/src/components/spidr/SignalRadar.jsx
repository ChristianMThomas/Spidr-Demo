import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X, Users, Radio, Wifi } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['All Signals', 'Gaming', 'Social', 'Tech', 'Creative', 'Study', 'Other'];

export default function SignalRadar({ open, onClose, currentUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyIndex, setFrequencyIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [radarTab, setRadarTab] = useState('discover');

  const { data: servers = [] } = useQuery({
    queryKey: ['public-servers'],
    queryFn: () => entities.Server.list('-created_date', 100),
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-radar', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !!currentUser?.id,
  });

  const friendIds = React.useMemo(() => new Set(friends.map(f => f.friend_id)), [friends]);

  const friendServers = React.useMemo(() => {
    return servers.filter(server => 
      server.members?.some(m => friendIds.has(m.user_id))
    ).map(server => ({
      ...server,
      _friendsInServer: server.members?.filter(m => friendIds.has(m.user_id)) || []
    }));
  }, [servers, friendIds]);

  const handleFrequencyChange = (value) => {
    const newIndex = value[0];
    if (newIndex !== frequencyIndex) {
      setIsTransitioning(true);
      setFrequencyIndex(newIndex);
      setSelectedCategory(CATEGORIES[newIndex]);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const filteredServers = servers.filter(server => {
    const matchesSearch = !searchTerm || 
      server.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'All Signals' || 
      server.category?.toLowerCase() === selectedCategory.toLowerCase() ||
      server.description?.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory && server.is_public !== false;
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        {/* Blurred Background */}
        <div className="absolute inset-0 bg-black/80" />

        {/* HUD Container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="relative w-full h-full max-w-7xl max-h-[90vh] m-8"
        >
          {/* HUD Frame */}
          <div className="relative w-full h-full bg-zinc-950/90 border-2 border-red-600/50 rounded-lg shadow-2xl overflow-hidden">
            {/* Corner Accents */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-red-500" />
            <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-red-500" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-red-500" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-red-500" />

            {/* Header */}
            <div className="relative z-10 border-b-2 border-red-900/50 p-6 bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SonarIcon />
                  <div>
                    <h2 className="text-2xl font-bold text-red-500 tracking-wider">SIGNAL RADAR</h2>
                    <p className="text-zinc-500 text-sm">Scanning for active communities...</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-red-500 hover:bg-red-950/50"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              {/* Search */}
              <div className="mt-4">
                <Input
                  placeholder="Search signals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-zinc-800 border-red-900/50 text-white placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* Tabs: Discover / Friends' Servers */}
            <div className="relative z-10 px-6 pt-4 border-b-2 border-red-900/50 bg-zinc-900/30">
              <Tabs value={radarTab} onValueChange={setRadarTab}>
                <TabsList className="bg-zinc-800/50 border border-red-900/20">
                  <TabsTrigger value="discover" className="data-[state=active]:bg-red-600 font-mono text-xs tracking-wider">
                    <Radio className="w-3 h-3 mr-1.5" /> DISCOVER
                  </TabsTrigger>
                  <TabsTrigger value="friends" className="data-[state=active]:bg-red-600 font-mono text-xs tracking-wider">
                    <Users className="w-3 h-3 mr-1.5" /> FRIENDS' SERVERS
                    {friendServers.length > 0 && (
                      <span className="ml-1.5 bg-red-500/80 text-white text-[9px] px-1.5 py-0.5 rounded-full">{friendServers.length}</span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {radarTab === 'discover' && (
              <>
                {/* Frequency Tuner */}
                <div className="relative z-10 p-6 border-b-2 border-red-900/50 bg-zinc-900/30">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-red-400 font-mono text-sm tracking-wider">
                        FREQUENCY: {selectedCategory.toUpperCase()}
                      </label>
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                        <span className="text-green-500 text-xs font-mono">ONLINE</span>
                      </div>
                    </div>
                    <Slider
                      value={[frequencyIndex]}
                      onValueChange={handleFrequencyChange}
                      max={CATEGORIES.length - 1}
                      step={1}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-zinc-600 font-mono">
                      {CATEGORIES.map((cat, i) => (
                        <span 
                          key={i} 
                          className={i === frequencyIndex ? 'text-red-400' : ''}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Server Grid */}
                <div className="relative z-10 p-6 overflow-y-auto" style={{ height: 'calc(100% - 330px)' }}>
                  <AnimatePresence mode="wait">
                    {isTransitioning ? (
                      <TVStaticTransition key="transition" />
                    ) : (
                      <motion.div
                        key={selectedCategory}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                      >
                        {filteredServers.length === 0 ? (
                          <div className="col-span-full text-center py-12">
                            <Radio className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                            <p className="text-zinc-500">No signals detected on this frequency...</p>
                          </div>
                        ) : (
                          filteredServers.map((server) => (
                            <ServerDataPacket 
                              key={server.id} 
                              server={server} 
                              currentUser={currentUser} 
                            />
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            {radarTab === 'friends' && (
              <div className="relative z-10 p-6 overflow-y-auto" style={{ height: 'calc(100% - 220px)' }}>
                {friendServers.length === 0 ? (
                  <div className="text-center py-16">
                    <Users className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500 font-mono">No friend signals detected...</p>
                    <p className="text-zinc-600 text-sm mt-1">Your friends haven't joined any servers yet.</p>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    {friendServers.map((server) => (
                      <ServerDataPacket 
                        key={server.id} 
                        server={server} 
                        currentUser={currentUser}
                        friendsInServer={server._friendsInServer}
                      />
                    ))}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SonarIcon() {
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      {/* Pulsing Rings */}
      <motion.div
        animate={{
          scale: [1, 2, 2],
          opacity: [0.5, 0.2, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut"
        }}
        className="absolute inset-0 rounded-full border-2 border-red-500"
      />
      <motion.div
        animate={{
          scale: [1, 2, 2],
          opacity: [0.5, 0.2, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: 0.5,
          ease: "easeOut"
        }}
        className="absolute inset-0 rounded-full border-2 border-red-500"
      />
      {/* Center Dot */}
      <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
    </div>
  );
}

function TVStaticTransition() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <div 
        className="w-full h-full"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255, 255, 255, 0.03) 2px,
            rgba(255, 255, 255, 0.03) 4px
          )`,
          animation: 'static 0.1s infinite'
        }}
      />
      <style>{`
        @keyframes static {
          0% { background-position: 0 0; }
          100% { background-position: 0 100%; }
        }
      `}</style>
    </motion.div>
  );
}

function ServerDataPacket({ server, currentUser, friendsInServer }) {
  const memberCount = server.members?.length || 0;
  const signalStrength = Math.min(Math.floor(memberCount / 5) + 1, 5);
  const isActive = memberCount > 10;

  const handleJoin = async () => {
    try {
      const isAirlockEnabled = server.airlock?.enabled;
      const updatedMembers = [
        ...(server.members || []),
        {
          user_id: currentUser?.id,
          user_name: currentUser?.full_name,
          user_avatar: currentUser?.avatar_url,
          role: 'member',
          verified: !isAirlockEnabled
        }
      ];
      await entities.Server.update(server.id, { members: updatedMembers });
      toast.success(isAirlockEnabled 
        ? 'Joined server — awaiting verification from admins.' 
        : 'Signal acquired! Joined server.');
    } catch (error) {
      toast.error('Failed to join server');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="group relative"
    >
      {/* Hexagonal Card */}
      <div 
        className="relative bg-gradient-to-br from-zinc-900 to-zinc-950 border-2 border-red-900/30 p-4 overflow-hidden"
        style={{
          clipPath: 'polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)'
        }}
      >
        {/* Scanline Effect */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="w-full h-px bg-red-500 animate-pulse" style={{ animation: 'scanline 2s linear infinite' }} />
        </div>

        {/* Icon */}
        {server.icon_url ? (
          <img 
            src={server.icon_url} 
            alt={server.name}
            className="w-16 h-16 rounded-lg mb-3 border border-red-900/50"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg mb-3 bg-red-950/50 border border-red-900/50 flex items-center justify-center">
            <Wifi className="w-8 h-8 text-red-500" />
          </div>
        )}

        {/* Name & Badges */}
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-white font-bold truncate">{server.name}</h3>
          {server.verified && (
            <div className="px-1.5 py-0.5 bg-blue-600 rounded text-[10px] font-bold text-white">✓</div>
          )}
          {server.boost_level > 0 && (
            <div className="px-1.5 py-0.5 bg-purple-600 rounded text-[10px] font-bold text-white">
              ⚡{server.boost_level}
            </div>
          )}
        </div>
        <p className="text-zinc-500 text-sm mb-2 line-clamp-2 h-10">
          {server.description || 'No description available'}
        </p>

        {/* Tags */}
        {server.tags && server.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {server.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded-full text-[10px] text-zinc-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Signal Strength */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-600 font-mono">SIGNAL STRENGTH</span>
            <span className="text-xs text-green-500 font-mono">{memberCount} ACTIVE</span>
          </div>
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < signalStrength 
                    ? isActive ? 'bg-green-500' : 'bg-yellow-500'
                    : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Friends in server badge */}
        {friendsInServer && friendsInServer.length > 0 && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-purple-950/40 border border-purple-500/30 rounded-lg">
            <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <div className="flex -space-x-2 shrink-0">
              {friendsInServer.slice(0, 4).map((m, i) => (
                m.user_avatar ? (
                  <img key={i} src={m.user_avatar} className="w-5 h-5 rounded-full border border-zinc-900 object-cover" />
                ) : (
                  <div key={i} className="w-5 h-5 rounded-full border border-zinc-900 bg-purple-800 flex items-center justify-center text-[8px] text-white font-bold">
                    {m.user_name?.charAt(0)}
                  </div>
                )
              ))}
            </div>
            <span className="text-purple-300 text-[10px] font-mono truncate">
              {friendsInServer.length} friend{friendsInServer.length !== 1 ? 's' : ''} here
            </span>
          </div>
        )}

        {/* Join Button */}
        <Button
          onClick={handleJoin}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-mono tracking-wider"
          size="sm"
        >
          <Radio className="w-4 h-4 mr-2" />
          CONNECT
        </Button>

        {/* Hover Glow */}
        <div className="absolute inset-0 border-2 border-red-500/0 group-hover:border-red-500/50 transition-all pointer-events-none"
          style={{
            clipPath: 'polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)'
          }}
        />
      </div>

      <style>{`
        @keyframes scanline {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </motion.div>
  );
}