import React, { createContext, useContext, useState, useEffect } from 'react';
import { playSound } from '@/components/spidr/SoundEngine';

const MenuContext = createContext();

export const MenuProvider = ({ children }) => {
  const [menu, setMenu] = useState({ 
    visible: false, 
    x: 0, 
    y: 0, 
    type: null,
    data: null 
  });

  useEffect(() => {
    const handleClick = () => setMenu(prev => ({ ...prev, visible: false }));
    const handleKey = (e) => { if (e.key === 'Escape') setMenu(prev => ({ ...prev, visible: false })); };
    // NOTE: we deliberately do NOT add a window-level contextmenu dismiss.
    // React synthetic events on inner elements fire BEFORE window-level
    // native listeners during bubbling, so a global dismiss handler would
    // close the menu *after* triggerMenu opens it. Right-clicking a
    // different element works fine without it — triggerMenu overwrites
    // the full menu state, replacing any open menu in one transition.
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const triggerMenu = (e, type, data) => {
    e.preventDefault();
    playSound('join');
    setMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data
    });
  };

  // Patch 2.10: mobile long-press → context menu. Returns touch handlers to
  // spread onto an element so a ~400ms hold opens the same menu as right-click.
  // Scrolling cancels it (movement > 10px). Fires a 50ms haptic on trigger.
  const bindLongPress = (type, data) => {
    let timer = null;
    let start = { x: 0, y: 0 };
    const begin = (x, y) => {
      start = { x, y };
      timer = setTimeout(() => {
        timer = null;
        try { navigator.vibrate?.(50); } catch {}
        playSound('join');
        setMenu({ visible: true, x, y, type, data });
      }, 400);
    };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    return {
      onTouchStart: (e) => { const t = e.touches?.[0]; if (t) begin(t.clientX, t.clientY); },
      onTouchMove: (e) => { const t = e.touches?.[0]; if (t && timer && (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10)) cancel(); },
      onTouchEnd: cancel,
      onTouchCancel: cancel,
    };
  };

  return (
    <MenuContext.Provider value={{ menu, triggerMenu, setMenu, bindLongPress }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => useContext(MenuContext);