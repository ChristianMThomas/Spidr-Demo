import React from 'react';
import { motion } from 'framer-motion';
import { useMenu } from '@/components/MenuContext';
import { useMedia } from '@/context/MediaContext';

/**
 * ContextableImage — drop-in replacement for <img> for user-uploaded chat
 * images. Adds two behaviors over a plain <img>:
 *   • right-click / long-press → "media" context menu (unchanged)
 *   • click → expands into the global ImageLightboxOverlay via framer shared
 *     layout (Patch 2.9). The layoutId is derived from the src so the thumbnail
 *     and the expanded image map to the same node.
 *
 * Optional props for the lightbox HUD: senderName, apexColor, resolution, size.
 * All other props pass through to the underlying <img>.
 */
export default function ContextableImage({
  src, alt, filename, onContextMenu, onClick,
  senderName, apexColor, resolution, size,
  ...rest
}) {
  const { triggerMenu } = useMenu();
  const { openImage } = useMedia();

  // Stable id shared between thumbnail and the expanded overlay image.
  const layoutId = `img-${src}`;

  const handleContext = (e) => {
    if (!src) return;
    if (onContextMenu) onContextMenu(e);
    if (e.defaultPrevented) return;
    triggerMenu(e, 'media', {
      url: src,
      src,
      filename: filename || src.split('/').pop()?.split('?')[0] || 'image',
      name: alt || filename || 'Image',
    });
  };

  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented || !src) return;
    openImage({ id: layoutId, src, name: alt, senderName, apexColor, resolution, size });
  };

  return (
    <motion.img
      layoutId={layoutId}
      src={src}
      alt={alt}
      onContextMenu={handleContext}
      onClick={handleClick}
      {...rest}
    />
  );
}
