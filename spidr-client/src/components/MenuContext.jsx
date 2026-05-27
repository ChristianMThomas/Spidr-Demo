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

  return (
    <MenuContext.Provider value={{ menu, triggerMenu, setMenu }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => useContext(MenuContext);