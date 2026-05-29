import { useEffect, useRef, useState } from 'react';

/**
 * useStreamStats (Patch 2.1) — live telemetry for a screen/game share.
 *
 * The task is written for Mediasoup producers/consumers; this app is a plain
 * P2P RTCPeerConnection mesh, so we adapt:
 *   • Resolution + FPS come from the MediaStreamTrack settings (no SFU needed).
 *   • Bitrate comes from RTCPeerConnection.getStats() when a peer connection is
 *     supplied (bytesSent/bytesReceived delta over the poll interval); if no
 *     pc is available (e.g. local preview), bitrate stays null.
 *   • Viewers is passed in from the call's peer count (room state), since that's
 *     the P2P equivalent of "active consumers".
 *
 * @param {object}   opts
 * @param {MediaStream} opts.stream     the screen-share MediaStream
 * @param {RTCPeerConnection} [opts.peerConnection]  optional, for bitrate
 * @param {number}   [opts.viewers]     viewer count from room state
 * @param {number}   [opts.intervalMs]  poll cadence (default 2000)
 * @returns {{ width, height, fps, bitrateMbps, viewers }}
 */
export default function useStreamStats({ stream, peerConnection, viewers = 0, intervalMs = 2000 }) {
  const [stats, setStats] = useState({ width: 0, height: 0, fps: 0, bitrateMbps: null, viewers });
  const lastBytesRef = useRef(null);
  const lastTsRef = useRef(null);

  useEffect(() => {
    let alive = true;

    const sampleTrackSettings = () => {
      const track = stream?.getVideoTracks?.()[0];
      if (!track) return { width: 0, height: 0, fps: 0 };
      const s = track.getSettings?.() || {};
      return {
        width: s.width || 0,
        height: s.height || 0,
        fps: Math.round(s.frameRate || 0),
      };
    };

    const sampleBitrate = async () => {
      if (!peerConnection?.getStats) return null;
      try {
        const report = await peerConnection.getStats();
        let bytes = 0;
        report.forEach((r) => {
          if ((r.type === 'outbound-rtp' || r.type === 'inbound-rtp') && r.kind === 'video') {
            bytes += (r.bytesSent || r.bytesReceived || 0);
          }
        });
        const now = performance.now();
        let mbps = null;
        if (lastBytesRef.current != null && lastTsRef.current != null) {
          const dBytes = bytes - lastBytesRef.current;
          const dSec = (now - lastTsRef.current) / 1000;
          if (dSec > 0 && dBytes >= 0) mbps = ((dBytes * 8) / dSec) / 1_000_000;
        }
        lastBytesRef.current = bytes;
        lastTsRef.current = now;
        return mbps != null ? Math.max(0, +mbps.toFixed(1)) : null;
      } catch {
        return null;
      }
    };

    const tick = async () => {
      const { width, height, fps } = sampleTrackSettings();
      const bitrateMbps = await sampleBitrate();
      if (alive) {
        setStats((prev) => ({
          width, height, fps,
          bitrateMbps: bitrateMbps != null ? bitrateMbps : prev.bitrateMbps,
          viewers,
        }));
      }
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [stream, peerConnection, viewers, intervalMs]);

  return stats;
}
