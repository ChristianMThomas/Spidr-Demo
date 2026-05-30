import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * MediaContext (Patch 2.9) — global state for the shared-layout image lightbox.
 * Any chat image can call openImage(props) to expand it into the full-screen
 * "Void" overlay (mounted once at the shell root).
 *
 * expandedImage shape: { id, src, senderName, apexColor, resolution, size }
 */
const MediaContext = createContext(null);

export function MediaProvider({ children }) {
  const [expandedImage, setExpandedImage] = useState(null);

  const openImage = useCallback((props) => setExpandedImage(props || null), []);
  const closeImage = useCallback(() => setExpandedImage(null), []);

  return (
    <MediaContext.Provider value={{ expandedImage, openImage, closeImage }}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  const ctx = useContext(MediaContext);
  // Safe fallback so components using useMedia() never crash if the provider
  // isn't mounted (e.g. isolated previews).
  return ctx || { expandedImage: null, openImage: () => {}, closeImage: () => {} };
}

export default MediaContext;
