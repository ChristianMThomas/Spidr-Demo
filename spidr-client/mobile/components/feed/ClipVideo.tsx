import React, { useEffect, useRef } from 'react';
import { View, TouchableWithoutFeedback, Pressable } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play } from 'lucide-react-native';

export interface ClipVideoProps {
  uri: string;
  active: boolean;
  muted: boolean;
  onWatchTick?: (watchSeconds: number, totalDuration: number, looped: boolean) => void;
}

// Lightweight expo-video wrapper:
//   - autoplays + loops while `active`
//   - pauses + rewinds to 0 when inactive (so re-entering the clip restarts it)
//   - tap toggles play/pause with a 0.4s center play-icon overlay
//   - reports watch time + loop count up via onWatchTick for engagement scoring
// Defense-in-depth: refuse to hand expo-video any URI that isn't http(s).
// A compromised or malicious server response that set video_url to
// `file:///…` or `javascript:…` should not load at all on the client.
function isSafeMediaUri(u: string | undefined | null): boolean {
  if (!u) return false;
  try {
    const proto = new URL(u).protocol;
    return proto === 'http:' || proto === 'https:';
  } catch {
    return false;
  }
}

export function ClipVideo({ uri, active, muted, onWatchTick }: ClipVideoProps) {
  const safeUri = isSafeMediaUri(uri) ? uri : '';
  const player = useVideoPlayer(safeUri, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  const [paused, setPaused] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const watchRef = useRef({ start: 0, accumulated: 0, lastLoopAt: 0, loopCount: 0 });

  // Keep player.muted in sync with the prop (parent owns global mute state).
  useEffect(() => { player.muted = muted; }, [muted, player]);

  // Drive autoplay off `active`. When swiping off the card we pause + rewind
  // so the next viewer of this card starts from frame 0.
  useEffect(() => {
    if (active && !paused) {
      try { player.play(); } catch {}
      watchRef.current.start = Date.now();
    } else {
      try { player.pause(); } catch {}
      if (!active) {
        try { player.currentTime = 0; } catch {}
        // Flush accumulated watch on swipe-away.
        flushWatch();
        watchRef.current = { start: 0, accumulated: 0, lastLoopAt: 0, loopCount: 0 };
      }
    }
  }, [active, paused, player]);

  // Cheap loop detector: when currentTime resets close to 0 after being > 1s in,
  // count it as a loop. expo-video doesn't fire a discrete loop event in SDK 54.
  useEffect(() => {
    if (!active) return;
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      const w = watchRef.current;
      if (w.lastLoopAt > 1 && currentTime < 0.3) w.loopCount += 1;
      w.lastLoopAt = currentTime;
    });
    return () => sub.remove();
  }, [active, player]);

  function flushWatch() {
    const w = watchRef.current;
    if (!w.start) return;
    const seconds = w.accumulated + (Date.now() - w.start) / 1000;
    const total = player.duration || 0;
    onWatchTick?.(seconds, total, w.loopCount > 0);
  }

  const togglePause = () => {
    setPaused((p) => !p);
    setShowOverlay(true);
    setTimeout(() => setShowOverlay(false), 500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <TouchableWithoutFeedback onPress={togglePause}>
        <View style={{ flex: 1 }}>
          <VideoView
            player={player}
            style={{ flex: 1 }}
            contentFit="contain"
            nativeControls={false}
            fullscreenOptions={{ enable: false }}
            allowsPictureInPicture={false}
          />
          {(paused || showOverlay) && (
            <Pressable
              onPress={togglePause}
              style={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Play size={32} color="#fff" fill="#fff" />
              </View>
            </Pressable>
          )}
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}
