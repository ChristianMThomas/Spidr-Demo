import React, { useRef, useState, useCallback, useEffect } from 'react';

/**
 * SpidrCropper — a self-contained pan/zoom/aspect-lock cropper with the same
 * interface as `react-easy-crop` (props: image|video, crop, zoom, aspect,
 * onCropChange, onZoomChange, onCropComplete) so it can be swapped for the npm
 * package by changing one import once the dependency is installed.
 *
 * IMPORTANT: this does NOT do raw-canvas mouse-coordinate math (which is buggy
 * with <video>). Instead the media is rendered as a normal element transformed
 * with translate()/scale() inside a fixed crop frame, and the crop region in
 * natural-pixel space is derived analytically from the transform. This is the
 * same approach react-easy-crop uses and avoids the canvas pitfalls the task
 * warns about.
 *
 * onCropComplete fires with (croppedArea, croppedAreaPixels) where
 * croppedAreaPixels = { x, y, width, height } in the media's natural pixels —
 * exactly what an FFmpeg `crop=w:h:x:y` filter (or a client-side canvas crop)
 * needs.
 *
 * Props:
 *   videoSrc / imageSrc — the media to crop (one of)
 *   aspect              — target aspect ratio (w/h), e.g. 9/16
 *   crop / zoom         — controlled { x, y } px offset + zoom (>=1)
 *   onCropChange / onZoomChange / onCropComplete
 *   gridColor           — overlay grid color (default neon blue)
 */
export default function SpidrCropper({
  videoSrc,
  imageSrc,
  aspect = 9 / 16,
  crop,
  zoom,
  onCropChange,
  onZoomChange,
  onCropComplete,
  gridColor = '#3b82f6',
}) {
  const containerRef = useRef(null);
  const mediaRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cropSize, setCropSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [mediaBase, setMediaBase] = useState({ width: 0, height: 0 }); // "cover" base size at zoom=1
  const dragRef = useRef(null);

  // Measure the container and compute the crop-frame size (largest rect with
  // the target aspect that fits inside the container).
  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    setContainerSize({ width: w, height: h });
    // crop frame fits inside container at the target aspect
    let cw = w, ch = w / aspect;
    if (ch > h) { ch = h; cw = h * aspect; }
    setCropSize({ width: cw, height: ch });
  }, [aspect]);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Once we know natural size + crop size, compute the base "cover" dimensions
  // (media scaled so it fully covers the crop frame at zoom = 1).
  useEffect(() => {
    if (!naturalSize.width || !cropSize.width) return;
    const scale = Math.max(cropSize.width / naturalSize.width, cropSize.height / naturalSize.height);
    setMediaBase({ width: naturalSize.width * scale, height: naturalSize.height * scale });
  }, [naturalSize, cropSize]);

  // Clamp the offset so the (zoomed) media always covers the crop frame.
  const clampCrop = useCallback((next, z = zoom) => {
    const mediaW = mediaBase.width * z;
    const mediaH = mediaBase.height * z;
    const maxX = Math.max(0, (mediaW - cropSize.width) / 2);
    const maxY = Math.max(0, (mediaH - cropSize.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, [mediaBase, cropSize, zoom]);

  // Emit croppedAreaPixels whenever the transform settles.
  const emitComplete = useCallback((c = crop, z = zoom) => {
    if (!onCropComplete || !naturalSize.width || !mediaBase.width) return;
    // Natural pixels per displayed pixel at this zoom.
    const dispW = mediaBase.width * z;
    const pxPerDisp = naturalSize.width / dispW;
    // Top-left of the crop frame in displayed-media space:
    // media is centered then offset by crop.{x,y}.
    const mediaLeft = (cropSize.width - dispW) / 2 + c.x;
    const mediaTop  = (cropSize.height - mediaBase.height * z) / 2 + c.y;
    const cropLeftInMedia = -mediaLeft;
    const cropTopInMedia  = -mediaTop;
    const widthPx  = Math.round(cropSize.width  * pxPerDisp);
    const heightPx = Math.round(cropSize.height * pxPerDisp);
    const xPx = Math.round(Math.max(0, cropLeftInMedia * pxPerDisp));
    const yPx = Math.round(Math.max(0, cropTopInMedia  * pxPerDisp));
    const croppedAreaPixels = {
      x: Math.min(xPx, Math.max(0, naturalSize.width - widthPx)),
      y: Math.min(yPx, Math.max(0, naturalSize.height - heightPx)),
      width: Math.min(widthPx, naturalSize.width),
      height: Math.min(heightPx, naturalSize.height),
    };
    const croppedArea = {
      x: (croppedAreaPixels.x / naturalSize.width) * 100,
      y: (croppedAreaPixels.y / naturalSize.height) * 100,
      width: (croppedAreaPixels.width / naturalSize.width) * 100,
      height: (croppedAreaPixels.height / naturalSize.height) * 100,
    };
    onCropComplete(croppedArea, croppedAreaPixels);
  }, [crop, zoom, naturalSize, mediaBase, cropSize, onCropComplete]);

  // Re-emit when geometry or controlled props change.
  useEffect(() => { emitComplete(crop, zoom); }, [crop, zoom, mediaBase, cropSize, emitComplete]);

  const onMediaLoaded = (e) => {
    const t = e.target;
    const nw = t.naturalWidth || t.videoWidth || 0;
    const nh = t.naturalHeight || t.videoHeight || 0;
    if (nw && nh) setNaturalSize({ width: nw, height: nh });
  };

  // ── Pointer drag (pan) ──────────────────────────────────────────────────
  const onPointerDown = (e) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const orig = { ...crop };
    dragRef.current = { startX, startY, orig };
    const move = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onCropChange?.(clampCrop({ x: dragRef.current.orig.x + dx, y: dragRef.current.orig.y + dy }));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      emitComplete();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Wheel to zoom (clamped 1–3), re-clamping the offset.
  const onWheel = (e) => {
    e.preventDefault();
    const next = Math.min(3, Math.max(1, zoom - e.deltaY * 0.0015));
    onZoomChange?.(next);
    onCropChange?.(clampCrop(crop, next));
  };

  const mediaW = mediaBase.width * zoom;
  const mediaH = mediaBase.height * zoom;
  const mediaStyle = {
    width: mediaW ? `${mediaW}px` : 'auto',
    height: mediaH ? `${mediaH}px` : 'auto',
    transform: `translate(${crop.x}px, ${crop.y}px)`,
    maxWidth: 'none',
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black cursor-move select-none touch-none"
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      {/* Media, centered then transformed */}
      <div className="absolute inset-0 flex items-center justify-center">
        {videoSrc ? (
          <video
            ref={mediaRef}
            src={videoSrc}
            onLoadedMetadata={onMediaLoaded}
            muted loop autoPlay playsInline
            style={mediaStyle}
            className="object-cover pointer-events-none"
          />
        ) : (
          <img
            ref={mediaRef}
            src={imageSrc}
            onLoad={onMediaLoaded}
            alt=""
            style={mediaStyle}
            className="object-cover pointer-events-none"
            draggable={false}
          />
        )}
      </div>

      {/* Dimmed overlay outside the crop frame (4 panels around the centered
          crop rect). Significantly darkens the excluded area (6.3). */}
      <Overlay containerSize={containerSize} cropSize={cropSize} gridColor={gridColor} />
    </div>
  );
}

function Overlay({ containerSize, cropSize, gridColor }) {
  if (!cropSize.width || !containerSize.width) return null;
  const left = (containerSize.width - cropSize.width) / 2;
  const top = (containerSize.height - cropSize.height) / 2;
  return (
    <>
      {/* Four dim panels */}
      <div className="absolute left-0 right-0 top-0 bg-black/80 pointer-events-none" style={{ height: top }} />
      <div className="absolute left-0 right-0 bottom-0 bg-black/80 pointer-events-none" style={{ height: top }} />
      <div className="absolute left-0 bg-black/80 pointer-events-none" style={{ top, height: cropSize.height, width: left }} />
      <div className="absolute right-0 bg-black/80 pointer-events-none" style={{ top, height: cropSize.height, width: left }} />

      {/* Crop frame + thirds grid in neon color */}
      <div
        className="absolute pointer-events-none"
        style={{ left, top, width: cropSize.width, height: cropSize.height, boxShadow: `0 0 0 2px ${gridColor}, 0 0 18px ${gridColor}88` }}
      >
        {/* rule-of-thirds lines */}
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-0 right-0 h-px" style={{ background: `${gridColor}66` }} />
          <div className="absolute top-2/3 left-0 right-0 h-px" style={{ background: `${gridColor}66` }} />
          <div className="absolute left-1/3 top-0 bottom-0 w-px" style={{ background: `${gridColor}66` }} />
          <div className="absolute left-2/3 top-0 bottom-0 w-px" style={{ background: `${gridColor}66` }} />
        </div>
      </div>
    </>
  );
}
