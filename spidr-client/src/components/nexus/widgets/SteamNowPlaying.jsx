import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Search, Settings, Loader2, Trophy, Clock, ChevronRight } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function authFetch(path) {
  const token = localStorage.getItem('spidr_token');
  return fetch(BASE_URL + path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function cfgKey(userId) {
  return `steam_cfg_${userId}`;
}

function loadCfg(userId) {
  try { return JSON.parse(localStorage.getItem(cfgKey(userId)) || 'null'); } catch { return null; }
}

function saveCfg(userId, cfg) {
  localStorage.setItem(cfgKey(userId), JSON.stringify(cfg));
}

// Steam icon SVG
function SteamIcon({ size = 14, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
    </svg>
  );
}

// ── Setup step 1: Steam ID entry ──────────────────────────────────────────────
function SetupSteamId({ onSubmit, loading, error }) {
  const [steamid, setSteamid] = useState('');

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <SteamIcon size={16} className="text-[#c7d5e0]" />
        <span className="text-[11px] font-black text-[#c7d5e0] uppercase tracking-widest">Steam Now Playing</span>
      </div>
      <p className="text-[10px] text-gray-500 leading-relaxed">
        Enter your 64-bit Steam ID to load your library.
        Find it at{' '}
        <a href="https://steamid.io" target="_blank" rel="noreferrer" className="text-[#66c0f4] hover:underline">steamid.io</a>.
        Your Steam profile must be set to <span className="text-white/60">Public</span>.
      </p>
      <div className="flex gap-2">
        <input
          value={steamid}
          onChange={e => setSteamid(e.target.value.trim())}
          onKeyDown={e => e.key === 'Enter' && steamid && onSubmit(steamid)}
          placeholder="76561198xxxxxxxxx"
          className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-[#66c0f4]/50 placeholder:text-gray-700"
        />
        <button
          disabled={!steamid || loading}
          onClick={() => steamid && onSubmit(steamid)}
          className="px-3 py-2 bg-[#1b2838] border border-[#66c0f4]/30 hover:border-[#66c0f4]/60 text-[#66c0f4] text-[10px] font-bold rounded-lg disabled:opacity-40 transition-colors"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={14} />}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

// ── Setup step 2: pick a game ─────────────────────────────────────────────────
function SetupGamePicker({ games, onPick, onBack }) {
  const [search, setSearch] = useState('');

  const filtered = games.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-[#c7d5e0] uppercase tracking-widest">Pick a Game</span>
        <button onClick={onBack} className="text-[9px] text-gray-600 hover:text-gray-400 font-mono uppercase tracking-wider">← back</button>
      </div>
      <div className="relative">
        <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search your library..."
          className="w-full bg-black/60 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-[11px] text-white outline-none focus:border-[#66c0f4]/50 placeholder:text-gray-700"
        />
      </div>
      <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
        {filtered.slice(0, 60).map(g => (
          <button
            key={g.appid}
            onClick={() => onPick(g)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-black/30 hover:bg-[#1b2838] border border-white/5 hover:border-[#66c0f4]/30 transition-colors text-left"
          >
            <img
              src={`https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`}
              alt=""
              className="w-7 h-7 rounded object-cover shrink-0 bg-white/5"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-white truncate">{g.name}</div>
              <div className="text-[9px] text-gray-500 font-mono">{g.playtime_hours} hrs</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-[10px] text-gray-600 text-center py-4">No games found.</p>
        )}
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function SteamNowPlaying({ userId, isOwnProfile }) {
  const [cfg, setCfg]           = useState(() => loadCfg(userId));
  const [step, setStep]         = useState('display'); // 'display' | 'setup_id' | 'setup_game'
  const [steamid, setSteamid]   = useState('');
  const [gamesCache, setGamesCache] = useState([]);
  const [setupError, setSetupError] = useState('');
  const [loadingGames, setLoadingGames] = useState(false);

  // Fetch game stats when config is set
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['steam-stats', cfg?.steamid, cfg?.appid],
    queryFn: async () => {
      const r = await authFetch(`/steam/stats?steamid=${cfg.steamid}&appid=${cfg.appid}`);
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to load stats');
      return r.json();
    },
    enabled: !!cfg?.steamid && !!cfg?.appid,
    staleTime: 300000,
    refetchInterval: 600000,
    retry: 1,
  });

  const handleSteamIdSubmit = async (id) => {
    setSetupError('');
    setLoadingGames(true);
    try {
      const r = await authFetch(`/steam/games?steamid=${id}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Failed to load library');
      if (!body.games?.length) throw new Error('No games found — check your Steam ID and make sure your profile is Public.');
      setGamesCache(body.games);
      setSteamid(id);
      setStep('setup_game');
    } catch (err) {
      setSetupError(err.message);
    } finally {
      setLoadingGames(false);
    }
  };

  const handleGamePick = (game) => {
    const newCfg = { steamid, appid: String(game.appid), game_name: game.name, playtime_hours: game.playtime_hours, recent_hours: game.recent_hours };
    saveCfg(userId, newCfg);
    setCfg(newCfg);
    setStep('display');
  };

  // No config yet — show setup
  if (!cfg && step === 'display') {
    if (!isOwnProfile) {
      return (
        <div className="bg-[#0d1117] border border-white/10 rounded-xl p-5 flex flex-col items-center justify-center gap-2 min-h-[100px]">
          <SteamIcon size={20} className="text-white/20" />
          <p className="text-[9px] text-gray-600 uppercase tracking-widest">Not configured</p>
        </div>
      );
    }
    return (
      <div className="bg-[#0d1117] border border-[#1b2838] rounded-xl overflow-hidden">
        <SetupSteamId onSubmit={handleSteamIdSubmit} loading={loadingGames} error={setupError} />
      </div>
    );
  }

  if (step === 'setup_id') {
    return (
      <div className="bg-[#0d1117] border border-[#1b2838] rounded-xl overflow-hidden">
        <SetupSteamId onSubmit={handleSteamIdSubmit} loading={loadingGames} error={setupError} />
      </div>
    );
  }

  if (step === 'setup_game') {
    return (
      <div className="bg-[#0d1117] border border-[#1b2838] rounded-xl overflow-hidden">
        <SetupGamePicker games={gamesCache} onPick={handleGamePick} onBack={() => setStep('setup_id')} />
      </div>
    );
  }

  // ── Display mode ─────────────────────────────────────────────────────────────
  const headerImg = cfg?.appid
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${cfg.appid}/header.jpg`
    : null;

  const displayName  = stats?.game_name  || cfg?.game_name  || 'Unknown Game';
  const earned       = stats?.achievements_earned ?? null;
  const total        = stats?.achievements_total  ?? null;
  const pct          = total ? Math.round((earned / total) * 100) : null;

  return (
    <div className="bg-[#0d1117] border border-[#1b2838] rounded-xl overflow-hidden relative"
         style={{ boxShadow: '0 0 20px rgba(102,192,244,0.06)' }}>

      {/* Header image banner */}
      {headerImg && (
        <div className="relative h-24 overflow-hidden">
          <img src={headerImg} alt={displayName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d1117]" />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <SteamIcon size={11} className="text-[#66c0f4] shrink-0" />
              <span className="text-[9px] font-black text-[#66c0f4] uppercase tracking-widest">Steam</span>
            </div>
            <h3 className="text-sm font-black text-white leading-tight truncate">{displayName}</h3>
          </div>
          {isOwnProfile && (
            <button
              onClick={() => setStep('setup_id')}
              className="text-gray-700 hover:text-[#66c0f4] transition-colors shrink-0 mt-0.5"
              title="Change game"
            >
              <Settings size={12} />
            </button>
          )}
        </div>

        {statsLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-600">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading stats…
          </div>
        ) : (
          <>
            {/* Stat pills */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/40 border border-white/5 rounded-lg p-2.5 flex items-center gap-2">
                <Clock size={12} className="text-[#66c0f4] shrink-0" />
                <div>
                  <div className="text-sm font-black text-white">{cfg?.playtime_hours ?? '—'}</div>
                  <div className="text-[8px] text-gray-500 uppercase font-bold">Total Hours</div>
                </div>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-lg p-2.5 flex items-center gap-2">
                <Clock size={12} className="text-green-400 shrink-0" />
                <div>
                  <div className="text-sm font-black text-white">
                    {cfg?.recent_hours != null ? cfg.recent_hours : '—'}
                  </div>
                  <div className="text-[8px] text-gray-500 uppercase font-bold">Past 2 Weeks</div>
                </div>
              </div>
            </div>

            {/* Achievement bar */}
            {total != null && total > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy size={10} className="text-amber-400" />
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Achievements</span>
                  </div>
                  <span className="text-[9px] font-mono text-gray-500">{earned} / {total}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #66c0f4, #4a9fb5)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-[8px] text-gray-600 font-mono mt-0.5 text-right">{pct}% complete</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
