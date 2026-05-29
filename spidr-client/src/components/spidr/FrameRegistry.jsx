import React from 'react';
import { motion } from 'framer-motion';

/**
 * FrameRegistry (Patch 2.2) — maps a frame style id to an SVG frame component.
 * Each frame draws four corner "brackets" that grip the video feed. They accept
 * a `color` prop (the streamer's APEX thread color) and animate subtly.
 *
 * Frames render inside an absolute, full-size SVG overlay (viewBox 0 0 100 100,
 * preserveAspectRatio none) so they stretch to any 16:9 container.
 */

const breathe = {
  animate: { scale: [1, 1.01, 1], opacity: [0.8, 1, 0.8] },
  transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
};

function FrameSvg({ children, color }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// 1. Symbiote Tear — jagged, erratic web-tension strands gripping each corner.
function SymbioteTearFrame({ color = '#FF3333' }) {
  const corner = (path) => (
    <motion.path d={path} fill="none" stroke={color} strokeWidth="0.6" strokeLinejoin="round" {...breathe} />
  );
  return (
    <FrameSvg color={color}>
      {corner('M2 14 L4 5 L7 8 L9 3 L14 2')}
      {corner('M98 14 L96 5 L93 8 L91 3 L86 2')}
      {corner('M2 86 L4 95 L7 92 L9 97 L14 98')}
      {corner('M98 86 L96 95 L93 92 L91 97 L86 98')}
    </FrameSvg>
  );
}

// 2. Liquid Metal — smooth dark-chrome arcs that drip inward.
function LiquidMetalFrame({ color = '#FF3333' }) {
  const corner = (path) => (
    <motion.path d={path} fill="none" stroke={color} strokeWidth="0.7" strokeLinecap="round" {...breathe} />
  );
  return (
    <FrameSvg color={color}>
      {corner('M2 16 Q2 2 16 2')}
      {corner('M98 16 Q98 2 84 2')}
      {corner('M2 84 Q2 98 16 98')}
      {corner('M98 84 Q98 98 84 98')}
    </FrameSvg>
  );
}

// 3. Cyber Glitch — sharp, fractured neon edges.
function CyberGlitchFrame({ color = '#FF3333' }) {
  const corner = (path) => (
    <motion.path d={path} fill="none" stroke={color} strokeWidth="0.6" {...breathe} />
  );
  return (
    <FrameSvg color={color}>
      {corner('M2 12 L2 2 L12 2 M5 5 L9 5')}
      {corner('M98 12 L98 2 L88 2 M95 5 L91 5')}
      {corner('M2 88 L2 98 L12 98 M5 95 L9 95')}
      {corner('M98 88 L98 98 L88 98 M95 95 L91 95')}
    </FrameSvg>
  );
}

// 4. Void Pulse — minimalist gravitational ring distortion at corners.
function VoidPulseFrame({ color = '#FF3333' }) {
  const dot = (cx, cy) => (
    <motion.circle cx={cx} cy={cy} r="3" fill="none" stroke={color} strokeWidth="0.5"
      animate={{ r: [2.5, 4, 2.5], opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
  );
  return (
    <FrameSvg color={color}>
      {dot(6, 6)}{dot(94, 6)}{dot(6, 94)}{dot(94, 94)}
    </FrameSvg>
  );
}

export const FRAME_OPTIONS = [
  { id: 'symbiote-tear', name: 'Symbiote Tear', desc: 'Jagged web-tension brackets' },
  { id: 'liquid-metal',  name: 'Liquid Metal',  desc: 'Chrome drip morph corners' },
  { id: 'cyber-glitch',  name: 'Cyber Glitch',  desc: 'Fractured neon cyberpunk' },
  { id: 'void-pulse',    name: 'Void Pulse',    desc: 'Gravitational ring distortion' },
];

export const FrameRegistry = {
  'symbiote-tear': SymbioteTearFrame,
  'liquid-metal':  LiquidMetalFrame,
  'cyber-glitch':  CyberGlitchFrame,
  'void-pulse':    VoidPulseFrame,
};

export function getFrameComponent(id) {
  return FrameRegistry[id] || FrameRegistry['symbiote-tear'];
}
