import { useEffect, useRef, useState } from 'react';

/**
 * Observes a container element and auto-plays/pauses a video ref
 * based on whether it's visible in the viewport (IntersectionObserver).
 * 
 * @param {React.RefObject} videoRef - ref to the <video> element
 * @param {number} threshold - how much of the container must be visible (0.0 - 1.0)
 * @returns {[React.RefObject, boolean]} - [containerRef, isVisible]
 */
export default function useVideoIntersection(videoRef, threshold = 0.5) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { root: null, rootMargin: '0px', threshold }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [threshold]);

  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return;

    if (isVisible) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isVisible, videoRef]);

  return [containerRef, isVisible];
}