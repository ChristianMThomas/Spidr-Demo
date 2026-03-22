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
    </div>
  );
}