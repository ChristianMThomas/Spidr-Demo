import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music, Gamepad2, Twitch, Check, X } from 'lucide-react';
import { entities } from '@/api/apiClient';
import { toast } from 'sonner';

export default function NeuralConfig({ currentUser }) {
  const [connections, setConnections] = useState({
    spotify: false,
    steam: false,
    twitch: false,
  });

  useEffect(() => {
    if (currentUser?.neural_links) {
      setConnections(currentUser.neural_links);
    }
  }, [currentUser]);

  const toggleConnection = async (key) => {
    const newValue = !connections[key];
    const updatedConnections = { ...connections, [key]: newValue };
    setConnections(updatedConnections);

    try {
      // Persist to user profile
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      if (profiles?.[0]) {
        await entities.UserProfile.update(profiles[0].id, { neural_links: updatedConnections });
      } else {
        await entities.UserProfile.create({ user_id: currentUser?.id, neural_links: updatedConnections });
      }
      toast.success(newValue ? 'Neural link established' : 'Link severed');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update neural link');
      setConnections(connections); // Revert on error
    }
  };

  return (
    <div className="flex-1 bg-[#050505] p-8 overflow-y-auto">
      <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-widest flex items-center gap-3">
        <span className="text-[#FF3333]">///</span> Neural Links
      </h1>
      <p className="text-gray-500 mb-8 text-sm">Jack external data streams into your Spidr profile.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <ConnectionCard
          id="spotify"
          label="Spotify Audio Stream"
          icon={Music}
          connected={connections.spotify}
          onToggle={() => toggleConnection('spotify')}
          color="#1DB954"
        />
        <ConnectionCard
          id="steam"
          label="Steam Game Protocol"
          icon={Gamepad2}
          connected={connections.steam}
          onToggle={() => toggleConnection('steam')}
          color="#171A21"
        />
        <ConnectionCard
          id="twitch"
          label="Twitch Live Feed"
          icon={Twitch}
          connected={connections.twitch}
          onToggle={() => toggleConnection('twitch')}
          color="#9146FF"
        />
      </div>
    </div>
  );
}

function ConnectionCard({ label, icon: Icon, connected, onToggle, color }) {
  return (
    <div className="relative group overflow-hidden bg-[#111] border border-white/5 rounded-xl p-6 transition-all hover:border-white/20">
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500"
        style={{ backgroundColor: color }}
      />
      <div className="flex justify-between items-center z-10 relative">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              backgroundColor: connected ? color : '#222',
              color: connected ? 'white' : '#666',
              boxShadow: connected ? `0 0 20px ${color}40` : 'none'
            }}
          >
            <Icon size={24} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{label}</h3>
            <span className={`text-[10px] font-mono uppercase ${connected ? 'text-green-500' : 'text-gray-600'}`}>
              {connected ? 'LINK ESTABLISHED' : 'NO SIGNAL'}
            </span>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-14 h-8 rounded-full transition-all duration-300 border ${
            connected ? 'bg-[#050505] border-white/20' : 'bg-[#050505] border-white/5'
          }`}
        >
          <motion.div
            className="absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
            animate={{ x: connected ? 24 : 0 }}
            style={{ backgroundColor: connected ? color : '#333' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {connected ? <Check size={12} strokeWidth={4} /> : <X size={12} strokeWidth={4} />}
          </motion.div>
        </button>
      </div>
      {connected && (
        <motion.div
          layoutId={`cable-${label}`}
          className="absolute bottom-0 left-0 h-[2px] w-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </div>
  );
}
