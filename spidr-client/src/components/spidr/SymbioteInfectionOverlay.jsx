import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppShell } from '@/context/AppShellContext';

/**
 * SymbioteInfectionOverlay (Patch 2.0) — a dormant, fullscreen layer that
 * "infects" the viewport with an APEX user's thread color when their profile
 * modal is opened. Reacts to `activeApexProfile` from AppShellContext.
 *
 * Z-index strategy: chat z-10, sidebar z-20, THIS overlay z-[100], modals
 * z-[200]. So it covers the app but renders behind the profile modal.
 *
 * The "creep" is a morphing SVG mask: a radial blob that grows from dormant to
 * full spread, applied as a mask over an APEX-colored gradient. pointer-events
 * are disabled so it never blocks interaction with the modal above it.
 */
export default function SymbioteInfectionOverlay() {
  const { activeApexProfile } = useAppShell();
  const isApex = !!activeApexProfile?.isApex;
  const color = activeApexProfile?.color || '#FF3333';

  return (
    <AnimatePresence>
      {isApex && (
        <motion.div
          key="symbiote-infection"
          className="fixed inset-0 z-[100] pointer-events-none w-screen h-screen"
          style={{ '--active-apex-color': color, backgroundColor: 'rgba(5,5,5,0.30)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* APEX-colored gradient, revealed through a morphing organic mask */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <radialGradient id="symbioteFade" cx="50%" cy="50%" r="75%">
                <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <stop offset="55%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </radialGradient>
              <filter id="symbioteGoo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur" />
                <feColorMatrix in="blur" mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="goo" />
              </filter>
              <mask id="symbioteMask">
                {/* viscous creeping blobs that animate outward */}
                <motion.g
                  filter="url(#symbioteGoo)"
                  initial={{ scale: 0.15, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.15, opacity: 0 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
                >
                  <circle cx="50%" cy="50%" r="42%" fill="white" />
                  <circle cx="22%" cy="30%" r="20%" fill="white" />
                  <circle cx="80%" cy="26%" r="18%" fill="white" />
                  <circle cx="18%" cy="78%" r="22%" fill="white" />
                  <circle cx="84%" cy="80%" r="20%" fill="white" />
                  <circle cx="50%" cy="92%" r="16%" fill="white" />
                  <circle cx="50%" cy="8%" r="16%" fill="white" />
                </motion.g>
              </mask>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#symbioteFade)" mask="url(#symbioteMask)" />
          </svg>

          {/* Thin vignette of the APEX color around the edges for extra "creep" */}
          <div
            className="absolute inset-0"
            style={{ boxShadow: `inset 0 0 140px 30px ${color}33`, mixBlendMode: 'screen' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
