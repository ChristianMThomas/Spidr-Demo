import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Clock, Eye, AlertTriangle } from 'lucide-react';

function CyberToggle({ label, desc, active, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0">
      <div>
        <div className="text-sm font-bold text-white">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
      </div>
      <button
        onClick={onToggle}
        className={`relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 ${active ? 'bg-[#FF3333]' : 'bg-zinc-700'}`}
      >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${active ? 'translate-x-7' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function CyberSection({ title, icon: Icon, children }) {
  return (
    <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={14} className="text-[#FF3333]" />}
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function SanctuaryProtocols({ server, settings, onChange }) {
  const isMature = settings?.is_mature || false;
  const minTenure = settings?.min_tenure !== false;
  const requirePhone = settings?.require_phone || false;
  const obfuscateMedia = settings?.obfuscate_media !== false;

  const update = (key, val) => onChange({ ...settings, [key]: val });

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="border-b border-white/10 pb-5">
        <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#FF3333]" />
          Sanctuary Protocols
        </h2>
        <p className="text-gray-500 text-xs mt-1">
          Security via reputation — not surveillance.{' '}
          <span className="text-white">No IDs. No scans.</span>
        </p>
      </div>

      {/* Main mature toggle */}
      <div className={`p-5 rounded-2xl border transition-all duration-500 ${isMature ? 'bg-red-900/10 border-[#FF3333]/60' : 'bg-zinc-900/60 border-white/5'}`}>
        <div className="flex justify-between items-start gap-4">
          <div>
            <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase mb-2 ${isMature ? 'bg-[#FF3333] text-white' : 'bg-zinc-700 text-gray-400'}`}>
              {isMature ? 'RESTRICTED 18+' : 'Standard Access'}
            </div>
            <h3 className="text-base font-bold text-white mb-1">Age-Gated Sanctuary</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Designates this server as a mature environment.
              Users must sign the <strong className="text-white">Crimson Pact</strong> to enter.
            </p>
          </div>
          <CyberToggle
            label="ENABLE GATE"
            desc="Strict 18+ Entry"
            active={isMature}
            onToggle={() => update('is_mature', !isMature)}
          />
        </div>

        {isMature && (
          <div className="mt-3 flex items-start gap-2 bg-yellow-900/20 border border-yellow-600/30 rounded-xl px-3 py-2.5">
            <AlertTriangle size={14} className="text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-300">
              Users will be shown the Crimson Pact before accessing any content. Falsification results in a permanent ban.
            </p>
          </div>
        )}
      </div>

      {/* Options — only when mature is on */}
      <AnimatePresence>
        {isMature && (
          <motion.div
            key="mature-options"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4 overflow-hidden"
          >
            <CyberSection title="Reputation Filters" icon={Clock}>
              <CyberToggle
                label="Minimum Tenure Protocol"
                desc="Only allow users with accounts older than 30 days."
                active={minTenure}
                onToggle={() => update('min_tenure', !minTenure)}
              />
              <CyberToggle
                label="Verified Comms Link"
                desc="Require a verified phone number (hash only, no data shared)."
                active={requirePhone}
                onToggle={() => update('require_phone', !requirePhone)}
              />
            </CyberSection>

            <CyberSection title="Visual Safety" icon={Eye}>
              <CyberToggle
                label="Obfuscate Media"
                desc="All images and videos are blurred until clicked."
                active={obfuscateMedia}
                onToggle={() => update('obfuscate_media', !obfuscateMedia)}
              />
            </CyberSection>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}