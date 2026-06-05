import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ghost, Move, Maximize2, Eye, Paintbrush, Pin, RotateCcw } from 'lucide-react';

const DEFAULTS = {
  position: 'top-right',
  opacity: 80,
  scale: 100,
  maxMessages: 8,
  messageDuration: 20,
  showConversationName: true,
  showAvatars: true,
  borderStyle: 'red',
  bgBlur: 'medium',
};

export function getSpidrProtocolSettings() {
  try {
    const saved = localStorage.getItem('spidr_protocol_settings');
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export default function SpidrProtocolSettings() {
  const [settings, setSettings] = useState(getSpidrProtocolSettings);

  const update = (key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem('spidr_protocol_settings', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('spidr-protocol-settings-changed'));
      return next;
    });
  };

  return (
    <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-red-900/20">
      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Ghost className="w-5 h-5 text-red-500" />
        Spidr Protocol (Gaming Overlay)
      </h3>
      <p className="text-zinc-500 text-sm mb-5">
        Customize the floating overlay that shows messages while gaming or multitasking.
      </p>

      <div className="space-y-5">
        {/* Position */}
        <div>
          <Label className="text-zinc-300 mb-2 block flex items-center gap-2">
            <Move className="w-4 h-4" /> Position
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Top Left', value: 'top-left' },
              { label: 'Top Right', value: 'top-right' },
              { label: 'Bottom Left', value: 'bottom-left' },
              { label: 'Bottom Right', value: 'bottom-right' },
            ].map(pos => (
              <button
                key={pos.value}
                onClick={() => update('position', pos.value)}
                className={`px-3 py-2 rounded-lg text-xs transition-all ${
                  settings.position === pos.value
                    ? 'bg-red-600/20 text-red-400 ring-1 ring-red-500'
                    : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
          <p className="text-zinc-600 text-xs mt-2">You can also drag the overlay to any position when it's active.</p>
        </div>

        {/* ── Pin Anywhere (out-of-app overlay) ──────────────────────────── */}
        {/* The above 'Position' controls the in-app ghost overlay (rendered
            inside the Spidr window). These controls drive the desktop-level
            transparent overlay window that floats over games and other apps,
            and can be pinned literally anywhere on the user's screen. */}
        {typeof window !== 'undefined' && window.electronAPI?.isElectron && (
          <div className="pt-2 border-t border-zinc-700">
            <Label className="text-zinc-300 mb-1 block flex items-center gap-2">
              <Pin className="w-4 h-4 text-red-500" /> Pin Anywhere
            </Label>
            <p className="text-zinc-500 text-xs mb-3">
              The Spidr Protocol overlay floats over any app on your computer. Drop it on any monitor —
              its position is saved automatically and restored next time you open it.
            </p>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[
                { label: 'TL', value: 'top-left' },
                { label: 'TR', value: 'top-right' },
                { label: '◎',  value: 'center' },
                { label: 'BL', value: 'bottom-left' },
                { label: 'BR', value: 'bottom-right' },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => window.electronAPI?.setProtocolPreset?.(p.value)}
                  className="px-2 py-2 rounded-md text-xs font-mono tracking-wider bg-black/60 border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:shadow-[0_0_12px_rgba(220,38,38,0.35)] transition-all"
                  title={`Pin to ${p.value.replace('-', ' ')}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => window.electronAPI?.resetProtocolPosition?.()}
              className="w-full px-3 py-2 rounded-md text-xs font-mono tracking-wider bg-black/60 border border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:text-red-400 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3 h-3" /> Reset to Default Position
            </button>
            <p className="text-zinc-600 text-xs mt-2">
              Tip: press <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-300">Shift+Enter</kbd> while gaming to grab the overlay,
              then drag from the red rail at the top. Resize from any edge.
            </p>
          </div>
        )}

        {/* Opacity */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-zinc-300 flex items-center gap-2">
              <Eye className="w-4 h-4" /> Overlay Opacity
            </Label>
            <span className="text-zinc-500 text-sm">{settings.opacity}%</span>
          </div>
          <Slider
            value={[settings.opacity]}
            onValueChange={([v]) => update('opacity', v)}
            min={20}
            max={100}
            step={5}
            className="w-full"
          />
        </div>

        {/* Scale */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-zinc-300 flex items-center gap-2">
              <Maximize2 className="w-4 h-4" /> Overlay Size
            </Label>
            <span className="text-zinc-500 text-sm">{settings.scale}%</span>
          </div>
          <Slider
            value={[settings.scale]}
            onValueChange={([v]) => update('scale', v)}
            min={60}
            max={140}
            step={10}
            className="w-full"
          />
        </div>

        {/* Max Messages */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-zinc-300">Messages Shown</Label>
            <span className="text-zinc-500 text-sm">{settings.maxMessages}</span>
          </div>
          <Slider
            value={[settings.maxMessages]}
            onValueChange={([v]) => update('maxMessages', v)}
            min={3}
            max={15}
            step={1}
            className="w-full"
          />
        </div>

        {/* Message Duration */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-zinc-300">Message Duration</Label>
            <span className="text-zinc-500 text-sm">{settings.messageDuration}s</span>
          </div>
          <Slider
            value={[settings.messageDuration]}
            onValueChange={([v]) => update('messageDuration', v)}
            min={5}
            max={60}
            step={5}
            className="w-full"
          />
        </div>

        {/* Border Style */}
        <div>
          <Label className="text-zinc-300 mb-2 block flex items-center gap-2">
            <Paintbrush className="w-4 h-4" /> Border Style
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Red', value: 'red', color: 'border-red-600' },
              { label: 'Cyan', value: 'cyan', color: 'border-cyan-400' },
              { label: 'Green', value: 'green', color: 'border-green-500' },
              { label: 'Purple', value: 'purple', color: 'border-purple-500' },
            ].map(style => (
              <button
                key={style.value}
                onClick={() => update('borderStyle', style.value)}
                className={`px-3 py-2 rounded-lg text-xs transition-all border-l-4 ${style.color} ${
                  settings.borderStyle === style.value
                    ? 'bg-zinc-600 text-white'
                    : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Background Blur */}
        <div>
          <Label className="text-zinc-300 mb-2 block">Background Blur</Label>
          <Select value={settings.bgBlur} onValueChange={(v) => update('bgBlur', v)}>
            <SelectTrigger className="bg-zinc-700 border-zinc-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="heavy">Heavy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2 border-t border-zinc-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Show Conversation Name</p>
              <p className="text-zinc-500 text-xs">Display chat name in overlay header</p>
            </div>
            <Switch
              checked={settings.showConversationName}
              onCheckedChange={(v) => update('showConversationName', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm">Show Avatars</p>
              <p className="text-zinc-500 text-xs">Display profile pictures in messages</p>
            </div>
            <Switch
              checked={settings.showAvatars}
              onCheckedChange={(v) => update('showAvatars', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}