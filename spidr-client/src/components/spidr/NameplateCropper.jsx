import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { Check, X, Move, ZoomIn, RotateCcw } from 'lucide-react';

/**
 * NameplateCropper — pre-upload editor for APEX nameplate artwork. The user
 * picks a file, this modal opens with the image placed in a fixed-aspect
 * crop window matching the sidebar pill (4:1), can pan + zoom to choose the
 * region, and confirms with "Forge nameplate". The cropped Blob is handed
 * to `onApply` which then runs the real upload + profile save.
 *
 * Premium touches matching the rest of APEX Forge:
 *   • Dark glass shell + purple accent border
 *   • Live Legibility Engine preview underneath so the user sees how the
 *     dark-to-transparent gradient will sit on top of their selected crop
 *   • Pan via drag (cropper default) + zoom via slider
 *   • Reset button restores defaults
 *
 * Props:
 *   imageFile — the raw File the user dropped/picked
 *   open      — boolean, controls the modal
 *   onCancel  — closes without applying
 *   onApply   — (croppedBlob: Blob) → caller's job to upload + save url
 */
export default function NameplateCropper({ imageFile, open, onCancel, onApply }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);

  // Read the file into a data URL on mount / file change. We use a data URL
  // (not a blob URL) because react-easy-crop needs an `<img>` src and data
  // URLs are simpler — no revoke step required when the modal unmounts.
  React.useEffect(() => {
    if (!imageFile) { setImageSrc(null); return; }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(imageFile);
    // Reset crop state for each new image so a previous edit doesn't bleed
    // into the new one.
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, [imageFile]);

  const onCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const apply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(imageSrc, croppedAreaPixels, imageFile?.type);
      if (blob) onApply?.(blob);
    } catch (err) {
      console.error('[NameplateCropper] crop failed', err);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(10,4,22,0.96), rgba(6,2,18,0.98))',
            border: '1px solid rgba(168, 85, 247, 0.30)',
            boxShadow: '0 0 40px rgba(168, 85, 247, 0.20), 0 24px 60px rgba(0, 0, 0, 0.65)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                }}
              >
                <Move size={14} className="text-purple-300" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-purple-300">Apex Forge</p>
                <p className="text-white font-bold text-sm">Crop your nameplate</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Crop area — 4:1 aspect to match the sidebar pill. Pure
              Tailwind would be aspect-[4/1] but we set it inline so the
              cropper container resolves dimensions immediately. */}
          <div className="p-5 space-y-4">
            <div
              className="relative w-full rounded-xl overflow-hidden bg-black"
              style={{ aspectRatio: '4 / 1' }}
            >
              {imageSrc ? (
                <>
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={4 / 1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    objectFit="cover"
                    style={{
                      containerStyle: { background: '#050505' },
                    }}
                  />
                  {/* Spidr Legibility Engine preview — same gradient the
                      sidebar rows composite on top of the artwork. We
                      render it over the cropper so the user can preview
                      exactly how the final pill will read. pointer-events
                      none so the cropper still grabs drag input. */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(to right, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.50) 50%, rgba(0,0,0,0.00) 100%)',
                    }}
                  />
                  {/* Sample username + avatar overlaid where the real
                      content would land, so the user can see contrast. */}
                  <div className="absolute inset-y-0 left-0 flex items-center gap-2 px-3 pointer-events-none">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black"
                      style={{
                        background: 'linear-gradient(135deg, #FF3333, #7c3aed)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      A
                    </div>
                    <div>
                      <p
                        className="text-white text-xs font-bold"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                      >
                        Preview
                      </p>
                      <p
                        className="text-zinc-300 text-[9px] font-mono"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                      >
                        @preview
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-xs">
                  Loading image…
                </div>
              )}
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3">
              <ZoomIn size={14} className="text-zinc-500 flex-shrink-0" />
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 spidr-slider"
                aria-label="Zoom"
              />
              <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 w-12 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Hint */}
            <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
              {'>'} Drag to pan · scroll or use the slider to zoom · the dark gradient on the
              left is the Legibility Engine — it stays in the final result.
            </p>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={reset}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40 flex items-center gap-1.5"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <RotateCcw size={11} />
                Reset
              </button>
              <button
                onClick={onCancel}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.10)',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={busy || !imageSrc || !croppedAreaPixels}
                className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                  boxShadow: '0 0 18px rgba(168, 85, 247, 0.45)',
                }}
              >
                {busy ? 'Forging…' : <><Check size={12} /> Forge Nameplate</>}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Slider thumb styling — scoped via the class on the input so it
          doesn't bleed into other range inputs in the app. */}
      <style>{`
        .spidr-slider { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 999px;
          background: rgba(168, 85, 247, 0.15); outline: none; }
        .spidr-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: linear-gradient(135deg, #c084fc, #ec4899); cursor: pointer;
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.55); }
        .spidr-slider::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%;
          background: linear-gradient(135deg, #c084fc, #ec4899); cursor: pointer;
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.55); }
      `}</style>
    </AnimatePresence>
  );
}

// ── cropToBlob ─────────────────────────────────────────────────────────────
// Given the original image URL + the pixel area react-easy-crop reports,
// draws the cropped region onto a canvas and returns a Blob. We preserve
// the source mime type when possible (so GIFs stay GIFs… well, except
// canvas.toBlob can't preserve GIF animation — animated GIFs get flattened
// to a still frame. Document this honestly in the UI hint.)
async function cropToBlob(imageSrc, area, mime) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(
    image,
    area.x, area.y, area.width, area.height,
    0, 0, area.width, area.height
  );
  const outputMime = mime === 'image/png' || mime === 'image/webp' ? mime : 'image/jpeg';
  const quality = outputMime === 'image/jpeg' ? 0.92 : undefined;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), outputMime, quality);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
