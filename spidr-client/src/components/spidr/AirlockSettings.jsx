import React from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

export default function AirlockSettings({ server, airlock, onChange, channels }) {
  const textChannels = (channels || []).filter(c => c.type === 'text');
  const enabled = airlock?.enabled || false;
  const quarantineChannel = airlock?.quarantine_channel || '';

  const toggle = () => {
    onChange({ ...airlock, enabled: !enabled });
  };

  const setChannel = (channelId) => {
    onChange({ ...airlock, enabled: true, quarantine_channel: channelId });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-white/5 pb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" /> Airlock Protocol
        </h3>
        <p className="text-xs text-zinc-500 mt-1">
          When enabled, new members are quarantined and can only see the designated channel until a mod/admin verifies them.
        </p>
      </div>

      {/* Main Toggle */}
      <div className="flex items-center justify-between p-4 bg-zinc-800 border border-red-900/20 rounded-xl">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${enabled ? 'bg-red-500/20 text-red-500' : 'bg-zinc-700 text-zinc-500'}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Enforce Airlock</p>
            <p className="text-[10px] text-zinc-400">Require manual verification for new joins</p>
          </div>
        </div>
        <button
          onClick={toggle}
          className={`w-11 h-6 rounded-full p-0.5 transition-colors ${enabled ? 'bg-red-600' : 'bg-zinc-700'}`}
        >
          <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Channel Selector */}
      {enabled && (
        <div className="space-y-4 animate-in fade-in">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Quarantine Channel</label>
            <select
              value={quarantineChannel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-white outline-none focus:border-red-500"
            >
              <option value="">Select a channel...</option>
              {textChannels.map(ch => (
                <option key={ch.id} value={ch.id}>#{ch.name}</option>
              ))}
            </select>
            <p className="text-[9px] text-zinc-500">Unverified users will only see this channel until granted access.</p>
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Mods/admins can verify users from the Members tab or by clicking "Grant Access" on unverified members in the quarantine channel.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}