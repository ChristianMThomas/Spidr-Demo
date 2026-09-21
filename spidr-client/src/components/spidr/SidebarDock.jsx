import React, { useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import './SidebarDock.css';

// The navigation stays mounted while hidden. Its edge handle is outside the
// sliding panel, so neither hiding it nor moving it can strand the user.
export default function SidebarDock({ position, opacity = 100, children }) {
  const [expanded, setExpanded] = useState(false);
  const dockRef = useRef(null);
  const triggerRef = useRef(null);
  const ignoreFocusRef = useRef(false);
  const hidden = position === 'hidden';
  const open = !hidden || expanded;

  return (
    <div
      ref={dockRef}
      className="spidr-sidebar-dock"
      data-position={position}
      data-open={open}
      onPointerEnter={() => setExpanded(true)}
      onPointerLeave={() => {
        // A mouse click leaves focus on its button. Only keyboard focus should
        // hold the panel open after the pointer leaves the navigation.
        const focused = document.activeElement;
        if (!dockRef.current?.contains(focused) || !focused?.matches(':focus-visible')) setExpanded(false);
      }}
      onFocusCapture={() => {
        if (!ignoreFocusRef.current) setExpanded(true);
      }}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget) && !event.currentTarget.matches(':hover')) setExpanded(false);
      }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !hidden || !expanded) return;
        event.preventDefault();
        event.stopPropagation();
        ignoreFocusRef.current = true;
        triggerRef.current?.focus();
        ignoreFocusRef.current = false;
        setExpanded(false);
      }}
    >
      {hidden && <button
        ref={triggerRef}
        type="button"
        className="spidr-sidebar-handle"
        aria-label={expanded ? 'Hide navigation' : 'Show navigation'}
        aria-expanded={expanded}
        aria-controls="spidr-desktop-navigation"
        onClick={() => setExpanded(value => !value)}
      ><ChevronRight size={12} aria-hidden="true" /></button>}
      <div
        id="spidr-desktop-navigation"
        className="spidr-sidebar-panel"
        aria-hidden={!open}
        inert={!open ? '' : undefined}
        style={{ opacity: Math.min(100, Math.max(30, Number(opacity) || 100)) / 100 }}
      >{children}</div>
    </div>
  );
}
