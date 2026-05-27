import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GripVertical, Pin } from 'lucide-react';
import { getSpidrProtocolSettings } from './SpidrProtocolSettings';

const BORDER_COLORS = {
  red: { border: 'border-red-600', text: 'text-red-500', accent: 'border-red-600', dot: 'bg-red-600' },
  cyan: { border: 'border-cyan-400', text: 'text-cyan-400', accent: 'border-cyan-400', dot: 'bg-cyan-400' },
  green: { border: 'border-green-500', text: 'text-green-400', accent: 'border-green-500', dot: 'bg-green-500' },
  purple: { border: 'border-purple-500', text: 'text-purple-400', accent: 'border-purple-500', dot: 'bg-purple-500' },
};

const BLUR_MAP = { none: 'backdrop-blur-none', light: 'backdrop-blur-sm', medium: 'backdrop-blur-md', heavy: 'backdrop-blur-xl' };

const GhostMessage = ({ msg, settings }) => {
  const [visible, setVisible] = useState(true);
  const colors = BORDER_COLORS[settings.borderStyle] || BORDER_COLORS.red;

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), (settings.messageDuration || 20) * 1000);
    return () => clearTimeout(timer);
  }, [settings.messageDuration]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          className={`bg-black/60 ${BLUR_MAP[settings.bgBlur] || 'backdrop-blur-md'} border-l-4 ${colors.border} p-3 rounded-r-lg max-w-[90%] shadow-2xl`}
        >
          <div className="flex items-start gap-2">
            {settings.showAvatars !== false && (
              <img 
                src={msg.sender_avatar} 
                alt={msg.sender_name}
                className={`w-8 h-8 rounded-full border-2 ${colors.border}/50`}
              />
            )}
            <div className="flex-1">
              <div className={`font-bold ${colors.text} text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}>
                {msg.sender_name}
              </div>
              <div className="text-white text-sm font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-relaxed">
                {msg.content}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function GhostOverlay({ messages, active, onClose, conversationName, pinned, onTogglePin }) {
  const [settings, setSettings] = useState(getSpidrProtocolSettings);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    const handler = () => setSettings(getSpidrProtocolSettings());
    window.addEventListener('spidr-protocol-settings-changed', handler);
    return () => window.removeEventListener('spidr-protocol-settings-changed', handler);
  }, []);

  // Reset drag offset when position setting changes
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
  }, [settings.position]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY, ox: dragOffset.x, oy: dragOffset.y };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e) => {
      setDragOffset({
        x: startPos.current.ox + (e.clientX - startPos.current.x),
        y: startPos.current.oy + (e.clientY - startPos.current.y),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!active) return null;

  const colors = BORDER_COLORS[settings.borderStyle] || BORDER_COLORS.red;
  const scale = (settings.scale || 100) / 100;
  const opacity = (settings.opacity || 80) / 100;

  const posClasses = {
    'top-right': 'top-0 right-0 flex-col justify-start pt-6 pr-6',
    'top-left': 'top-0 left-0 flex-col justify-start pt-6 pl-6',
    'bottom-right': 'bottom-0 right-0 flex-col-reverse justify-start pb-12 pr-6',
    'bottom-left': 'bottom-0 left-0 flex-col-reverse justify-start pb-12 pl-6',
  };

  const headerPos = {
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
    'bottom-right': 'bottom-12 right-6',
    'bottom-left': 'bottom-12 left-6',
  };

  const pos = settings.position || 'top-right';
  const isTop = pos.startsWith('top');

  return (
    <div
      className={`fixed w-96 z-[9999] pointer-events-none overflow-visible flex ${posClasses[pos]}`}
      style={{
        opacity,
        transform: `scale(${scale}) translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        transformOrigin: pos.includes('right') ? 'top right' : 'top left',
        height: '100vh',
      }}
    >
      {/* Header - Draggable */}
      <div className={`flex items-center gap-3 pointer-events-auto mb-3 ${pos.includes('left') ? '' : 'justify-end'}`}>
        <div
          ref={dragRef}
          onMouseDown={handleMouseDown}
          className={`${colors.text} font-bold text-xs tracking-widest uppercase border-2 ${colors.accent} px-3 py-2 rounded-lg bg-black/80 backdrop-blur-md shadow-lg flex items-center gap-2 cursor-grab active:cursor-grabbing select-none`}
        >
          <GripVertical className="w-3 h-3 opacity-50" />
          <div className={`w-2 h-2 ${colors.dot} rounded-full animate-pulse`} />
          Spidr Protocol
        </div>
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className={`w-8 h-8 bg-black/80 backdrop-blur-md border-2 ${colors.accent} rounded-lg flex items-center justify-center transition-all pointer-events-auto ${pinned ? 'bg-red-600/40' : 'hover:bg-red-600/20'}`}
            title={pinned ? 'Unpin (let it close on navigation)' : 'Pin (keep visible across the app)'}
          >
            <Pin className={`w-4 h-4 ${pinned ? 'text-red-300 fill-red-300' : colors.text}`} />
          </button>
        )}
        <button 
          onClick={onClose}
          className={`w-8 h-8 bg-black/80 backdrop-blur-md border-2 ${colors.accent} rounded-lg flex items-center justify-center hover:bg-red-600 transition-all pointer-events-auto`}
        >
          <X className={`w-4 h-4 ${colors.text} hover:text-white`} />
        </button>
      </div>

      {/* Conversation Name */}
      {settings.showConversationName !== false && conversationName && (
        <div className={`text-zinc-400 text-xs font-medium bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-zinc-700 mb-3 self-${pos.includes('right') ? 'end' : 'start'} pointer-events-none`}>
          {conversationName}
        </div>
      )}

      {/* Messages */}
      <div className={`flex ${isTop ? 'flex-col' : 'flex-col-reverse'} gap-3 pointer-events-none`}>
        <AnimatePresence>
          {messages.slice(-(settings.maxMessages || 8)).map((msg) => (
            <GhostMessage key={msg.id} msg={msg} settings={settings} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}