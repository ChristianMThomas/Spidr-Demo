import React from 'react';
import { Ban, Clock } from 'lucide-react';
import { entities, auth, integrations } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
function formatDate(date) {
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fromNow(date) {
  const diff = Date.now() - new Date(date).getTime();
  const abs  = Math.abs(diff);
  const future = diff < 0;
  const [val, unit] =
    abs < 60000       ? [Math.floor(abs / 1000), 'second'] :
    abs < 3600000     ? [Math.floor(abs / 60000), 'minute'] :
    abs < 86400000    ? [Math.floor(abs / 3600000), 'hour'] :
    abs < 2592000000  ? [Math.floor(abs / 86400000), 'day'] :
    abs < 31536000000 ? [Math.floor(abs / 2592000000), 'month'] :
                        [Math.floor(abs / 31536000000), 'year'];
  const label = `${val} ${unit}${val !== 1 ? 's' : ''}`;
  return future ? `in ${label}` : `${label} ago`;
}

export default function BanScreen({ profile }) {
  const { logout } = useAuth();
  const isPermanent = !profile.ban_until;
  const banExpiry = profile.ban_until ? new Date(profile.ban_until) : null;
  const isExpired = banExpiry && banExpiry < new Date();

  if (isExpired) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="relative inline-block mb-6">
          <div className="w-24 h-24 rounded-full bg-red-600/10 border-2 border-red-600/30 flex items-center justify-center mx-auto">
            <Ban className="w-12 h-12 text-red-500" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">!</span>
          </div>
        </div>

        <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">Account Suspended</h1>
        <p className="text-gray-500 text-sm mb-6">Your account has been suspended for violating our community guidelines.</p>

        {profile.ban_reason && (
          <div className="bg-[#111] border border-red-500/20 rounded-xl p-4 mb-4 text-left">
            <p className="text-[10px] text-red-400 uppercase font-bold mb-1">Reason</p>
            <p className="text-sm text-gray-300">{profile.ban_reason}</p>
          </div>
        )}

        <div className="bg-[#111] border border-white/5 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Clock size={16} />
            {isPermanent ? (
              <span className="text-sm font-bold text-red-400">Permanent Ban</span>
            ) : (
              <span className="text-sm">
                Expires: <span className="text-white font-bold">{formatDate(banExpiry)}</span>
                <span className="text-gray-600 ml-1">({fromNow(banExpiry)})</span>
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="px-6 py-2.5 bg-[#111] border border-white/10 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:border-white/20 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}