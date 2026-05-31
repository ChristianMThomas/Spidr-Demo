import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * The Pulse Auto-Play Engine (Patch 2.13).
 *
 * A module-level singleton guarantees that only ONE grafted-audio node plays at
 * a time (the one most centered in the viewport wins). Plus a custom hook that
 * wires an IntersectionObserver to a post container and drives play/pause with
 * volume fades and graceful autoplay-policy fallback.
 */

// ── Single-audio coordinator ───────────────────────────────────────────────
let activeId = null;
const subscribers = new Map(); // id -> setActive(bool)

function claim(id) {
  if (activeId === id) return;
  if (activeId && subscribers.has(activeId)) subscribers.get(activeId)(false);
  activeId = id;
  if (subscribers.has(id)) subscribers.get(id)(true);
}
function release(id) {
  if (activeId === id) activeId = null;
}

// Tracks whether the user has interacted with the page yet (autoplay policy).
let userHasInteracted = false;
if (typeof window !== 'undefined') {
  const mark = () => { userHasInteracted = true; window.removeEventListener('pointerdown', mark); window.removeEventListener('keydown', mark); };
  window.addEventListener('pointerdown', mark);
  window.addEventListener('keydown', mark);
}

/**
 * useViewportMedia(audioRef, { id, threshold, targetVolume })
 * Returns { containerRef, isActive, isMuted, requestUnmute }.
 *  - containerRef: attach to the post container
 *  - isActive: this node is the chosen one and intersecting
 *  - isMuted: true if blocked by autoplay policy (needs a tap)
 *  - requestUnmute: call on user tap to satisfy the policy + start audio
 */
export function useViewportMedia(audioRef, { id, threshold = 0.7, targetVolume = 0.8 } = {}) {
  const containerRef = useRef(null);
  const [intersecting, setIntersecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const fadeRef = useRef(null);
  const ratioRef = useRef(0);

  // Subscribe to the coordinator.
  useEffect(() => {
    if (!id) return;
    subscribers.set(id, setIsActive);
    return () => { subscribers.delete(id); release(id); };
  }, [id]);

  // Observe the container; the most-visible node claims the audio slot.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      ratioRef.current = entry.intersectionRatio;
      const visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
      setIntersecting(visible);
      if (visible) claim(id); else release(id);
    }, { threshold: [0, threshold, 1] });
    obs.observe(el);
    return () => obs.disconnect();
  }, [id, threshold]);

  const clearFade = () => { if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current = null; } };

  // Smoothly fade volume to a target over ~300ms.
  const fadeTo = useCallback((audio, target, after) => {
    clearFade();
    const step = (target - audio.volume) / 12;
    fadeRef.current = setInterval(() => {
      let v = audio.volume + step;
      if ((step >= 0 && v >= target) || (step < 0 && v <= target)) { v = target; clearFade(); after?.(); }
      audio.volume = Math.max(0, Math.min(1, v));
    }, 25);
  }, []);

  // Drive play/pause when this node becomes the active+visible one.
  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    const shouldPlay = isActive && intersecting;

    if (shouldPlay) {
      audio.volume = 0;
      const p = audio.play();
      if (p && p.catch) {
        p.then(() => { setIsMuted(false); fadeTo(audio, targetVolume); })
         .catch((err) => {
           // Autoplay blocked → show the muted "tap to initiate" state.
           if (err && err.name === 'NotAllowedError') setIsMuted(true);
         });
      } else {
        fadeTo(audio, targetVolume);
      }
    } else {
      // Fade down, then pause.
      if (!audio.paused) fadeTo(audio, 0, () => { try { audio.pause(); } catch {} });
    }
    return clearFade;
  }, [isActive, intersecting, audioRef, fadeTo, targetVolume]);

  // User tapped the node → satisfy autoplay policy and start.
  const requestUnmute = useCallback(() => {
    userHasInteracted = true;
    const audio = audioRef?.current;
    if (!audio) return;
    setIsMuted(false);
    audio.volume = 0;
    audio.play().then(() => fadeTo(audio, targetVolume)).catch(() => {});
  }, [audioRef, fadeTo, targetVolume]);

  return { containerRef, isActive: isActive && intersecting, isMuted, requestUnmute };
}

export default useViewportMedia;
