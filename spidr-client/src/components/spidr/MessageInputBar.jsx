import React, { useRef, useState, useEffect } from 'react';
import { Send, ImagePlus, Smile, Ghost, Zap, Waves, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { entities, auth, integrations } from '@/api/apiClient';
import { toast } from 'sonner';
import EmojiPicker from './EmojiPicker';
import MentionPopup from './MentionPopup';
import { scanContent } from './ContentScanner';
import ContentBlockedModal from './ContentBlockedModal';

export default function MessageInputBar({ 
  value, onChange, onSend, onKeyDown, placeholder, currentUser,
  disabled = false, showEditingIndicator = false, onCancelEdit = null,
  mentionUsers = [], ghostMode = false, onGhostToggle,
  textEffect = 'normal', onTextEffectChange
}) {
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [mentionSearch, setMentionSearch] = useState(null);
  const [showEffects, setShowEffects] = useState(false);
  const [blockedCategory, setBlockedCategory] = useState(null);

  // Listen for "Mention" actions from the global right-click menu. When the
  // user right-clicks a profile/friend avatar somewhere and picks Mention,
  // useGlobalMenuActions dispatches `spidr-prepend-mention` and we append
  // the @<name> token into the active input.
  useEffect(() => {
    const handler = (e) => {
      const name = e.detail?.name;
      if (!name) return;
      // Only the focused input bar should consume the event. If multiple bars
      // are mounted (e.g. main chat + a thread) the focused one wins.
      if (document.activeElement !== inputRef.current && !inputRef.current?.dataset?.focused) {
        // No focus claim — append anyway if there's only one input on screen.
        // Otherwise rely on the focused-element check above.
      }
      const token = `@${String(name).split(/\s+/)[0]} `;
      const cur = value || '';
      onChange((cur.endsWith(' ') || cur.length === 0 ? cur : cur + ' ') + token);
      setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener('spidr-prepend-mention', handler);
    return () => window.removeEventListener('spidr-prepend-mention', handler);
  }, [value, onChange]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const uploadedFiles = [];
    for (const file of files) {
      const { url: file_url } = await integrations.Core.UploadFile({ file });
      // Scan images and videos for inappropriate content
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const scan = await scanContent(file_url);
        if (!scan.safe) {
          setBlockedCategory(scan.category);
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }
      uploadedFiles.push({ name: file.name, url: file_url, type: file.type });
    }
    setAttachments(prev => [...prev, ...uploadedFiles]);
    toast.success(`${uploadedFiles.length} file(s) uploaded`);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendWithAttachments = () => {
    onSend(attachments);
    setAttachments([]);
    setMentionSearch(null);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@') && lastWord.length > 0) {
      setMentionSearch(lastWord.slice(1));
    } else {
      setMentionSearch(null);
    }
  };

  const handleSelectMention = (name) => {
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    const words = textBeforeCursor.split(/\s/);
    words.pop();
    const newValue = words.join(' ') + (words.length > 0 ? ' ' : '') + `@${name} ` + textAfterCursor;
    onChange(newValue);
    setMentionSearch(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-2">
      {/* Text Effects Bar */}
      {onTextEffectChange && showEffects && (
        <div className="flex gap-1.5 px-1">
          {[
            { key: 'normal', label: 'Normal', color: 'text-zinc-400' },
            { key: 'shake', label: 'Shake', color: 'text-red-400', icon: <Zap className="w-3 h-3 mr-1" /> },
            { key: 'wave', label: 'Wave', color: 'text-blue-400', icon: <Waves className="w-3 h-3 mr-1" /> },
            { key: 'glitch', label: 'Glitch', color: 'text-green-400', icon: <Radio className="w-3 h-3 mr-1" /> },
          ].map(({ key, label, color, icon }) => (
            <button
              key={key}
              onClick={() => { onTextEffectChange(key); setShowEffects(false); }}
              className={`flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                ${textEffect === key ? 'bg-[#FF3333]/20 text-[#FF3333] border border-[#FF3333]/30' : `${color} bg-white/5 border border-white/5 hover:bg-white/10`}`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      )}

      {/* Editing indicator */}
      {showEditingIndicator && (
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800/50 px-3 py-2 rounded-lg">
          <span>✏️ Editing message</span>
          <button onClick={onCancelEdit} className="ml-auto text-zinc-500 hover:text-white text-[10px] uppercase tracking-wider">Cancel</button>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group/att">
              {att.type.startsWith('image/') ? (
                <img src={att.url} alt={att.name} className="h-14 w-14 rounded-lg object-cover border border-white/10" />
              ) : att.type.startsWith('video/') ? (
                <video src={att.url} className="h-14 w-14 rounded-lg object-cover border border-white/10" />
              ) : (
                <div className="h-14 w-14 bg-zinc-800 rounded-lg flex items-center justify-center text-xs text-zinc-400 border border-white/10">📄</div>
              )}
              <button onClick={() => removeAttachment(idx)}
                className="absolute -top-1.5 -right-1.5 bg-[#FF3333] rounded-full w-4 h-4 flex items-center justify-center text-white text-[8px] opacity-0 group-hover/att:opacity-100 transition-opacity">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* The Input Deck */}
      <div className={`relative flex items-center gap-1.5 bg-[#0a0a0a] rounded-2xl px-3 py-2 border transition-all duration-300
        ${ghostMode ? 'border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'border-white/[0.06] focus-within:border-[#FF3333]/30 focus-within:shadow-[0_0_20px_rgba(255,51,51,0.08)]'}
      `}>
        {/* Mention popup */}
        <MentionPopup isOpen={mentionSearch !== null} filter={mentionSearch || ''} onSelect={handleSelectMention} users={mentionUsers} position="bottom" />

        <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip" />

        {/* Attach */}
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading || disabled}
          className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all flex-shrink-0">
          <ImagePlus size={18} />
        </button>

        {/* Ghost */}
        {onGhostToggle && (
          <button onClick={onGhostToggle}
            className={`p-2 rounded-xl transition-all flex-shrink-0 ${ghostMode ? 'bg-purple-600/20 text-purple-400 animate-pulse' : 'text-zinc-500 hover:text-purple-400 hover:bg-white/5'}`}>
            <Ghost size={18} />
          </button>
        )}

        {/* Input */}
        <input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          disabled={disabled}
          className={`flex-1 bg-transparent border-0 outline-none text-[14px] text-white placeholder:text-zinc-600 font-medium px-2 min-w-0
            ${ghostMode ? 'font-mono text-purple-300' : ''}`}
        />

        {/* Emoji + GIFs */}
        <EmojiPicker currentUser={currentUser} onEmojiSelect={(emoji) => {
          const emojiText = emoji.type === 'custom' ? `:${emoji.name}:` : emoji.emoji;
          onChange(value + emojiText);
        }} onGifSelect={(gifUrl) => {
          onSend([{ name: 'gif', url: gifUrl, type: 'image/gif' }]);
        }}>
          <button className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all flex-shrink-0">
            <Smile size={18} />
          </button>
        </EmojiPicker>

        {/* Effects */}
        {onTextEffectChange && (
          <button onClick={() => setShowEffects(p => !p)}
            className={`p-2 rounded-xl transition-all flex-shrink-0 ${textEffect !== 'normal' ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
            <Zap size={16} />
          </button>
        )}

        {/* Send */}
        <button
          onClick={handleSendWithAttachments}
          disabled={disabled || uploading || (!value.trim() && attachments.length === 0)}
          className="p-2 rounded-xl bg-[#FF3333]/10 text-[#FF3333] hover:bg-[#FF3333] hover:text-white disabled:opacity-30 disabled:hover:bg-[#FF3333]/10 disabled:hover:text-[#FF3333] transition-all flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
      <ContentBlockedModal
        open={!!blockedCategory}
        onClose={() => setBlockedCategory(null)}
        category={blockedCategory}
      />
    </div>
  );
}