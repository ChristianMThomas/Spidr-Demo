import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Sparkles, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { entities, auth, integrations } from '@/api/apiClient';
const PRESETS = [
  { name: 'Spidr Red',       primary: '#dc2626', secondary: '#7f1d1d' },
  { name: 'Symbiote Sludge', primary: '#4c1d95', secondary: '#000000' },
  { name: 'Cyber Rig',       primary: '#3b82f6', secondary: '#0f172a' },
  { name: 'The Boss',        primary: '#b45309', secondary: '#450a0a' },
  { name: 'Venom',           primary: '#7c3aed', secondary: '#1e0a3c' },
  { name: 'Carbon',          primary: '#18181b', secondary: '#000000' },
  { name: 'Deep Ocean',      primary: '#0ea5e9', secondary: '#0c4a6e' },
  { name: 'Matrix',          primary: '#16a34a', secondary: '#052e16' },
  { name: 'Inferno',         primary: '#ea580c', secondary: '#431407' },
  { name: 'Sakura',          primary: '#ec4899', secondary: '#500724' },
  { name: 'Midnight',        primary: '#1e1b4b', secondary: '#0f0f1a' },
  { name: 'Gold Rush',       primary: '#eab308', secondary: '#422006' },
];

export default function ThemeStudio({ open, onClose, currentTheme, onSave }) {
  const [theme, setTheme] = useState(currentTheme || {
    type: 'gradient', primaryColor: '#dc2626', secondaryColor: '#7f1d1d',
    backgroundImage: '', blur: 0, opacity: 85
  });
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Stay in sync with prop when dialog reopens
  useEffect(() => { if (open && currentTheme) setTheme(currentTheme); }, [open]);

  const set = (updates) => { setTheme(p => ({ ...p, ...updates })); setHasChanges(true); };

  const handleSave = async () => {
    onSave(theme);
    try { localStorage.setItem('spidr_theme', JSON.stringify(theme)); } catch {}
    // Persist to DB for cross-device sync
    try {
      const user = await auth.me();
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      if (profiles[0]) {
        await entities.UserProfile.update(profiles[0].id, { app_theme: theme });
      } else {
        await entities.UserProfile.create({ user_id: user.id, app_theme: theme });
      }
      toast.success('Theme saved!');
    } catch { toast.success('Theme applied!'); }
    setHasChanges(false);
    toast.success('🎨 Theme applied!');
    onClose();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await integrations.Core.UploadFile({ file });
      set({ backgroundImage: result.url, type: 'image' });
      toast.success('Background uploaded!');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const preview = () => {
    if (theme.type === 'solid')    return { backgroundColor: theme.primaryColor };
    if (theme.type === 'gradient') return { background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` };
    if (theme.type === 'image' && theme.backgroundImage) return { backgroundImage: `url(${theme.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    return { background: '#111' };
  };

  const TABS = ['gradient', 'solid', 'image'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/5">
          <DialogTitle className="text-white flex items-center gap-2 text-base font-black">
            <Sparkles className="w-4 h-4 text-red-500" /> THEME STUDIO
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-5">
          {/* Type tabs */}
          <div className="flex bg-zinc-900 border border-white/5 rounded-xl p-1 gap-1">
            {TABS.map(t => (
              <button key={t} onClick={() => set({ type: t })}
                className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all ${theme.type === t ? 'bg-[#FF3333] text-white' : 'text-zinc-400 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Gradient controls */}
          {theme.type === 'gradient' && (
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-3 block">Quick Presets</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map(p => (
                    <button key={p.name}
                      onClick={() => set({ primaryColor: p.primary, secondaryColor: p.secondary })}
                      className={`relative h-14 rounded-xl flex items-end p-2 overflow-hidden transition-transform hover:scale-105 border-2 ${
                        theme.primaryColor === p.primary ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}>
                      {theme.primaryColor === p.primary && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                          <Check size={10} className="text-black" />
                        </div>
                      )}
                      <span className="text-white text-[10px] font-bold drop-shadow-lg">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-400 text-xs mb-2 block">From Color</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={theme.primaryColor} onChange={e => set({ primaryColor: e.target.value })}
                      className="w-12 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
                    <input value={theme.primaryColor} onChange={e => set({ primaryColor: e.target.value })}
                      className="flex-1 bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#FF3333]" />
                  </div>
                </div>
                <div>
                  <Label className="text-zinc-400 text-xs mb-2 block">To Color</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={theme.secondaryColor} onChange={e => set({ secondaryColor: e.target.value })}
                      className="w-12 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
                    <input value={theme.secondaryColor} onChange={e => set({ secondaryColor: e.target.value })}
                      className="flex-1 bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#FF3333]" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Solid controls */}
          {theme.type === 'solid' && (
            <div className="flex gap-4 items-center">
              <input type="color" value={theme.primaryColor} onChange={e => set({ primaryColor: e.target.value })}
                className="w-20 h-20 rounded-xl cursor-pointer border-2 border-zinc-700 bg-transparent" />
              <div>
                <p className="text-white font-mono text-lg">{theme.primaryColor}</p>
                <p className="text-zinc-500 text-xs">Click the swatch to pick a color</p>
              </div>
            </div>
          )}

          {/* Image controls */}
          {theme.type === 'image' && (
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2 block">Image URL or Upload</Label>
                <div className="flex gap-2">
                  <Input value={theme.backgroundImage} onChange={e => set({ backgroundImage: e.target.value })}
                    placeholder="https://example.com/wallpaper.jpg"
                    className="bg-zinc-900 border-zinc-700 text-white text-sm flex-1 focus:border-[#FF3333]" />
                  <label className={`px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-700 transition-colors flex items-center gap-1.5 text-white text-xs font-bold whitespace-nowrap ${uploading ? 'opacity-50' : ''}`}>
                    <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-zinc-400 text-xs">Blur</Label>
                  <span className="text-zinc-400 text-xs">{theme.blur}px</span>
                </div>
                <Slider value={[theme.blur]} onValueChange={([v]) => set({ blur: v })} max={20} className="w-full" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-zinc-400 text-xs">Overlay Darkness</Label>
                  <span className="text-zinc-400 text-xs">{100 - theme.opacity}%</span>
                </div>
                <Slider value={[theme.opacity]} onValueChange={([v]) => set({ opacity: v })} max={100} className="w-full" />
              </div>
            </div>
          )}

          {/* Live preview */}
          <div>
            <Label className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2 block">Live Preview</Label>
            <div className="relative h-28 rounded-xl overflow-hidden border border-white/5">
              <div
                className="absolute inset-0"
                style={{
                  ...preview(),
                  filter: theme.type === 'image' && theme.blur ? `blur(${theme.blur}px)` : undefined,
                  transform: theme.type === 'image' && theme.blur ? 'scale(1.06)' : undefined, // hide blurred edges
                }}
              />
              {/* Single readability scrim that tracks the user's opacity setting. */}
              <div
                className="absolute inset-0 bg-black transition-opacity"
                style={{ opacity: theme.type === 'image' ? Math.max(0.15, (100 - (theme.opacity ?? 100)) / 100) : 0.35 }}
              />
              <div className="absolute inset-0 flex items-center justify-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20" />
                <div className="space-y-1.5">
                  <div className="w-24 h-2.5 bg-white/30 rounded-full" />
                  <div className="w-16 h-2 bg-white/15 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex justify-between items-center">
          {hasChanges
            ? <p className="text-yellow-400 text-xs flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" /> Unsaved changes</p>
            : <div />
          }
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-white/10 text-zinc-400 hover:text-white rounded-lg text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-5 py-2 bg-[#FF3333] hover:bg-red-500 text-white font-bold rounded-lg text-sm transition-colors">Apply Theme</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
