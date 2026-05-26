import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Minimize2, Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { auth } from '@/api/apiClient';
import { useWebRTC } from '@/components/spidr/useWebRTC';

/**
 * PopoutCall — the page loaded inside the Electron pop-out child window
 * (route: /popout/call?serverId=&channelId=&groupId=).
 *
 * A live MediaStream can't be passed over IPC, so this window re-joins the
 * SAME call over the existing socket signaling (same authenticated user, same
 * channel) and renders its own video grid. Frameless + always-on-top is set on
 * the Electron side. Closing the window notifies the main window to restore its
 * inline grid.
 *
 * Outside Electron this route still renders (useful for testing) but the
 * window-chrome controls simply no-op.
 */
export default function PopoutCall() {
  const [params] = useSearchParams();
  const serverId  = params.get('serverId')  || undefined;
  const channelId = params.get('channelId') || undefined;
  const groupId   = params.get('groupId')   || undefined;

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let alive = true;
    auth.me?.().then(u => { if (alive) setCurrentUser(u); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const rtc = useWebRTC({
    channelId, serverId, groupId,
    currentUser,
    enabled: !!currentUser && (!!channelId || !!groupId),
  });

  const closeWindow = () => {
    if (window.electronAPI?.closePopout) window.electronAPI.closePopout();
    else window.close();
  };

  return (
    <div className="w-screen h-screen bg-[#0a0a0a] flex flex-col overflow-hidden select-none">
      {/* Draggable title strip (Electron frameless drag region via CSS) */}
      <div
        className="h-8 flex items-center justify-between px-3 bg-black/60 border-b border-white/10"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Spidr · Call</span>
        <button
          onClick={closeWindow}
          style={{ WebkitAppRegion: 'no-drag' }}
          className="text-zinc-500 hover:text-white transition-colors"
          title="Return to main window"
        >
          <Minimize2 size={14} />
        </button>
      </div>

      {/* Video grid */}
      <div className="flex-1 p-2 grid gap-2 content-center"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <PopoutSelf stream={rtc.localStream} isVideoOn={rtc.isVideoOn} />
        {Object.entries(rtc.remoteStreams || {}).map(([sid, stream]) => (
          <PopoutRemote key={sid} stream={stream} />
        ))}
      </div>

      {/* Minimal controls */}
      <div className="h-12 flex items-center justify-center gap-3 bg-black/60 border-t border-white/10"
        style={{ WebkitAppRegion: 'no-drag' }}>
        <button onClick={rtc.toggleMute}
          className={`w-9 h-9 rounded-full flex items-center justify-center ${rtc.isMuted ? 'bg-zinc-800 text-red-400' : 'bg-green-600 text-white'}`}>
          {rtc.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
        <button onClick={rtc.toggleVideo}
          className={`w-9 h-9 rounded-full flex items-center justify-center ${rtc.isVideoOn ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
          {rtc.isVideoOn ? <Video size={16} /> : <VideoOff size={16} />}
        </button>
        <button onClick={closeWindow}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-red-600 text-white">
          <PhoneOff size={16} />
        </button>
      </div>
    </div>
  );
}

function PopoutSelf({ stream, isVideoOn }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative aspect-video rounded-lg overflow-hidden border border-[#FF3333]/50 bg-black flex items-center justify-center">
      {isVideoOn
        ? <video ref={ref} autoPlay muted className="w-full h-full object-cover" />
        : <span className="text-[10px] text-zinc-500">You</span>}
    </div>
  );
}

function PopoutRemote({ stream }) {
  const vref = useRef(null);
  const aref = useRef(null);
  useEffect(() => {
    if (vref.current && stream) vref.current.srcObject = stream;
    if (aref.current && stream) { aref.current.srcObject = stream; aref.current.play?.().catch(() => {}); }
  }, [stream]);
  const hasVideo = stream?.getVideoTracks?.().length > 0;
  return (
    <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center">
      {hasVideo
        ? <video ref={vref} autoPlay className="w-full h-full object-cover" />
        : <span className="text-[10px] text-zinc-500">Connected</span>}
      <audio ref={aref} autoPlay className="hidden" />
    </div>
  );
}
