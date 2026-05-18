import React from 'react';
import { useMenu } from '@/components/MenuContext';

/**
 * ContextableImage — drop-in replacement for <img> that opens the
 * "media" context menu on right-click.
 *
 * Use this for any user-uploaded image in chats, attachments, and clip
 * thumbnails so the right-click menu always offers Open in New Tab / Copy
 * Link / Download / Save to Collection / Report.
 *
 * Passes through every prop to the underlying <img>; the only added
 * behavior is the onContextMenu handler.
 */
export default function ContextableImage({ src, alt, filename, onContextMenu, ...rest }) {
  const { triggerMenu } = useMenu();

  const handleContext = (e) => {
    if (!src) return;
    // Allow callers to pre-empt or add behavior via onContextMenu prop
    if (onContextMenu) onContextMenu(e);
    if (e.defaultPrevented) return;
    triggerMenu(e, 'media', {
      url: src,
      src,
      filename: filename || src.split('/').pop()?.split('?')[0] || 'image',
      name: alt || filename || 'Image',
    });
  };

  return <img src={src} alt={alt} onContextMenu={handleContext} {...rest} />;
}
