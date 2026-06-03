import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Gamepad2, Sparkles } from 'lucide-react';
import { entities } from '@/api/apiClient';
import { curatedAccent, extractDominantColor, withAlpha, DEFAULT_ACCENT } from '@/lib/gameAccent';

// ─────────────────────────────────────────────────────────────────────────────
// Hosted icon URL overrides, keyed by the canonical game name we resolve in
// electron/main.js (KNOWN_GAMES_WIN / KNOWN_GAMES_MAC). The pipeline is:
//
//   1. GAME_ARTWORK[gameName]   — manual hosted URL (any source, see below)
//   2. exeIcon                  — the .exe's embedded Windows icon, extracted
//                                 via Electron's app.getFileIcon(). Works for
//                                 ANY launcher (Epic, Riot, Battle.net, EA App,
//                                 Microsoft Store, GOG, standalone, …) because
//                                 every Windows game eventually launches an
//                                 .exe with an icon resource.
//   3. <Gamepad2> placeholder   — last resort.
//
// So: detection is launcher-agnostic, and most non-Steam games (LoL, Valorant,
// Diablo IV, WoW, etc.) already pick up the correct brand icon from their
// .exe at step 2 with no override needed.
//
// You only need an entry below in two cases:
//   a) The .exe ships a *generic* engine icon (Unreal Engine games like
//      Fortnite are the classic example — UE's default white-cube icon
//      survives into the shipped exe). Provide a hosted URL.
//   b) You want a richer / wider banner instead of the small 32×32 .exe icon
//      for known-good titles (e.g. all the Steam header.jpg entries below).
//
// URL sources:
//   • Steam CDN:    https://cdn.cloudflare.steamstatic.com/steam/apps/{appId}/header.jpg
//                   (works even if the user owns the game on Epic/Battle.net,
//                    as long as the title is also listed on Steam — we key by
//                    game name, not by store.)
//   • Wikimedia:    https://upload.wikimedia.org/wikipedia/commons/...  (stable,
//                   CORS-friendly, good for non-Steam logos.)
//   • Official press kits and store CDNs work for display but may not be
//     CORS-friendly — that's fine for curated-color games where we don't need
//     to read pixels.
// ─────────────────────────────────────────────────────────────────────────────
const GAME_ARTWORK = {
  // ── Riot Games (not on Steam — Wikipedia infobox URLs, Chromium-accessible) ─
  'League of Legends': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/League_of_Legends_2019_vector.svg/250px-League_of_Legends_2019_vector.svg.png',
  'Teamfight Tactics': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Teamfight_Tactics_logo.svg/250px-Teamfight_Tactics_logo.svg.png',
  'VALORANT':          'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Valorant_logo.svg/300px-Valorant_logo.svg.png',

  // ── Non-Steam with unreliable exe icon (generic UE launcher) ─────────────
  'Fortnite': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Fortnite_F_lettermark_logo.svg/200px-Fortnite_F_lettermark_logo.svg.png',

  // All Steam games intentionally omitted — exe icon extracted via
  // app.getFileIcon(exePath) gives the actual branded game icon.
};

/**
 * GamingUplink — partner-designed redesign.
 *
 * One card with a fixed black background and a thin accent-colored border
 * (plus a soft glow of the same hue). The accent is chosen per-game:
 *   • Brand-iconic titles (Valorant, Fortnite, COD, R.E.P.O., LoL, …) use
 *     a curated hex from lib/gameAccent.
 *   • Everything else (unknown Electron-detected games, niche titles) has
 *     its dominant color extracted from the game's icon image at runtime.
 * Result: the card always reads "black + the one color the game is known
 * for" without us needing a hand-tuned theme per game.
 */
export default function GamingUplink({ userId, isOwnProfile }) {
  const queryClient = useQueryClient();
  const profileIdRef = useRef(null);
  const [exeIcon, setExeIcon] = useState(null);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({ email: '', issue: '', launcher: '', description: '' });
  const [reportStatus, setReportStatus] = useState(null);

  const { data: profile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const results = await entities.UserProfile.filter({ user_id: userId });
      return results?.[0] ?? null;
    },
    enabled: !!userId,
  });

  useEffect(() => { profileIdRef.current = profile?.id ?? null; }, [profile?.id]);

  const applyStatus = async (status) => {
    if (!profileIdRef.current) return;
    await entities.UserProfile.update(profileIdRef.current, { gaming_status: status });
    queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
  };

  // Electron game detection — own profile only
  useEffect(() => {
    if (!isOwnProfile || !window.electronAPI?.onGamingStatus) return;
    window.electronAPI.requestGamingStatus().then((status) => { if (status) applyStatus(status); });
    const cleanup = window.electronAPI.onGamingStatus((status) => applyStatus(status));
    return cleanup;
  }, [isOwnProfile, userId]);

  const gs = profile?.gaming_status;

  // Always fetch the exe icon as a fallback — even when GAME_ARTWORK has a URL,
  // the hosted image may fail to load (broken link, CORS, hotlink block).
  useEffect(() => {
    setExeIcon(null);
    setArtworkFailed(false);
    if (!gs?.exePath || !window.electronAPI?.getGameIcon) return;
    window.electronAPI.getGameIcon(gs.exePath).then((icon) => {
      if (icon) setExeIcon(icon);
    });
  }, [gs?.exePath, gs?.game]);

  // Priority: hosted artwork → exe icon → null (shows Gamepad2 placeholder).
  // artworkFailed flips to true via onError so broken hosted URLs fall through.
  const iconUrl = (!artworkFailed && GAME_ARTWORK[gs?.game]) || exeIcon || null;

  // Resolve the accent color: curated first, runtime extraction second,
  // white fallback last. Curated returns synchronously so the card never
  // flashes the wrong color for branded games on first paint.
  useEffect(() => {
    let cancelled = false;
    const curated = curatedAccent(gs?.game);
    if (curated) { setAccent(curated); return; }
    if (!iconUrl)  { setAccent(DEFAULT_ACCENT); return; }
    extractDominantColor(iconUrl).then((color) => {
      if (cancelled) return;
      setAccent(color || DEFAULT_ACCENT);
    });
    return () => { cancelled = true; };
  }, [gs?.game, iconUrl]);

  // Live session timer — counts up from sessionStart (absolute Unix ms)
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!gs?.sessionStart) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - gs.sessionStart) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gs?.sessionStart]);

  const elapsedMM = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const elapsedSS = String(elapsed % 60).padStart(2, '0');

  const closeReport = () => { setShowReport(false); setReportStatus(null); setReportForm({ email: '', issue: '', launcher: '', description: '' }); };

  const submitReport = async (e) => {
    e.preventDefault();
    setReportStatus('sending');
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${base}/support/game-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportForm),
      });
      if (!res.ok) throw new Error();
      setReportStatus('sent');
    } catch {
      setReportStatus('error');
    }
  };

  const reportLink = (
    <button
      onClick={() => setShowReport(true)}
      className="mt-2 text-left text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors leading-relaxed"
    >
      Don't see your game? Icon not working?{' '}
      <span className="underline underline-offset-2">Fill out this form</span>
    </button>
  );

  const reportModal = showReport && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={closeReport}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white font-bold text-base mb-1">Game Detection Report</h2>
        <p className="text-zinc-500 text-xs mb-5">Help us fix detection and icons for your game.</p>

        {reportStatus === 'sent' ? (
          <div className="text-center py-8">
            <p className="text-emerald-400 font-bold text-sm">Report sent!</p>
            <p className="text-zinc-500 text-xs mt-1">We'll look into it. Thanks!</p>
            <button onClick={closeReport} className="mt-4 text-xs text-zinc-400 underline">Close</button>
          </div>
        ) : (
          <form onSubmit={submitReport} className="flex flex-col gap-3">
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Your email <span className="text-red-500">*</span></label>
              <input
                type="email"
                required
                value={reportForm.email}
                onChange={(e) => setReportForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/25"
              />
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Issue <span className="text-red-500">*</span></label>
              <select
                required
                value={reportForm.issue}
                onChange={(e) => setReportForm(f => ({ ...f, issue: e.target.value }))}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/25"
              >
                <option value="">Select an issue</option>
                <option>App not being detected</option>
                <option>Icon not working</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Launcher <span className="text-red-500">*</span></label>
              <select
                required
                value={reportForm.launcher}
                onChange={(e) => setReportForm(f => ({ ...f, launcher: e.target.value }))}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/25"
              >
                <option value="">Select a launcher</option>
                <option>Steam</option>
                <option>Epic Games</option>
                <option>Riot Client</option>
                <option>Rockstar Games Launcher</option>
                <option>Microsoft Store</option>
                <option>EA App</option>
                <option>Battle.net</option>
                <option>Ubisoft Connect</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 text-xs mb-1 block">Description <span className="text-zinc-600">(optional)</span></label>
              <textarea
                value={reportForm.description}
                onChange={(e) => setReportForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Any extra details that might help..."
                rows={3}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/25 resize-none"
              />
            </div>
            {reportStatus === 'error' && (
              <p className="text-red-400 text-xs">Something went wrong. Please try again.</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={closeReport}
                className="flex-1 py-2 rounded-lg border border-white/10 text-zinc-400 text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reportStatus === 'sending'}
                className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {reportStatus === 'sending' ? 'Sending…' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>,
    document.body
  );

  // ── Empty state ────────────────────────────────────────────────────────
  if (!gs?.game) {
    return (
      <section>
        <h3 className="text-sm font-bold text-white mb-2">Active Session</h3>
        <div className="bg-black border border-white/10 rounded-xl min-h-[110px] flex flex-col items-center justify-center gap-2 p-5">
          <Gamepad2 size={24} className="text-gray-700" />
          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-widest text-center">No session detected</div>
          {isOwnProfile && (
            <div className="text-[9px] text-gray-700 text-center leading-relaxed">
              {window.electronAPI ? 'Open a game — Spidr will detect it automatically' : 'Desktop app required for auto-detection'}
            </div>
          )}
        </div>
        {reportLink}
        {reportModal}
      </section>
    );
  }

  // ── Header label varies with status ────────────────────────────────────
  const sectionLabel = gs.inSession ? 'Active Session' : (gs.active ? 'In Lobby' : 'Last Played');

  // ── The accent-tinted bottom line (the red text from the reference) ────
  const statusLine = (() => {
    if (gs.inSession) {
      const parts = [];
      if (gs.character) parts.push(`PLAYING AS ${gs.character.toUpperCase()}`);
      else              parts.push('PLAYING');
      if (gs.sessionStart != null) parts.push(`${elapsedMM}:${elapsedSS} ELAPSED`);
      return parts.join(' • ');
    }
    if (gs.active) return 'CURRENTLY IN LOBBY';
    return 'NOT IN SESSION';
  })();

  return (
    <section>
      <h3 className="text-sm font-bold text-white mb-2">{sectionLabel}</h3>

      <div
        className="relative rounded-xl bg-black border overflow-hidden flex items-center gap-4 p-4"
        style={{
          borderColor: withAlpha(accent, 0.55),
          boxShadow: `0 0 24px ${withAlpha(accent, 0.18)}, inset 0 0 0 1px ${withAlpha(accent, 0.08)}`,
        }}
      >
        {/* Square icon tile — game artwork cropped square. A faint accent
            ring sits on top so the tile feels visually attached to the card
            border. */}
        <div
          className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-zinc-900"
          style={{ boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.3)}` }}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={gs.game}
              className="w-full h-full object-contain p-1"
              draggable={false}
              onError={() => setArtworkFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <Gamepad2 size={22} />
            </div>
          )}

          {/* Live status dot — bottom-right of the icon. Pulses while in
              session; solid otherwise. */}
          {gs.inSession ? (
            <motion.span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-black"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            />
          ) : (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-500 border-2 border-black" />
          )}
        </div>

        {/* Right stack: title, mode subtitle, accent status line. */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate leading-tight">{gs.game}</p>
          {gs.gameMode && (
            <p className="text-zinc-400 text-xs truncate leading-tight mt-0.5">{gs.gameMode}</p>
          )}
          <p
            className="text-[10px] font-bold uppercase tracking-wider mt-1.5 truncate flex items-center gap-1.5"
            style={{ color: accent }}
          >
            {gs.character && <Sparkles size={10} className="shrink-0" />}
            {statusLine}
          </p>
        </div>
      </div>

      {reportLink}
      {reportModal}
    </section>
  );
}
