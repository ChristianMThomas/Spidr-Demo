import { useEffect, useState } from 'react';

const EMPTY = { bufferMs: null, jitterMs: null, roundTripMs: null };
const milliseconds = value => Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) : null;

// Receiver buffering is measurable; the offset between listeners is not.
// https://developer.mozilla.org/en-US/docs/Web/API/RTCInboundRtpStreamStats/jitterBufferEmittedCount
export default function useDJStreamStats(peerConnection, stream, enabled) {
  const [sample, setSample] = useState(null);

  useEffect(() => {
    setSample(null);
    const track = stream?.getAudioTracks?.()[0];
    if (!enabled || !track || !peerConnection?.getStats) return;
    let cancelled = false;
    let timer;
    let previous = null;
    const poll = async () => {
      try {
        const report = await peerConnection.getStats();
        if (cancelled) return;
        let inbound;
        report.forEach(stat => {
          if (stat.type === 'inbound-rtp' && stat.trackIdentifier === track.id &&
              (stat.kind === 'audio' || stat.mediaType === 'audio')) inbound = stat;
        });
        const transport = inbound && report.get(inbound.transportId);
        const pair = transport && report.get(transport.selectedCandidatePairId);
        let bufferMs = null;
        if (inbound) {
          const count = inbound.jitterBufferEmittedCount;
          const delay = inbound.jitterBufferDelay;
          // Use this sampling interval, avoiding a stale lifetime average.
          if (previous?.id === inbound.id && count > previous.count && delay >= previous.delay) {
            bufferMs = milliseconds((delay - previous.delay) / (count - previous.count));
          } else if (!previous && count > 0) {
            bufferMs = milliseconds(delay / count);
          }
          previous = { id: inbound.id, count, delay };
        } else previous = null;
        setSample({ peerConnection, stream, values: {
          bufferMs,
          jitterMs: milliseconds(inbound?.jitter),
          roundTripMs: milliseconds(pair?.currentRoundTripTime),
        } });
      } catch {
        if (!cancelled) setSample(null);
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [peerConnection, stream, enabled]);

  return enabled && sample?.peerConnection === peerConnection && sample?.stream === stream ? sample.values : EMPTY;
}
