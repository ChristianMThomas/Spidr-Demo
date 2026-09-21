import React, { useState } from 'react';
import { Phone, PhoneOff, MonitorSmartphone, Loader2 } from 'lucide-react';
import { useAppShell } from '@/context/AppShellContext';
import { toast } from 'sonner';

export default function AccountCallStatus() {
  const { accountCalls, currentUser, transferCall, endVoiceSession } = useAppShell();
  const [busy, setBusy] = useState(false);
  const call = accountCalls.find(c => c.canTransfer) || accountCalls.find(c => c.isOwner && c.status === 'ringing');
  if (!call) return null;
  const peer = call.participants.find(p => p.id !== currentUser?.id);
  return <div role="status" className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[210] w-[min(420px,calc(100vw-24px))] border border-white/15 bg-[#101012] rounded-lg p-4 shadow-xl">
    <div className="flex items-center gap-3 min-w-0">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-400">
        {!call.canTransfer && <span className="absolute inset-0 rounded-full border border-green-400/50 motion-safe:animate-ping" />}
        {call.canTransfer ? <MonitorSmartphone size={20} /> : <Phone size={20} />}
      </span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{call.groupName || peer?.name || 'Call'}</p><p className="text-xs text-white/60">{call.canTransfer ? 'Call active on another device' : 'Ringing...'}</p></div>
      {!call.canTransfer && <button title="Cancel call" aria-label="Cancel call" onClick={() => endVoiceSession()} className="p-3 rounded-full bg-red-500/15 text-red-300"><PhoneOff size={18} /></button>}
    </div>
    {call.canTransfer && <button disabled={busy} className="mt-3 flex w-full justify-center items-center gap-2 rounded-lg bg-green-600 py-2 text-sm text-white disabled:opacity-50" onClick={async () => {
      setBusy(true);
      try { await transferCall(call.callId); } catch (error) { toast.error(error.message); } finally { setBusy(false); }
    }}>{busy && <Loader2 size={16} className="animate-spin" />}{busy ? 'Connecting...' : 'Switch to this device'}</button>}
  </div>;
}
