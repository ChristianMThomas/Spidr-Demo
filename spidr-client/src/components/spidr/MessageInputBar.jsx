import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, ImagePlus, Smile, Ghost, Zap, Waves, Radio, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { entities, auth, integrations } from '@/api/apiClient';
import { toast } from 'sonner';
import EmojiPicker from './EmojiPicker';
import MentionPopup from './MentionPopup';
import VoiceRecorder from './VoiceRecorder';
import { scanContent } from './ContentScanner';
import ContentBlockedModal from './ContentBlockedModal';

export default function MessageInputBar({
  value, onChange, onSend, onKeyDown, placeholder, currentUser,
  disabled = false, showEditingIndicator = false, onCancelEdit = null,
  mentionUsers = [], ghostMode = false, onGhostToggle,
  textEffect = 'normal', onTextEffectChange,
  commands = [],
}) {
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [mentionSearch, setMentionSearch] = useState(null);
  const [showEffects, setShowEffects] = useState(false);
  const [blockedCategory, setBlockedCategory] = useState(null);
  const [cmdSuggestions, setCmdSuggestions] = useState([]);
  const [cmdSelectedIdx, setCmdSelectedIdx] = useState(0);
  const cmdListRef = useRef(null);
  const deckRef = useRef(null);
  // Viewport-relative rect of the input deck, used to position the portaled
  // command popup. The popup is rendered into document.body so it escapes the
  // chat panel's `overflow-hidden` clip — see ServersPanel "Message Input"
  // wrapper. Tracked as state so a window resize re-renders the popup.
  const [deckRect, setDeckRect] = useState(null);

  useLayoutEffect(() => {
    if (cmdSuggestions.length === 0 || !deckRef.current) return;
    const update = () => {
      const r = deckRef.current?.getBoundingClientRect();
      if (r) setDeckRect({ left: r.left, width: r.width, top: r.top });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [cmdSuggestions.length]);

  // Keep the keyboard-highlighted command card in view when the popup scrolls.
  useEffect(() => {
    if (cmdSuggestions.length === 0 || !cmdListRef.current) return;
    const el = cmdListRef.current.querySelector(`[data-cmd-idx="${cmdSelectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cmdSelectedIdx, cmdSuggestions.length]);

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
    setCmdSuggestions([]);
  };

  const handleKeyDown = (e) => {
    if (cmdSuggestions.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCmdSelectedIdx(i => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCmdSelectedIdx(i => Math.min(cmdSuggestions.length - 1, i + 1));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && cmdSuggestions.length > 0)) {
        e.preventDefault();
        selectCommand(cmdSuggestions[cmdSelectedIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setCmdSuggestions([]);
        return;
      }
    }
    // Escape cancels an in-progress edit. The bar advertises "esc to cancel",
    // so that has to be real — previously Escape only dismissed the command
    // palette and the keypress fell through with nothing listening for it.
    if (e.key === 'Escape' && showEditingIndicator && onCancelEdit) {
      e.preventDefault();
      onCancelEdit();
      return;
    }
    onKeyDown?.(e);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);

    // Command suggestions — only trigger when the input starts with /
    // and the cursor hasn't moved past the first word yet.
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    if (val.startsWith('/') && commands.length > 0 && !textBeforeCursor.includes(' ')) {
      const query = val.toLowerCase();
      const filtered = commands.filter(c => c.trigger.toLowerCase().startsWith(query)).slice(0, 30);
      setCmdSuggestions(filtered);
      setCmdSelectedIdx(0);
    } else {
      setCmdSuggestions([]);
    }

    // Mention suggestions
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('@') && lastWord.length > 0) {
      setMentionSearch(lastWord.slice(1));
    } else {
      setMentionSearch(null);
    }
  };

  const selectCommand = (cmd) => {
    onChange(cmd.trigger + ' ');
    setCmdSuggestions([]);
    setTimeout(() => inputRef.current?.focus(), 0);
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

      {/* Editing indicator — a symbiote clamp over the composer. The border
          aura breathes and a highlight crawls the top edge; the bar sits
          flush on the input below it (no bottom rounding) so it reads as a
          physical extension rather than a floating box. */}
      {showEditingIndicator && (
        <div
          className="symbiote-edit relative overflow-hidden flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
          style={{
            background: 'linear-gradient(180deg, rgba(30,8,8,0.92) 0%, rgba(10,10,10,0.92) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
          }}
        >
          {/* Left: sharp vector pencil + status. No OS emoji — those render
              differently on every platform and read as a web template. */}
          <div className="flex items-center gap-2.5 min-w-0">
            <svg
              className="w-3.5 h-3.5 text-red-500 shrink-0"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="square" strokeLinejoin="miter" viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M17 3l4 4L7 21H3v-4L17 3z" />
              <path d="M14 6l4 4" />
            </svg>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-xs font-bold text-red-400">Editing message</span>
              <span className="text-[10px] text-white/35 font-mono">esc to cancel</span>
            </div>
          </div>

          {/* Right: explicit cancel pill */}
          <button
            onClick={onCancelEdit}
            className="shrink-0 flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[10px] font-black tracking-widest uppercase text-white/60 hover:text-white hover:border-white/25 hover:bg-white/[0.08] transition-all"
          >
            Cancel
            <X size={11} />
          </button>
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
      <div ref={deckRef} className={`relative flex items-center gap-1.5 bg-[#0a0a0a] rounded-2xl px-3 py-2 border transition-all duration-300
        ${ghostMode ? 'border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'border-white/[0.06] focus-within:border-[#FF3333]/30 focus-within:shadow-[0_0_20px_rgba(255,51,51,0.08)]'}
      `}>
        {/* Command suggestions — Discord-style grouped cards.
            Suggestions are pre-filtered (installed bots + user permission); here
            we just visually group consecutive items by botName and render an
            avatar + command + bot label per row. Keyboard nav stays on the
            flat cmdSuggestions array via cmdSelectedIdx.
            The popup is portaled to document.body so it escapes the
            `overflow-hidden` chat-input wrapper; position is computed from
            deckRect (viewport coords). */}
        {cmdSuggestions.length > 0 && deckRect && createPortal((() => {
          const groups = [];
          let lastBot = null;
          cmdSuggestions.forEach((cmd, i) => {
            if (cmd.botName !== lastBot) {
              groups.push({ botName: cmd.botName, botIcon: cmd.botIcon, botColor: cmd.botColor, items: [] });
              lastBot = cmd.botName;
            }
            groups[groups.length - 1].items.push({ cmd, flatIdx: i });
          });
          return (
            <div
              ref={cmdListRef}
              style={{
                position: 'fixed',
                left: deckRect.left,
                width: deckRect.width,
                bottom: window.innerHeight - deckRect.top + 8,
              }}
              className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[9999] max-h-[420px] overflow-y-auto"
            >
              <div className="sticky top-0 px-3 py-2 bg-gradient-to-r from-[#1a0a0a] to-[#0a0a0a] border-b border-white/[0.06] text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                Bot Commands
                <span className="ml-auto text-zinc-600 normal-case tracking-normal font-medium">
                  ↑↓ navigate · ↵ select · esc dismiss
                </span>
              </div>
              {groups.map((group) => (
                <div key={group.botName}>
                  <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] flex-shrink-0"
                      style={{ backgroundColor: `${group.botColor}33`, border: `1px solid ${group.botColor}55` }}
                    >
                      {group.botIcon}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">{group.botName}</span>
                  </div>
                  {group.items.map(({ cmd, flatIdx }) => (
                    <button
                      key={cmd.trigger}
                      data-cmd-idx={flatIdx}
                      onMouseEnter={() => setCmdSelectedIdx(flatIdx)}
                      onClick={() => selectCommand(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors border-l-2 ${
                        flatIdx === cmdSelectedIdx
                          ? 'bg-white/[0.07] border-[#FF3333]'
                          : 'border-transparent hover:bg-white/[0.04]'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 shadow-sm"
                        style={{
                          backgroundColor: `${group.botColor}22`,
                          border: `1px solid ${group.botColor}55`,
                        }}
                      >
                        {group.botIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-white font-semibold leading-tight">
                          {cmd.trigger}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate leading-tight mt-0.5">
                          {cmd.description}
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-medium flex-shrink-0 uppercase tracking-wider">
                        {group.botName}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          );
        })(), document.body)}

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
          onKeyDown={handleKeyDown}
          onPaste={async (e) => {
            // 1. Direct image on the clipboard (Ctrl+C an image from the OS) →
            //    upload and attach as a normal image attachment.
            const item = [...(e.clipboardData?.items || [])].find(it => it.type?.startsWith('image/'));
            if (item) {
              e.preventDefault();
              const file = item.getAsFile();
              if (file) {
                setUploading(true);
                try {
                  const { url } = await integrations.Core.UploadFile({ file });
                  setAttachments(prev => [...prev, { name: file.name || 'pasted-image', url, type: file.type }]);
                } catch {
                  toast.error('Could not upload pasted image');
                } finally {
                  setUploading(false);
                }
              }
              return;
            }

            // 2. Pasted text that looks like an image/gif/video URL → attach it
            //    directly without re-uploading. Recognizes common image
            //    extensions and the platform's own CDN (pub-*.r2.dev).
            const text = e.clipboardData?.getData('text');
            if (text && /^https?:\/\//i.test(text.trim()) && !text.includes('\n')) {
              const url = text.trim();
              const looksLikeImage = /\.(gif|png|jpe?g|webp|avif)(\?|$)/i.test(url) || /pub-[0-9a-f]+\.r2\.dev/i.test(url);
              const looksLikeVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
              if (looksLikeImage || looksLikeVideo) {
                e.preventDefault();
                const type = looksLikeVideo ? 'video/mp4'
                  : /\.gif/i.test(url) ? 'image/gif'
                  : 'image/png';
                setAttachments(prev => [...prev, { name: url.split('/').pop()?.split('?')[0] || 'media', url, type }]);
                return;
              }
              // Otherwise let the default paste happen (text URL into the input)
            }
          }}
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

        {/* Voice message recorder — sends an audio attachment directly. */}
        <VoiceRecorder
          disabled={disabled || uploading}
          onRecorded={(audioAttachment) => onSend([audioAttachment])}
        />

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