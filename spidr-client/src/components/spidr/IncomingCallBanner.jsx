import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { entities, getSocket } from '@/api/apiClient';
import { useAppShell } from '@/context/AppShellContext';
import { Phone, PhoneOff } from 'lucide-react';
import SpiderLogo from './SpiderLogo';
import { playSound } from './SoundEngine';

/**
 * IncomingCallBanner — Spidr's themed incoming-call UI for DM + group calls.
 *
 * Mounted once at the shell level. Listens for the socket `call:incoming`
 * event (relayed by the server when another user starts a DM call, or a
 * group call invite goes out) and drops a banner down from the top of the
 * screen — as if the caller is descending on a web thread. The avatar
 * dangles on an animated silk strand with a pulsing web ring; Answer
 * (green) and Deny (red) sit below.
 *
 * Answer  → starts the voice session via shell context IMMEDIATELY (creates
 *           the VoiceSession row + mounts VoiceChannel/WebRTC), then
 *           navigates to the conversation. The call is live before the
 *           page transition completes, so no race window can drop it.
 * Deny    → emits `call:decline` and dismisses.
 * Caller cancels / no answer in 30s → auto-dismiss.
 *
 * A short web-pluck tone loops while ringing (WebAudio, no asset needed).
 * The ring is fully idempotent + audio-context-suspended on stop, so it
 * silences immediately on Answer/Deny even if duplicate `call:incoming`
 * events arrive.
 */
export default function IncomingCallBanner() {
  const navigate = useNavigate();
  const { currentUser, navigateToDM, startVoiceSession } = useAppShell();
  const [call, setCall] = useState(null); // { conversationId, caller, callerId, kind?, groupId? }
  const audioCtxRef = useRef(null);
  const ringTimerRef = useRef(null);
  const autoDismissRef = useRef(null);

  // ── Ringtone: a short, eerie two-note "web pluck" looped via WebAudio ──────
  const startRing = () => {
    // Idempotent: ALWAYS tear down any prior ring before starting a new one.
    // Without this, a duplicate `call:incoming` emit (or a useEffect cleanup
    // race) would orphan the previous setInterval — the new ref overwrite
    // makes the old timer untrackable and it rings forever.
    stopRing();
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const pluck = () => {
        if (!audioCtxRef.current || audioCtxRef.current !== ctx) return; // bail if torn down
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const t = ctx.currentTime;
        [392, 261.6].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = freq;
          const start = t + i * 0.18;
          g.gain.setValueAtTime(0.0001, start);
          g.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
          o.connect(g); g.connect(ctx.destination);
          o.start(start); o.stop(start + 0.34);
        });
      };
      pluck();
      ringTimerRef.current = setInterval(pluck, 2200);
    } catch { /* audio is best-effort */ }
  };
  const stopRing = () => {
    if (ringTimerRef.current) { clearInterval(ringTimerRef.current); ringTimerRef.current = null; }
    // Suspend the audio context so any in-flight scheduled oscillators go
    // silent immediately (without this, the last pluck() could still play
    // for up to ~520ms after stopRing). Best-effort.
    try { audioCtxRef.current?.suspend?.(); } catch { /* ignore */ }
  };

  const dismiss = () => {
    stopRing();
    if (autoDismissRef.current) { clearTimeout(autoDismissRef.current); autoDismissRef.current = null; }
    setCall(null);
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    const socket = getSocket();

    const onIncoming = (payload) => {
      if (!payload) return;
      // Ignore a call we somehow initiated ourselves.
      if (payload.callerId && payload.callerId === currentUser.id) return;
      setCall(payload);
      startRing();
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      autoDismissRef.current = setTimeout(() => dismiss(), 30000);
    };
    const onCancelled = () => dismiss();

    socket.on('call:incoming', onIncoming);
    socket.on('call:cancelled', onCancelled);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:cancelled', onCancelled);
      stopRing();
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async () => {
    if (!call) return;
    // Stop ringing the moment the user clicks — the ring is what they're
    // trying to silence by hitting Answer, so we kill it FIRST even if
    // anything below throws.
    dismiss();
    try {
      getSocket().emit('call:accept', { callerId: call.callerId, conversationId: call.conversationId });
    } catch { /* non-fatal */ }
    const callerId = call.caller?.id || call.callerId;
    const callerName = call.caller?.name || 'Caller';

    // Drive the join ourselves instead of dispatching an event the DM view
    // has 400ms to catch (which races route transitions on slow devices).
    // We create the VoiceSession row + flip on the shell-level voice deck
    // RIGHT NOW so the WebRTC peer connection starts immediately; the DM
    // view derives its in-call UI from the shell session, so when it
    // mounts everything's already wired.
    try {
      if (call.kind === 'group' && call.groupId) {
        startVoiceSession?.({
          server:  { id: 'group', name: call.groupName || 'Group Call', channels: [], members: [] },
          channel: { id: call.groupId, name: call.groupName || 'Group Call', type: 'voice' },
          currentUser,
        });
        entities.VoiceSession.create({
          server_id: 'group',
          channel_id: call.groupId,
          user_id: currentUser?.id,
          user_name: currentUser?.full_name || currentUser?.username,
          user_avatar: currentUser?.avatar_url || '',
          is_muted: false,
          is_video_on: false,
          is_speaking: false,
        }).catch(() => { /* non-fatal: the join still works */ });
      } else if (call.conversationId) {
        // The ring carries `kind`, but the media join ignored it and always
        // came up audio-only — so answering a video call connected with no
        // camera and the caller stared at a black tile. Answer a video ring
        // with video, the way the caller asked for it.
        const answerWithVideo = call.kind === 'video';
        startVoiceSession?.({
          server:  { id: 'dm', name: `DM — ${callerName}`, channels: [], members: [] },
          channel: { id: call.conversationId, name: callerName, type: 'voice' },
          currentUser,
          startWithVideo: answerWithVideo,
        });
        entities.VoiceSession.create({
          server_id: 'dm',
          channel_id: call.conversationId,
          user_id: currentUser?.id,
          user_name: currentUser?.full_name || currentUser?.username,
          user_avatar: currentUser?.avatar_url || '',
          is_muted: false,
          is_video_on: answerWithVideo,
          is_speaking: false,
        }).catch(() => { /* non-fatal */ });
      }
      playSound('join');
    } catch { /* non-fatal */ }

    // Navigate to the conversation so the user has the chat open while in
    // the call. The call itself is already live regardless of when (or if)
    // this navigation completes.
    if (call.kind === 'group' && call.groupId) {
      navigate(`/friends/groups/${call.groupId}`);
    } else if (navigateToDM) {
      navigateToDM(callerId, call.conversationId);
    } else {
      navigate('/friends/dms');
    }

    // Keep the legacy event for any other listeners that still depend on
    // it (no-op for the DM/group page, since they derive in-call state
    // from the shell now).
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('spidr-answer-call', {
        detail: { conversationId: call.conversationId, callerId, callerName },
      }));
    }, 100);
  };

  const deny = () => {
    if (!call) return;
    try {
      getSocket().emit('call:decline', { callerId: call.callerId, conversationId: call.conversationId });
    } catch { /* non-fatal */ }
    dismiss();
  };

  if (!call) return null;

  const callerName = call.caller?.name || 'Someone';
  const callerAvatar = call.caller?.avatar || '';

  return createPortal((
    <AnimatePresence>
      <motion.div
        key="incoming-call"
        initial={{ y: -180, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -180, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="fixed top-0 left-1/2 -translate-x-1/2 z-[300] flex flex-col items-center"
      >
        {/* Silk thread the caller descends on */}
        <motion.div
          className="w-px bg-gradient-to-b from-transparent via-red-500/60 to-red-500"
          initial={{ height: 0 }}
          animate={{ height: 28 }}
          transition={{ delay: 0.05 }}
        />

        <div className="relative w-[330px] max-w-[92vw] rounded-b-2xl bg-[#0b0b0d]/95 backdrop-blur-xl border-x border-b border-red-900/50 shadow-[0_10px_40px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Web texture accent */}
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #FF3333 0%, transparent 60%)' }} />

          <div className="relative p-4">
            <p className="text-center text-[10px] uppercase tracking-[0.25em] text-red-400 font-mono mb-3">
              /// Incoming Signal
            </p>

            <div className="flex flex-col items-center gap-2">
              {/* Avatar with pulsing web ring */}
              <div className="relative w-16 h-16">
                <span className="absolute inset-[-6px] rounded-full border border-red-500/40 animate-ping" />
                <span className="absolute inset-[-3px] rounded-full"
                  style={{ background: 'conic-gradient(from 0deg,#ef4444,#7f1d1d,#ef4444)', animation: 'spidr-ring-spin 3s linear infinite', filter: 'blur(1px)', opacity: 0.8 }} />
                <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-black bg-zinc-800 flex items-center justify-center">
                  {callerAvatar
                    ? <img src={callerAvatar} alt={callerName} className="w-full h-full object-cover" />
                    : <SpiderLogo size={28} />}
                </div>
              </div>

              <div className="text-center">
                <p className="text-white font-bold text-base leading-tight">{callerName}</p>
                <p className="text-zinc-500 text-xs">is calling you on the web…</p>
              </div>
            </div>

            {/* Answer / Deny */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={deny}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-600/40 text-red-300 font-bold transition-colors"
              >
                <PhoneOff className="w-4 h-4" /> Deny
              </button>
              <button
                onClick={answer}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors shadow-[0_0_18px_rgba(34,197,94,0.4)]"
              >
                <Phone className="w-4 h-4" /> Answer
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  ), document.body);
}
