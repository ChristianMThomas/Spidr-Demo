import React from 'react';
import useStreamStats from '@/hooks/useStreamStats';
import { getFrameComponent } from './FrameRegistry';

/**
 * SymbioteStreamHUD (Patch 2.1 + 2.2) — an APEX-only tactical visor that sits
 * over a screen-share <video>. Renders:
 *   • the streamer's chosen frame (FrameRegistry → apexFrameStyle) in their
 *     APEX color, with breathing corner brackets + a pulsing inner glow;
 *   • a terminal telemetry readout (resolution/fps top-left, uplink/viewers
 *     top-right) driven by useStreamStats.
 *
 * Wraps absolutely over the video; pointer-events-none so it never blocks the
 * Stop button etc. underneath.
 *
 * Props:
 *   stream          screen-share MediaStream (for resolution/fps)
 *   peerConnection  optional RTCPeerConnection (for live bitrate)
 *   viewers         viewer count (peer count)
 *   apexColor       streamer's APEX thread color
 *   apexFrameStyle  frame id from FrameRegistry (default 'symbiote-tear')
 */
export default function SymbioteStreamHUD({ stream, peerConnection, viewers = 0, apexColor = '#FF3333', apexFrameStyle = 'symbiote-tear' }) {
  const { width, height, fps, bitrateMbps, viewers: viewerCount } = useStreamStats({ stream, peerConnection, viewers });
  const Frame = getFrameComponent(apexFrameStyle);

  const res = width && height ? `${width}x${height}` : '—';
  const fpsTxt = fps ? `${fps}` : '—';
  const upTxt = bitrateMbps != null ? `${bitrateMbps}` : '—';

  return (
    <div
      className="absolute inset-0 pointer-events-none z-20"
      style={{ '--apex-color': apexColor, boxShadow: `inset 0 0 20px ${apexColor}66` }}
    >
      {/* Frame brackets (animated, APEX-colored) */}
      <Frame color={apexColor} />

      {/* Telemetry — top-left */}
      <div className="absolute top-2 left-3 font-mono text-[10px] tracking-[0.2em] text-white/70 select-none">
        <span>{'> SYS.RES: '}</span>
        <span style={{ color: apexColor }}>{res}</span>
        <span>{' // '}</span>
        <span style={{ color: apexColor }}>{fpsTxt}</span>
        <span>{' FPS'}</span>
      </div>

      {/* Telemetry — top-right */}
      <div className="absolute top-2 right-3 font-mono text-[10px] tracking-[0.2em] text-white/70 text-right select-none">
        <span>{'> UPLINK: '}</span>
        <span style={{ color: apexColor }}>{upTxt}</span>
        <span>{' Mbps // EYES: '}</span>
        <span style={{ color: apexColor }}>{viewerCount}</span>
      </div>
    </div>
  );
}
