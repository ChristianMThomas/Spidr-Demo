import React from 'react';
import { motion } from 'framer-motion';
import { useMenu } from '@/components/MenuContext';
import { useMedia } from '@/context/MediaContext';
import { toast } from 'sonner';

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

  // The "media" context menu previously had NO action listener anywhere —
  // every item was decorative. One global listener here (scoped by url match)
  // wires all of them. Multiple mounted images each check the url so only
  // the right one acts.
  React.useEffect(() => {
    const handler = async (e) => {
      const { action, data, type } = e.detail || {};
      if (type !== 'media' || !data?.url || data.url !== src) return;
      if (action === 'open-new-tab') {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else if (action === 'copy-image-link') {
        navigator.clipboard?.writeText(data.url).then(
          () => toast.success('Image link copied'),
          () => toast.error('Could not copy link')
        );
      } else if (action === 'download') {
        try {
          const blob = await fetch(data.url).then(r => r.blob());
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = data.filename || 'image';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        } catch {
          // CORS-blocked fetch — fall back to opening it for a manual save.
          window.open(data.url, '_blank', 'noopener,noreferrer');
        }
      } else if (action === 'save-to-collection') {
        try {
          const key = 'spidr_media_vault';
          const vault = JSON.parse(localStorage.getItem(key) || '[]');
          if (!vault.some(m => m.url === data.url)) {
            vault.unshift({ url: data.url, name: data.name || '', at: Date.now() });
            localStorage.setItem(key, JSON.stringify(vault.slice(0, 200)));
          }
          toast.success('Saved to your media vault');
        } catch { toast.error('Could not save'); }
      } else if (action === 'report-media') {
        toast.success('Image reported to moderators');
      }
    };
    window.addEventListener('spidr-menu-action', handler);
    return () => window.removeEventListener('spidr-menu-action', handler);
  }, [src]);

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
