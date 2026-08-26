import React from 'react';

/**
 * ChatBackdrop — renders a custom chat wallpaper behind a message list.
 *
 * Two layers, and the second one is the important one: a wallpaper without a
 * scrim makes message text unreadable the moment someone picks a bright or
 * busy image. So whenever a background is set we lay a dark wash plus a
 * slight blur over it. The messages themselves render above both.
 *
 * When no background is set this renders nothing at all and the normal theme
 * shows through — no wrapper div, no stacking context, no layout change.
 *
 * Usage:
 *   <div className="relative flex-1">
 *     <ChatBackdrop url={bgUrl} />
 *     <div className="relative z-10"> ...messages... </div>
 *   </div>
 */
export default function ChatBackdrop({ url, dim = 0.62, blur = 2 }) {
  if (!url) return null;
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: `url(${url})` }}
      />
      {/* Readability scrim — without this, light wallpapers make white
          message text vanish. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `rgba(0,0,0,${dim})`,
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
        }}
      />
    </>
  );
}
