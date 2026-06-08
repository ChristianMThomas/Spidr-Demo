/**
 * Steam Routes
 *
 * GET /steam/games?steamid=X   — top 50 owned games sorted by playtime
 * GET /steam/stats?steamid=X&appid=Y — playtime + achievement progress for one game
 *
 * Requires STEAM_API_KEY env var (get a free key at https://steamcommunity.com/dev/apikey).
 * The user's Steam profile must be set to Public for the API to return data.
 */

const express = require('express');
const authMW  = require('../middleware/auth');

const router = express.Router();

const STEAM_KEY = () => process.env.STEAM_API_KEY;

const STEAMID_RE = /^\d{1,20}$/;
const APPID_RE   = /^\d{1,8}$/;

// GET /steam/games?steamid=X
router.get('/games', authMW, async (req, res) => {
  const { steamid } = req.query;
  if (!steamid) return res.status(400).json({ error: 'steamid required' });
  if (!STEAMID_RE.test(steamid)) return res.status(400).json({ error: 'invalid steamid' });

  const key = STEAM_KEY();
  if (!key) return res.status(503).json({ error: 'Steam API not configured on this server.' });

  try {
    const url =
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
      `?key=${key}&steamid=${steamid}&include_appinfo=true&format=json`;

    const r = await fetch(url);
    const body = await r.json();

    const games = (body?.response?.games || [])
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 100)
      .map(g => ({
        appid:           g.appid,
        name:            g.name,
        playtime_hours:  Math.round(g.playtime_forever / 6) / 10,
        recent_hours:    g.playtime_2weeks != null ? Math.round(g.playtime_2weeks / 6) / 10 : null,
        img_icon_url:    g.img_icon_url,
      }));

    res.json({ games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /steam/stats?steamid=X&appid=Y
router.get('/stats', authMW, async (req, res) => {
  const { steamid, appid } = req.query;
  if (!steamid || !appid) return res.status(400).json({ error: 'steamid and appid required' });
  if (!STEAMID_RE.test(steamid)) return res.status(400).json({ error: 'invalid steamid' });
  if (!APPID_RE.test(appid))     return res.status(400).json({ error: 'invalid appid' });

  const key = STEAM_KEY();
  if (!key) return res.status(503).json({ error: 'Steam API not configured on this server.' });

  try {
    const [statsRes, appRes] = await Promise.all([
      fetch(
        `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/` +
        `?key=${key}&steamid=${steamid}&appid=${appid}&format=json`
      ).then(r => r.json()),
      fetch(
        `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic,achievements`
      ).then(r => r.json()),
    ]);

    const appData     = appRes?.[appid]?.data;
    const achievements = statsRes?.playerstats?.achievements || [];

    res.json({
      game_name:            appData?.name || statsRes?.playerstats?.gameName || null,
      header_image:         appData?.header_image || null,
      achievements_earned:  achievements.filter(a => a.achieved === 1).length,
      achievements_total:   achievements.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
