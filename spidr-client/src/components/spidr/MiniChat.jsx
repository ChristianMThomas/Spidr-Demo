import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';

export default function MiniChat({ server, channel, onClose }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 80 });
  const [isDragging, setIsDragging] = useState(false);

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', server?.id, channel?.id],
    queryFn: () => entities.Message.filter({ 
      server_id: server.id, 
      channel_id: channel.id 
    }, '-created_date', 20),
    enabled: !!server && !!channel,
    staleTime: 30000,
  });

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(e.clientX, window.innerWidth - 300)),
          y: Math.max(0, Math.min(e.clientY, window.innerHeight - 400))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!server || !channel) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.2, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        whileHover={{ opacity: 1 }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        className="w-80 bg-black/80 backdrop-blur-xl border border-red-900/30 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto"
        onMouseDown={handleMouseDown}
      >
        {/* Header */}
        <div className="drag-handle flex items-center justify-between p-3 border-b border-red-900/20 bg-zinc-900/50 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {server.name} • #{channel.name}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-zinc-700 rounded transition-colors"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4 text-zinc-400" /> : <Minimize2 className="w-4 h-4 text-zinc-400" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-700 rounded transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Messages */}
        {!isMinimized && (
          <ScrollArea className="h-96 p-3">
            <div className="space-y-2">
              {[...messages].reverse().map((msg) => (
                <div key={msg.id} className="text-xs">
                  <span className="font-semibold text-red-400">{msg.author_name}: </span>
                  <span className="text-zinc-300">{msg.content}</span>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-zinc-500 text-xs text-center py-8">No messages</p>
              )}
            </div>
          </ScrollArea>
        )}
      </motion.div>
    </AnimatePresence>
  );
}