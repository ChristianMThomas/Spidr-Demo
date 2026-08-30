import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function MentionPopup({ 
  isOpen, 
  filter = '', 
  onSelect, 
  users = [], 
  position = 'bottom',
  anchorRef = null,
}) {
  // Anchor rect, measured from the input bar. The popup renders through a
  // PORTAL to <body> rather than inline: as a normal child it sat inside the
  // composer, so any ancestor with overflow-hidden clipped it and any
  // sibling that created a stacking context could paint over it — the
  // "popup trapped under the chat box" bug. z-index alone can't fix that,
  // because z-index only competes inside its own stacking context. The
  // command palette in MessageInputBar already uses this exact approach.
  const [rect, setRect] = React.useState(null);
  React.useEffect(() => {
    if (!isOpen) return;
    const measure = () => {
      const el = anchorRef?.current;
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, anchorRef]);

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

  // Without a measured anchor fall back to the old inline behaviour rather
  // than rendering the popup somewhere arbitrary.
  const usePortal = !!rect;
  const body = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: position === 'bottom' ? 10 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: position === 'bottom' ? 10 : -10 }}
        style={usePortal ? {
          position: 'fixed',
          left: rect.left,
          // Sit the popup's BOTTOM edge on the input's TOP edge, with an 8px
          // gap — the fixed-position equivalent of bottom-full mb-2.
          bottom: window.innerHeight - rect.top + 8,
          zIndex: 2000,
        } : undefined}
        className={`${usePortal ? '' : `absolute ${position === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 z-50`} bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-72`}
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

  return usePortal ? createPortal(body, document.body) : body;
}