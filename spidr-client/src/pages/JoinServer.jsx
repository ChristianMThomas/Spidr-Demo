import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { entities, auth } from '@/api/apiClient';
import { motion } from 'framer-motion';
import { Loader2, Check, AlertCircle, Users } from 'lucide-react';
import SpiderLogo from '@/components/spidr/SpiderLogo';
import { toast } from 'sonner';

/**
 * /join/:code — preview the server, then let the user accept and join.
 *
 * Flow:
 *   1. Look up the invite code → show server preview
 *   2. Confirm "Join Server" → POST /servers/join → navigate to /Home with the server selected
 */
export default function JoinServer() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    entities.Server.lookupByCode(code)
      .then((data) => { if (!cancelled) setServer(data); })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Invalid or expired invite link');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code]);

  const handleJoin = async () => {
    if (!code) return;
    setJoining(true);
    try {
      const me = await auth.me().catch(() => null);
      const result = await entities.Server.joinByCode(code, me);
      if (result.already_member) {
        toast.info(`You're already in ${result.name}`);
      } else {
        toast.success(`Joined ${result.name}!`);
      }
      navigate('/channels/' + result.id);
    } catch (err) {
      toast.error('Could not join: ' + (err?.message || 'unknown error'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-black to-black pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF3333]/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Banner */}
        <div className="h-32 bg-gradient-to-br from-red-700 to-red-950 relative overflow-hidden">
          {server?.banner_url && (
            <img src={server.banner_url} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        </div>

        {/* Body */}
        <div className="p-6 -mt-8 relative">
          {loading && (
            <div className="text-center py-8">
              <Loader2 size={32} className="mx-auto text-[#FF3333] animate-spin mb-3" />
              <p className="text-zinc-500 text-sm">Loading invite…</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <h2 className="text-lg font-black text-white mb-1">Invalid Invite</h2>
              <p className="text-zinc-500 text-sm mb-6">{error}</p>
              <button
                onClick={() => navigate('/home')}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                Back to Spidr
              </button>
            </div>
          )}

          {server && !loading && !error && (
            <>
              {/* Server icon */}
              <div className="w-16 h-16 rounded-2xl border-4 border-[#0a0a0a] bg-zinc-900 overflow-hidden shadow-xl mb-3">
                {server.icon_url ? (
                  <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-950 flex items-center justify-center text-white text-2xl font-black">
                    {server.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="mb-1">
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">You're invited to join</p>
              </div>
              <h1 className="text-2xl font-black text-white mb-2 leading-tight">{server.name}</h1>
              {server.description && (
                <p className="text-sm text-zinc-400 mb-3 leading-relaxed">{server.description}</p>
              )}

              <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-6">
                <Users size={12} />
                <span>{server.member_count || 0} member{server.member_count === 1 ? '' : 's'}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/home')}
                  disabled={joining}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                >
                  Decline
                </button>
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="flex-1 py-2.5 bg-[#FF3333] hover:bg-red-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,51,51,0.3)] disabled:opacity-40"
                >
                  {joining ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {joining ? 'Joining…' : 'Accept Invite'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5 bg-zinc-900/40 flex items-center justify-center gap-2">
          <SpiderLogo size={14} />
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Spidr</span>
        </div>
      </motion.div>
    </div>
  );
}
