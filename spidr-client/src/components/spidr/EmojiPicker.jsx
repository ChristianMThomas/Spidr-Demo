import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Smile, Search, Sparkles, Image } from 'lucide-react';
import { motion } from 'framer-motion';
import GifPicker from './GifPicker';

// Standard emoji categories
const standardEmojis = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
  gestures: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  objects: ['🎮', '🎯', '🎲', '🎸', '🎹', '🎺', '🎻', '🥁', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓']
};

export default function EmojiPicker({ onEmojiSelect, onGifSelect, children, currentUser }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data: allServers = [] } = useQuery({
    queryKey: ['all-servers'],
    queryFn: () => entities.Server.list('-created_date', 100),
  });

  const userServers = useMemo(() => {
    return allServers.filter(server => 
      server.members?.some(m => m.user_id === currentUser?.id)
    );
  }, [allServers, currentUser?.id]);

  const customEmojis = useMemo(() => {
    const emojisByServer = {};
    userServers.forEach(server => {
      if (server.emojis && server.emojis.length > 0) {
        emojisByServer[server.id] = {
          serverName: server.name,
          emojis: server.emojis
        };
      }
    });
    return emojisByServer;
  }, [userServers]);

  const filteredStandardEmojis = useMemo(() => {
    if (!search) return standardEmojis;
    const filtered = {};
    Object.keys(standardEmojis).forEach(category => {
      filtered[category] = standardEmojis[category];
    });
    return filtered;
  }, [search]);

  const filteredCustomEmojis = useMemo(() => {
    if (!search) return customEmojis;
    const filtered = {};
    Object.keys(customEmojis).forEach(serverId => {
      const server = customEmojis[serverId];
      const matchingEmojis = server.emojis.filter(e => 
        e.name.toLowerCase().includes(search.toLowerCase())
      );
      if (matchingEmojis.length > 0) {
        filtered[serverId] = {
          ...server,
          emojis: matchingEmojis
        };
      }
    });
    return filtered;
  }, [customEmojis, search]);

  const handleEmojiClick = (emoji, isCustom = false, emojiData = null) => {
    if (isCustom && emojiData) {
      onEmojiSelect({ type: 'custom', ...emojiData });
    } else {
      onEmojiSelect({ type: 'standard', emoji });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children || (
          <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
            <Smile className="w-5 h-5 text-zinc-400" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-zinc-900 border-red-900/30" align="start">
        {/* Search */}
        <div className="p-3 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emojis..."
              className="pl-10 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
        </div>

        <Tabs defaultValue="custom" className="w-full">
          <TabsList className="w-full bg-zinc-800/50 border-b border-zinc-800">
            <TabsTrigger value="custom" className="flex-1 text-xs">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Server
            </TabsTrigger>
            <TabsTrigger value="standard" className="flex-1 text-xs">
              <Smile className="w-3.5 h-3.5 mr-1" />
              Emoji
            </TabsTrigger>
            {onGifSelect && (
              <TabsTrigger value="gifs" className="flex-1 text-xs">
                <Image className="w-3.5 h-3.5 mr-1" />
                GIFs
              </TabsTrigger>
            )}
          </TabsList>

          <ScrollArea className="h-[300px]">
            {/* Custom Server Emojis */}
            <TabsContent value="custom" className="p-3 space-y-4">
              {Object.keys(filteredCustomEmojis).length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  {search ? 'No emojis found' : 'Join servers to access custom emojis!'}
                </div>
              ) : (
                Object.entries(filteredCustomEmojis).map(([serverId, { serverName, emojis }]) => (
                  <div key={serverId}>
                    <h4 className="text-xs text-zinc-500 font-semibold mb-2 uppercase tracking-wide">
                      {serverName}
                    </h4>
                    <div className="grid grid-cols-8 gap-2">
                      {emojis.map((emoji) => (
                        <motion.button
                          key={emoji.id}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleEmojiClick(null, true, emoji)}
                          className="w-10 h-10 flex items-center justify-center hover:bg-zinc-800 rounded-lg transition-colors"
                          title={`:${emoji.name}:`}
                        >
                          <img 
                            src={emoji.url} 
                            alt={emoji.name}
                            className="w-8 h-8 object-contain"
                          />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Standard Emojis */}
            <TabsContent value="standard" className="p-3 space-y-4">
              {Object.entries(filteredStandardEmojis).map(([category, emojis]) => (
                <div key={category}>
                  <h4 className="text-xs text-zinc-500 font-semibold mb-2 uppercase tracking-wide">
                    {category}
                  </h4>
                  <div className="grid grid-cols-8 gap-2">
                    {emojis.map((emoji) => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleEmojiClick(emoji)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-zinc-800 rounded-lg transition-colors text-2xl"
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* GIFs Tab */}
            {onGifSelect && (
              <TabsContent value="gifs" className="h-[300px]">
                <GifPicker onGifSelect={(url) => { onGifSelect(url); setOpen(false); }} />
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}