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
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
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