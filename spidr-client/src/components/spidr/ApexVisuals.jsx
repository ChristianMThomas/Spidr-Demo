import React, { useRef, useState } from 'react';
import { Crown, Image as ImageIcon, Type, Sparkles, Upload, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { entities, auth, integrations } from '@/api/apiClient';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FRAME_OPTIONS, getFrameComponent } from './FrameRegistry';
import UserNameplate from './UserNameplate';
import BubbleThemePicker from './BubbleThemePicker';
import NameplateBackground from './NameplateBackground';
import NameplateCropper from './NameplateCropper';

const THEME_COLORS = ['#ffffff', '#FF3333', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#ec4899', '#f97316'];

export default function ApexVisuals({ formData, updateFormData }) {
  const apexFeatures = formData.apex_features || {};
  const customBgUrl = apexFeatures.custom_bg_url || '';
  const customBgOpacity = apexFeatures.custom_bg_opacity ?? 40;
  const accentColor = formData.accent_color || '#FF3333';

  // Pending nameplate file routed through the cropper modal. When the user
  // drops or picks a file, it lands here instead of going straight to
  // upload — they crop first, then we upload the cropped Blob.
  const [pendingNameplateFile, setPendingNameplateFile] = useState(null);

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

  // The dropzone hands us a raw File. Validate, then route through the
  // cropper modal — the user picks the framing before we upload anything.
  const handleNameplateFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Nameplate must be an image (PNG, JPG, GIF).'); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error('Nameplate must be under 4 MB.'); return; }
    setPendingNameplateFile(file);
  };

  // Called by NameplateCropper after the user confirms a crop. Uploads the
  // cropped Blob (wrapped as a File so the upload integration can pull a
  // filename + mime). On success, sets `nameplate_url` on the profile.
  const uploadCroppedNameplate = async (croppedBlob) => {
    if (!croppedBlob) return;
    const ext = croppedBlob.type === 'image/png' ? 'png' :
                croppedBlob.type === 'image/webp' ? 'webp' : 'jpg';
    const file = new File([croppedBlob], `nameplate.${ext}`, { type: croppedBlob.type });
    try {
      const { url } = await integrations.Core.UploadFile({ file });
      if (url) {
        updateFormData({ apex_features: { ...apexFeatures, nameplate_url: url } });
        toast.success('Nameplate forged.');
      }
    } catch {
      toast.error('Nameplate forge failed.');
    } finally {
      setPendingNameplateFile(null);
    }
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

      {/* 4.5 BUBBLE THEME — curated gradients for outgoing DM bubbles. The
          picker is intentionally a fixed set (no free-form color picker) so
          a user can't choose a hue that breaks the dark Spidr aesthetic for
          the people they're messaging. See lib/bubbleGradients.js for the
          rationale and how to add new entries. */}
      <BubbleThemePicker formData={formData} updateFormData={updateFormData} />

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

          {/* ── APEX FORGE: Nameplate ──────────────────────────────────────
              Replaces the old "Upload" button + thin preview strip. This is
              the premium upload UX described in the blueprint: a glowing
              dashed dropzone on the left (drag/drop OR click), a live 1:1
              preview of the actual sidebar user pill on the right (using
              the same NameplateBackground component the lists render with,
              so the preview is pixel-accurate, including the Spidr
              Legibility Engine gradient mask). */}
          <div className="rounded-xl border border-purple-500/15 bg-gradient-to-br from-black/40 to-purple-950/10 p-4 col-span-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={12} className="text-purple-400" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
                  Apex Forge — Nameplate
                </span>
              </p>
              {apexFeatures.nameplate_url && (
                <button
                  onClick={() => updateFormData({ apex_features: { ...apexFeatures, nameplate_url: '' } })}
                  className="text-[10px] text-red-400 hover:text-red-300 font-mono uppercase tracking-wider"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 mb-4 font-mono">
              {'>'} Upload custom artwork — image or GIF. The Spidr Legibility Engine
              composites a dark gradient so your username always stays readable, no
              matter what you throw at it.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NameplateDropzone
                currentUrl={apexFeatures.nameplate_url}
                onFile={handleNameplateFile}
              />
              <NameplatePreview
                nameplateUrl={apexFeatures.nameplate_url}
                avatarUrl={formData.avatar_url}
                name={formData.display_name || 'Spidr User'}
                accentColor={accentColor}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── FRAME VAULT (Patch 2.2) ─────────────────────────────────────── */}
      <FrameVault formData={formData} updateFormData={updateFormData} accentColor={accentColor} />

      {/* ── NAMEPLATES & BADGES (Patch 2.4) ─────────────────────────────── */}
      <BadgeAndNameplate formData={formData} updateFormData={updateFormData} accentColor={accentColor} />

      {/* ── NAMEPLATE CROPPER ──
          Mounts whenever the user drops/picks a nameplate image. The
          dropzone routes the raw File here first, and only the cropped
          Blob actually gets uploaded. */}
      <NameplateCropper
        open={!!pendingNameplateFile}
        imageFile={pendingNameplateFile}
        onCancel={() => setPendingNameplateFile(null)}
        onApply={uploadCroppedNameplate}
      />
    </div>
  );
}
/**
 * FrameVault (Patch 2.2) — live 16:9 preview wrapped with the selected frame +
 * a glassmorphic carousel of frame options and an Equip button. Frame choice is
 * staged into formData.apex_features.apexFrameStyle (saved by the parent's
 * "Deploy Apex Configurations" / handleSave).
 */
function FrameVault({ formData, updateFormData, accentColor }) {
  const apexFeatures = formData.apex_features || {};
  const current = apexFeatures.apexFrameStyle || formData.apexFrameStyle || 'symbiote-tear';
  const [selected, setSelected] = React.useState(current);
  const color = apexFeatures.thread_skin_color || accentColor || '#FF3333';
  const PreviewFrame = getFrameComponent(selected);

  const equip = () => {
    updateFormData({
      apexFrameStyle: selected,
      apex_features: { ...apexFeatures, apexFrameStyle: selected },
    });
    toast.success('Frame equipped — Deploy to save.');
  };

  return (
    <div className="border border-white/5 rounded-2xl p-6 bg-[#0a0a0a]/60">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={16} className="text-[#FF3333]" />
        <h3 className="text-sm font-black text-white">Frame Vault</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">APEX Stream HUD Frames — preview updates live.</p>

      {/* Live 16:9 preview with the selected frame */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-white/5 mb-4"
        style={{ boxShadow: `inset 0 0 20px ${color}44` }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[10px] tracking-[0.3em] text-white/20">PREVIEW STREAM</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            <PreviewFrame color={color} />
          </motion.div>
        </AnimatePresence>
        {/* mock telemetry */}
        <div className="absolute top-2 left-3 font-mono text-[10px] tracking-[0.2em] text-white/70">
          <span>{'> SYS.RES: '}</span><span style={{ color }}>1920x1080</span><span>{' // '}</span><span style={{ color }}>60</span><span> FPS</span>
        </div>
        <div className="absolute top-2 right-3 font-mono text-[10px] tracking-[0.2em] text-white/70 text-right">
          <span>{'> UPLINK: '}</span><span style={{ color }}>7.2</span><span>{' Mbps // EYES: '}</span><span style={{ color }}>42</span>
        </div>
      </div>

      {/* Carousel of frame tiles */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {FRAME_OPTIONS.map((opt) => {
          const Tile = getFrameComponent(opt.id);
          const isSel = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelected(opt.id)}
              className={`relative shrink-0 w-40 rounded-xl border p-2 text-left transition-all ${isSel ? 'border-[#FF3333] bg-white/[0.04]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
            >
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black mb-2">
                <Tile color={isSel ? color : '#666'} />
              </div>
              <p className="text-[11px] font-bold text-white font-mono">{opt.name}</p>
              <p className="text-[9px] text-gray-500">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      <button
        onClick={equip}
        className="mt-4 w-full py-2.5 rounded-xl font-black text-white transition-transform hover:scale-[1.01]"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: `0 0 18px ${color}55` }}
      >
        Equip Frame
      </button>
    </div>
  );
}

/**
 * BadgeAndNameplate (Patch 2.4) — custom floating badge upload (client-side
 * compressed to 64x64), badge glow color, and nameplate style picker. Staged
 * into both top-level fields and apex_features so every consumer resolves it.
 */
function BadgeAndNameplate({ formData, updateFormData, accentColor }) {
  const apexFeatures = formData.apex_features || {};
  const badgeUrl = formData.apexBadgeUrl || apexFeatures.apexBadgeUrl || '';
  const badgeGlow = formData.apexBadgeGlow || apexFeatures.apexBadgeGlow || '#fb923c';
  const nameplate = formData.apexNameplateStyle || apexFeatures.apexNameplateStyle || 'default';
  const apexColor = apexFeatures.thread_skin_color || accentColor || '#FF3333';

  // Compress a badge to 64x64 PNG via canvas before upload (no Sharp backend).
  const handleBadgeUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image.'); return; }
    try {
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const img = await new Promise((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      // cover-fit into 64x64
      const scale = Math.max(64 / img.width, 64 / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (64 - w) / 2, (64 - h) / 2, w, h);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png', 0.9));
      const compressed = new File([blob], 'badge.png', { type: 'image/png' });
      const { url } = await integrations.Core.UploadFile({ file: compressed });
      if (url) {
        updateFormData({ apexBadgeUrl: url, apex_features: { ...apexFeatures, apexBadgeUrl: url } });
        toast.success('Badge uploaded — Deploy to save.');
      }
    } catch { toast.error('Badge upload failed.'); }
  };

  const NAMEPLATE_STYLES = ['default', 'glitch', 'neon', 'terminal'];
  const GLOWS = ['#fb923c', '#FF3333', '#a855f7', '#3b82f6', '#10b981', '#ec4899'];

  return (
    <div className="border border-white/5 rounded-2xl p-6 bg-[#0a0a0a]/60">
      <div className="flex items-center gap-2 mb-1">
        <Type size={16} className="text-[#FF3333]" />
        <h3 className="text-sm font-black text-white">Nameplates & Badges</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">Your visual presence in member lists, DMs, and chats.</p>

      {/* Floating badge */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative w-12 h-12 shrink-0">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-white font-bold">A</div>
          {badgeUrl && (
            <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full z-20 overflow-hidden border border-black/40"
              style={{ boxShadow: `0 0 12px ${badgeGlow}` }}>
              <img src={badgeUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-white px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 cursor-pointer transition-colors w-fit">
            Upload Badge (64x64)
            <input type="file" accept="image/*" className="hidden" onChange={handleBadgeUpload} />
          </label>
          {badgeUrl && (
            <button onClick={() => updateFormData({ apexBadgeUrl: '', apex_features: { ...apexFeatures, apexBadgeUrl: '' } })}
              className="text-[10px] text-red-400 hover:text-red-300 w-fit">Remove badge</button>
          )}
        </div>
      </div>

      {/* Badge glow color */}
      <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">Badge Glow</p>
      <div className="flex gap-2 mb-6">
        {GLOWS.map((g) => (
          <button key={g} onClick={() => updateFormData({ apexBadgeGlow: g, apex_features: { ...apexFeatures, apexBadgeGlow: g } })}
            className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${badgeGlow === g ? 'ring-2 ring-white' : ''}`}
            style={{ background: g, boxShadow: `0 0 10px ${g}` }} />
        ))}
      </div>

      {/* Nameplate style */}
      <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2">Nameplate Style</p>
      <div className="grid grid-cols-2 gap-2">
        {NAMEPLATE_STYLES.map((s) => (
          <button key={s} onClick={() => updateFormData({ apexNameplateStyle: s, apex_features: { ...apexFeatures, apexNameplateStyle: s } })}
            className={`px-4 py-3 rounded-lg bg-zinc-800/60 border transition-all ${nameplate === s ? 'border-[#FF3333]' : 'border-white/5 hover:border-white/20'}`}>
            <UserNameplate name={`Spidr_User`} style={s} apexColor={apexColor} className="text-sm" />
            <span className="block text-[9px] text-gray-500 uppercase tracking-widest mt-1">{s}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── APEX Forge: holographic dropzone ────────────────────────────────────────
// A dashed purple dropzone that accepts an image (or GIF) via drag-drop OR
// click-to-pick. When a file is dragged OVER the zone, it pulses a purple
// glow to confirm the drop target is hot. Falls back to a plain file input
// for keyboard / a11y users. Note we DON'T render the uploaded image inside
// the dropzone itself — the live preview on the right is the canonical view
// of the current nameplate; here we just confirm "image set" so the user
// knows the upload landed.
function NameplateDropzone({ currentUrl, onFile }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  // Drag counter — `dragenter` fires for every child element the cursor
  // enters, so a naive setIsDragging(true)/setIsDragging(false) flickers
  // off as the cursor moves between the zone's children. Counting enter
  // vs leave keeps the highlight stable until the cursor truly exits.
  const dragCounterRef = useRef(0);

  const onDragEnter = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  };
  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      aria-label="Upload nameplate artwork"
      className={`relative cursor-pointer rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
        isDragging ? 'border-2 border-dashed border-purple-500' : 'border-2 border-dashed border-purple-500/30 hover:border-purple-500'
      }`}
      style={{
        minHeight: 168,
        background: isDragging
          ? 'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.18), rgba(0, 0, 0, 0.4) 70%)'
          : 'rgba(0, 0, 0, 0.30)',
        boxShadow: isDragging
          ? '0 0 24px rgba(168, 85, 247, 0.45), inset 0 0 18px rgba(168, 85, 247, 0.15)'
          : 'inset 0 0 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      <input ref={inputRef} type="file" accept="image/*,image/gif" className="hidden" onChange={onPick} />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 py-6 pointer-events-none">
        {/* Icon + animated halo when dragging */}
        <div className="relative mb-3">
          {isDragging && (
            <div
              className="absolute inset-0 -m-3 rounded-full animate-pulse"
              style={{ background: 'radial-gradient(circle, rgba(168, 85, 247, 0.4), transparent 70%)' }}
            />
          )}
          <div
            className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isDragging ? 'bg-purple-500/30' : 'bg-purple-500/10'
            }`}
            style={{ border: `1px solid ${isDragging ? 'rgba(168, 85, 247, 0.7)' : 'rgba(168, 85, 247, 0.3)'}` }}
          >
            <Upload size={20} className={isDragging ? 'text-purple-200' : 'text-purple-400'} />
          </div>
        </div>

        <p className="text-xs font-bold text-white mb-1">
          {isDragging ? 'Release to forge' : currentUrl ? 'Replace artwork' : 'Drop artwork here'}
        </p>
        <p className="text-[10px] text-zinc-500">
          {isDragging ? 'Spidr Legibility Engine will engage' : 'or click to browse — PNG, JPG, GIF up to 4 MB'}
        </p>

        {currentUrl && !isDragging && (
          <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-green-400">
            <Check size={10} />
            <span>Current artwork loaded</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── APEX Forge: live telemetry preview ──────────────────────────────────────
// 1:1 mockup of how the nameplate looks as a sidebar member-list row. Uses
// the SAME NameplateBackground component the actual lists render with, so
// what you see here is exactly what other users will see — including the
// Spidr Legibility Engine gradient mask that keeps your username readable
// against any uploaded artwork.
function NameplatePreview({ nameplateUrl, avatarUrl, name, accentColor }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="flex flex-col">
      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
        Live Preview · Sidebar Pill
      </p>
      {/* The pill itself — matches the row structure used in CommunityPanel,
          DMsSidebar, and FriendsPanel: relative + overflow-hidden, with
          NameplateBackground absolutely filling the row and the actual
          content sitting in a relative wrapper above it. */}
      <div
        className="relative overflow-hidden rounded-2xl px-3 py-2.5 flex items-center gap-3"
        style={{
          background: 'rgba(10, 10, 10, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          minHeight: 56,
        }}
      >
        <NameplateBackground url={nameplateUrl} intensity="strong" />

        {/* Avatar */}
        <div className="relative shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-9 h-9 rounded-full object-cover border"
              style={{ borderColor: `${accentColor}55` }}
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, #7c3aed)`,
              display: avatarUrl ? 'none' : 'flex',
            }}
          >
            {initial}
          </div>
        </div>

        {/* Identity */}
        <div className="relative min-w-0 flex-1">
          <p className="text-white font-bold text-sm truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            {name}
          </p>
          <p className="text-zinc-300 text-[10px] font-mono truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            @{(name || 'user').toLowerCase().replace(/\s+/g, '_')}
          </p>
        </div>

        {/* APEX badge — tiny right-side tag to match real rows */}
        <span
          className="relative shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, #7c3aed)`,
            color: '#fff',
            boxShadow: `0 0 8px ${accentColor}66`,
          }}
        >
          APEX
        </span>
      </div>

      {/* Legibility annotation under the preview so the user understands
          the gradient mask is intentional and protecting their name. */}
      <div className="mt-2 flex items-start gap-2 text-[10px] text-zinc-500 leading-relaxed">
        <div
          className="shrink-0 w-3 h-3 mt-0.5 rounded-sm"
          style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.50) 50%, rgba(0,0,0,0.00) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        />
        <span>
          <span className="text-zinc-400 font-mono">Legibility Engine:</span>{' '}
          a dark-to-transparent gradient is composited over your artwork so the
          left side stays high-contrast for your avatar and username.
        </span>
      </div>
    </div>
  );
}
