import React from 'react';
import { Crown, Image as ImageIcon, Type, Sparkles } from 'lucide-react';
import { entities, auth, integrations } from '@/api/apiClient';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const THEME_COLORS = ['#ffffff', '#FF3333', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#ec4899', '#f97316'];

export default function ApexVisuals({ formData, updateFormData }) {
  const apexFeatures = formData.apex_features || {};
  const customBgUrl = apexFeatures.custom_bg_url || '';
  const customBgOpacity = apexFeatures.custom_bg_opacity ?? 40;
  const accentColor = formData.accent_color || '#FF3333';

  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { url: file_url } = await integrations.Core.UploadFile({ file });
    updateFormData({ apex_features: { ...apexFeatures, custom_bg_url: file_url } });
    toast.success('Background uploaded!');
  };

  // Generic APEX asset uploader (frame / nameplate). Image only, 2 MB cap.
  const handleAssetUpload = async (e, key, label) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image.'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error(`${label} must be under 2 MB.`); return; }
    try {
      const { url } = await integrations.Core.UploadFile({ file });
      if (url) { updateFormData({ apex_features: { ...apexFeatures, [key]: url } }); toast.success(`${label} set!`); }
    } catch { toast.error(`${label} upload failed.`); }
  };

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <div className="border-b border-white/5 pb-6">
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF3333] to-purple-500 uppercase flex items-center gap-3 italic tracking-tighter">
          <Crown size={28} className="text-[#FF3333]" /> Apex Visuals
        </h2>
        <p className="text-xs text-gray-500 mt-2 font-mono">
          {'>'} EXCLUSIVE_TELEMETRY_CUSTOMIZATION<br />
          {'>'} Overwrite standard profile defaults with custom aesthetics.
        </p>
      </div>

      {/* 1. DOSSIER BACKGROUND OVERLAY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
          <ImageIcon size={16} className="text-purple-500" /> Dossier Background Overlay
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Upload + URL */}
          <div className="space-y-3">
            <label className="block">
              <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
              <div className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-xl text-xs font-bold text-center cursor-pointer transition-colors uppercase tracking-widest">
                Inject Background
              </div>
            </label>
            <Input
              value={customBgUrl}
              onChange={(e) => updateFormData({ apex_features: { ...apexFeatures, custom_bg_url: e.target.value } })}
              placeholder="Or paste image URL..."
              className="bg-[#111] border-white/10 text-white text-xs"
            />
            <p className="text-[10px] text-gray-500 font-mono">
              Recommended: dark, moody images. Rendered with overlay for text legibility.
            </p>

            {/* Opacity Slider */}
            {customBgUrl && (
              <div className="mt-2">
                <div className="flex justify-between mb-2">
                  <Label className="text-gray-400 text-xs">Background Opacity</Label>
                  <span className="text-gray-400 text-xs">{customBgOpacity}%</span>
                </div>
                <Slider
                  value={[customBgOpacity]}
                  min={10} max={100} step={5}
                  onValueChange={([val]) => updateFormData({ apex_features: { ...apexFeatures, custom_bg_opacity: val } })}
                  className="w-full"
                />
              </div>
            )}

            {customBgUrl && (
              <button
                onClick={() => updateFormData({ apex_features: { ...apexFeatures, custom_bg_url: '' } })}
                className="w-full py-2 bg-red-500/10 text-red-500 border border-red-500/30 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-colors"
              >
                REMOVE BACKGROUND
              </button>
            )}
          </div>

          {/* Live Preview Card */}
          <div className="relative w-full aspect-video rounded-xl border border-white/20 overflow-hidden shadow-2xl">
            {customBgUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${customBgUrl})`, filter: 'saturate(1.2)' }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
            )}
            <div className="absolute inset-0 bg-[#0a0a0a]/60" />
            <div className="absolute inset-0 opacity-20 mix-blend-overlay"
              style={{ backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')" }} />
            <div className="relative z-10 p-4 h-full flex flex-col justify-end">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Preview</div>
              <div className="text-xl font-black tracking-tighter" style={{ color: accentColor }}>
                {formData.display_name || 'Your Name'}
              </div>
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">@{(formData.display_name || 'user').toLowerCase().replace(/\s+/g, '_')}#0000</div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[1px] bg-white/5 w-full" />

      {/* 2. CHROMA IDENTITY SYNC */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
          <Type size={16} className="text-[#FF3333]" /> Chroma Identity Sync
        </div>
        <p className="text-xs text-gray-500">
          Shift the frequency color of your Display Name across the entire Spidr network.
        </p>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Custom Color Input */}
          <div className="flex items-center gap-2 bg-[#111] border border-white/10 rounded-lg p-1.5 focus-within:border-white/30 transition-colors">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => updateFormData({ accent_color: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
            />
            <input
              type="text"
              value={accentColor.toUpperCase()}
              onChange={(e) => updateFormData({ accent_color: e.target.value })}
              className="bg-transparent border-none text-xs text-white font-mono w-20 outline-none uppercase"
            />
          </div>

          <div className="w-[1px] h-10 bg-white/10 mx-1" />

          {/* Presets */}
          {THEME_COLORS.map(color => (
            <button
              key={color}
              onClick={() => updateFormData({ accent_color: color })}
              className={`w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110 ${accentColor === color ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* 3. ENTRANCE ANIMATION */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
          <Sparkles size={16} className="text-purple-500" /> Voice Entrance Flash
        </div>
        <p className="text-xs text-gray-500 font-mono">
          {'>'} Played for everyone when you drop into a voice channel.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'ripple',  label: 'Web Ripple',  desc: 'Concentric silk rings.' },
            { id: 'thunder', label: 'Thunder',     desc: 'Lightning + flash.' },
            { id: 'glitch',  label: 'Glitch',      desc: 'RGB-split bands.' },
          ].map(opt => {
            const active = (apexFeatures.entrance_style || 'ripple') === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => updateFormData({ apex_features: { ...apexFeatures, entrance_style: opt.id } })}
                className={`p-3 rounded-xl border text-left transition-colors ${active ? 'border-[#FF3333] bg-[#FF3333]/10' : 'border-white/10 bg-black/30 hover:border-white/30'}`}
              >
                <p className="text-sm font-bold text-white">{opt.label}</p>
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">{opt.desc}</p>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('spidr-apex-entrance', {
            detail: { name: 'PREVIEW', style: apexFeatures.entrance_style || 'ripple', color: apexFeatures.entrance_color || accentColor },
          }))}
          className="text-xs px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-bold uppercase tracking-widest transition-colors"
        >
          Preview Entrance
        </button>
      </div>

      {/* 4. THREAD SKIN */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
          <Type size={16} className="text-purple-500" /> Thread Skin
        </div>
        <p className="text-xs text-gray-500 font-mono">
          {'>'} Recolors your hanging silk thread + message connectors.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'default', color: '#FF3333', label: 'Crimson' },
            { id: 'violet',  color: '#a855f7', label: 'Violet' },
            { id: 'cyan',    color: '#06b6d4', label: 'Cyan' },
            { id: 'gold',    color: '#eab308', label: 'Gold' },
            { id: 'emerald', color: '#10b981', label: 'Emerald' },
            { id: 'mono',    color: '#e5e5e5', label: 'Silk' },
          ].map(skin => {
            const active = (apexFeatures.thread_skin || 'default') === skin.id;
            return (
              <button
                key={skin.id}
                onClick={() => updateFormData({ apex_features: { ...apexFeatures, thread_skin: skin.id, thread_skin_color: skin.color } })}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${active ? 'border-white bg-white/5' : 'border-white/10 hover:border-white/30'}`}
              >
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: skin.color, boxShadow: `0 0 8px ${skin.color}99` }} />
                <span className="text-xs font-bold text-white">{skin.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. AVATAR FRAME + NAMEPLATE (4.1) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest text-sm">
          <Crown size={16} className="text-[#FF3333]" /> Frame & Nameplate
        </div>
        <p className="text-xs text-gray-500 font-mono">
          {'>'} Equip a custom frame around your avatar and a nameplate behind your name.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {/* Frame */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-widest mb-2">Avatar Frame</p>
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 shrink-0">
                <div className="w-14 h-14 rounded-full bg-zinc-800 border border-white/10" />
                {apexFeatures.frame_url && (
                  <img src={apexFeatures.frame_url} alt="" className="absolute inset-0 w-14 h-14 object-contain pointer-events-none" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-white px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 cursor-pointer transition-colors text-center">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAssetUpload(e, 'frame_url', 'Frame')} />
                </label>
                {apexFeatures.frame_url && (
                  <button onClick={() => updateFormData({ apex_features: { ...apexFeatures, frame_url: '' } })}
                    className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
                )}
              </div>
            </div>
            <p className="text-[9px] text-zinc-600 mt-2">PNG with transparency works best (sits over the avatar).</p>
          </div>

          {/* Nameplate */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-widest mb-2">Nameplate</p>
            <div className="relative h-10 rounded-lg overflow-hidden border border-white/10 mb-2 flex items-center px-3">
              {apexFeatures.nameplate_url && (
                <img src={apexFeatures.nameplate_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <span className="relative text-xs font-bold text-white drop-shadow">{formData.display_name || 'Your Name'}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-white px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 cursor-pointer transition-colors">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleAssetUpload(e, 'nameplate_url', 'Nameplate')} />
              </label>
              {apexFeatures.nameplate_url && (
                <button onClick={() => updateFormData({ apex_features: { ...apexFeatures, nameplate_url: '' } })}
                  className="text-[10px] text-red-400 hover:text-red-300">Remove</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}