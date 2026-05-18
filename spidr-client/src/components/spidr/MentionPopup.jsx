import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function MentionPopup({ 
  isOpen, 
  filter = '', 
  onSelect, 
  users = [], 
  position = 'bottom' 
}) {
  if (!isOpen) return null;

  const specialMentions = [
    { id: 'everyone', name: 'everyone', role: 'special', description: 'Notify all server members' },
    { id: 'here', name: 'here', role: 'special', description: 'Notify online members' }
  ];

  // Drop any users that come in without a usable name — otherwise the .toLowerCase()
  // filter below would throw and crash the @ popup entirely.
  const safeUsers = users.filter(u => u && typeof u.name === 'string' && u.name.trim().length > 0);
  const allOptions = [...specialMentions, ...safeUsers];
  const filtered = allOptions.filter(u =>
    u.name.toLowerCase().includes((filter || '').toLowerCase())
  ).slice(0, 8);

  if (filtered.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: position === 'bottom' ? 10 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: position === 'bottom' ? 10 : -10 }}
        className={`absolute ${position === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 w-72`}
      >
        <div className="px-3 py-2 bg-[#FF3333]/10 text-[10px] font-bold text-[#FF3333] uppercase flex items-center gap-2">
          <span className="w-2 h-2 bg-[#FF3333] rounded-full animate-pulse" />
          Signal Target
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((user, i) => (
            <button
              key={i}
              onClick={() => onSelect(user.name)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#222] text-left transition-colors"
            >
              {user.role === 'special' ? (
                <div className="w-8 h-8 rounded bg-[#FF3333] flex items-center justify-center font-bold text-white text-sm">
                  @
                </div>
              ) : (
                <Avatar className="w-8 h-8">
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} />
                  ) : (
                    <AvatarFallback className="bg-zinc-700 text-white text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm truncate ${user.role === 'special' ? 'text-[#FF3333]' : 'text-white'}`}>
                  @{user.name}
                </div>
                <div className="text-[10px] text-gray-500 uppercase truncate">
                  {user.description || user.role || 'member'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}