import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  Blocks, FileText, Globe, Radio, Clock, Music, Cpu, MemoryStick, HardDrive, Monitor,
  Gamepad2, Trophy, Search, ChevronRight, Skull, Edit2, Check, X, Flame,
} from 'lucide-react-native';
import { integrations, entities } from '../../lib/apiClient';
import { BASE_URL } from '../../lib/config';
import useNowPlaying from '../../hooks/useNowPlaying';

// ── Mobile module-widget renderer ────────────────────────────────────────────
// Ports every builtin the web has (nexus/widgets/builtinWidgets.js) so mobile
// profiles show REAL data instead of falling through to the LLM ApiSyncWidget:
//   • Spotify Now Playing  → socket-fed presence
//   • Steam Now Playing    → /steam/games + /steam/stats
//   • Weather Hex          → Open-Meteo current conditions (owner's coords)
//   • PC Specs Flex        → UserProfile.pc_specs
//   • Symbiote Entity Pet  → UserProfile.neural_links.symbiote (mood + feed/poke)
//   • Gaming Uplink Card   → UserProfile.gaming_status (desktop-synced)
// User-created modules with type static_text / display_widget still render
// their real payload. Only unassigned api_sync / live_feed modules get the LLM.

const SPIDR_OFFICIAL = 'spidr-official';

function parsePayload(payloadStr: any): any {
  if (!payloadStr) return {};
  if (typeof payloadStr === 'object') return payloadStr;
  try { return JSON.parse(payloadStr); } catch { return { raw: payloadStr }; }
}

function openSafe(raw: string) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return;
  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      Alert.alert('Blocked link', 'Only http and https links can be opened.');
      return;
    }
    Linking.openURL(u.toString()).catch(() => Alert.alert('Could not open link'));
  } catch {
    Alert.alert('Invalid link', 'That URL could not be parsed.');
  }
}

// Small server helper — GET/JSON with the stored auth token.
async function authFetch(path: string) {
  const token = await AsyncStorage.getItem('spidr_token');
  const r = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as any)?.error || `HTTP ${r.status}`);
  return body;
}

function WidgetShell({
  mod, icon, accent, children,
}: {
  mod: any; icon: React.ReactNode; accent: string; children: React.ReactNode;
}) {
  return (
    <View style={{
      backgroundColor: 'rgba(10,10,10,0.9)', borderRadius: 14,
      borderWidth: 1, borderColor: accent + '33', padding: 16, overflow: 'hidden',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {mod.icon_url ? (
          <Image source={{ uri: mod.icon_url }} style={{ width: 22, height: 22, borderRadius: 5 }} contentFit="cover" />
        ) : (
          icon
        )}
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', flex: 1 }} numberOfLines={1}>
          {mod.name || 'Module'}
        </Text>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
      </View>
      {children}
    </View>
  );
}

// ── Static text ──────────────────────────────────────────────────────────────
function StaticTextWidget({ mod }: { mod: any }) {
  const data = parsePayload(mod.payload);
  const content = data.content || data.text || data.raw || mod.description || 'No content configured.';
  return (
    <WidgetShell mod={mod} accent="#4ade80" icon={<FileText size={16} color="#4ade80" />}>
      <Text style={{ color: '#d4d4d8', fontSize: 12, lineHeight: 18, marginTop: 8 }}>{content}</Text>
      {data.link ? (
        <TouchableOpacity onPress={() => openSafe(data.link)}>
          <Text style={{ color: '#60a5fa', fontSize: 10, fontFamily: 'monospace', marginTop: 8, textDecorationLine: 'underline' }}>
            {data.link_label || data.link}
          </Text>
        </TouchableOpacity>
      ) : null}
    </WidgetShell>
  );
}

// ── Display widget ───────────────────────────────────────────────────────────
function DisplayWidget({ mod }: { mod: any }) {
  const data = parsePayload(mod.payload);
  const imageUrl = data.image_url || data.background || data.banner || mod.icon_url;
  const subtitle = data.subtitle || data.description || '';
  const content = data.content || data.text || '';
  const stats: Record<string, any> = data.stats && typeof data.stats === 'object' ? data.stats : {};

  return (
    <View style={{ backgroundColor: 'rgba(10,10,10,0.9)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', overflow: 'hidden' }}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: '100%', height: 96 }} contentFit="cover" /> : null}
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Blocks size={14} color="#fbbf24" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', flex: 1 }} numberOfLines={1}>
            {data.title || mod.name || 'Module'}
          </Text>
        </View>
        {subtitle ? (
          <Text style={{ color: 'rgba(251,191,36,0.7)', fontSize: 10, fontFamily: 'monospace', marginTop: 3 }}>{subtitle}</Text>
        ) : null}
        {content ? <Text style={{ color: '#d4d4d8', fontSize: 12, lineHeight: 18, marginTop: 8 }}>{content}</Text> : null}
        {Object.keys(stats).length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {Object.entries(stats).slice(0, 3).map(([key, val]) => (
              <View key={key} style={{
                flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)', borderRadius: 8, paddingVertical: 6, alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }} numberOfLines={1}>{String(val)}</Text>
                <Text style={{ color: '#71717a', fontSize: 7, fontWeight: '800', textTransform: 'uppercase' }} numberOfLines={1}>{key}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ── Api-sync / live-feed (LLM fallback ONLY for user-created modules) ────────
function ApiSyncWidget({ mod }: { mod: any }) {
  const data = parsePayload(mod.payload);
  const query = data.query || data.prompt || `Give me current information about: ${mod.name}`;

  const { data: result, isLoading } = useQuery({
    queryKey: ['module-api-sync', mod.id],
    queryFn: async () => integrations.Core.InvokeLLM({
      prompt: `You are a data widget. ${query}. Return a concise JSON response with a "title" string, "content" string (2-3 sentences max), and optionally a "stats" object with 2-3 key/value pairs.`,
      response_json_schema: {
        type: 'object',
        properties: { title: { type: 'string' }, content: { type: 'string' }, stats: { type: 'object' } },
      },
    }),
    staleTime: 5 * 60_000, retry: 1,
  });

  return (
    <WidgetShell mod={mod} accent="#60a5fa" icon={<Globe size={16} color="#60a5fa" />}>
      {isLoading ? (
        <Text style={{ color: '#71717a', fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>SYNCING…</Text>
      ) : (
        <>
          {(result as any)?.title ? (
            <Text style={{ color: '#e4e4e7', fontSize: 12, fontWeight: '800', marginTop: 8 }}>{(result as any).title}</Text>
          ) : null}
          <Text style={{ color: '#a1a1aa', fontSize: 11, lineHeight: 17, marginTop: 4 }}>
            {(result as any)?.content || 'No live data available right now.'}
          </Text>
        </>
      )}
    </WidgetShell>
  );
}

function LiveFeedWidget({ mod }: { mod: any }) {
  return (
    <WidgetShell mod={mod} accent="#f87171" icon={<Radio size={16} color="#f87171" />}>
      <ApiSyncBody mod={mod} fallback={parsePayload(mod.payload).content || mod.description || 'Live feed idle.'} />
    </WidgetShell>
  );
}

function ApiSyncBody({ mod, fallback }: { mod: any; fallback: string }) {
  const data = parsePayload(mod.payload);
  const query = data.query || data.prompt || `Latest updates for: ${mod.name}`;
  const { data: result, isLoading } = useQuery({
    queryKey: ['module-live-feed', mod.id],
    queryFn: async () => integrations.Core.InvokeLLM({
      prompt: `You are a live feed widget. ${query}. Return JSON with "content" (2-3 short lines).`,
      response_json_schema: { type: 'object', properties: { content: { type: 'string' } } },
    }),
    staleTime: 5 * 60_000, retry: 1,
  });
  if (isLoading) return <Text style={{ color: '#71717a', fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>TUNING…</Text>;
  return <Text style={{ color: '#a1a1aa', fontSize: 11, lineHeight: 17, marginTop: 8 }}>{(result as any)?.content || fallback}</Text>;
}

// ── Clock ────────────────────────────────────────────────────────────────────
function ClockWidget({ mod }: { mod: any }) {
  const data = parsePayload(mod.payload);
  const tz = data.timezone && data.timezone !== 'auto' ? data.timezone : undefined;
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      try { setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz })); }
      catch { setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })); }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [tz]);
  return (
    <WidgetShell mod={mod} accent="#a78bfa" icon={<Clock size={16} color="#a78bfa" />}>
      <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', fontFamily: 'monospace', marginTop: 8 }}>{time}</Text>
      {tz ? <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace', marginTop: 2 }}>{tz}</Text> : null}
    </WidgetShell>
  );
}

// ── Spotify Now Playing ─────────────────────────────────────────────────────
function SpotifyModuleWidget({ mod, userId }: { mod: any; userId: string }) {
  const np = useNowPlaying(userId);
  const playing = !!np?.is_playing;
  const pct = playing && np?.duration_ms
    ? Math.min(100, Math.max(0, ((np.progress_ms || 0) / np.duration_ms) * 100))
    : 0;
  return (
    <WidgetShell mod={mod} accent="#1DB954" icon={<Music size={16} color="#1DB954" />}>
      {playing ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            {np?.album_art_url ? (
              <Image source={{ uri: np.album_art_url }} style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: '#18181b' }} contentFit="cover" />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: '#18181b' }} />
            )}
            <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{np?.track_name}</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 11 }} numberOfLines={1}>{np?.artist}</Text>
            </View>
          </View>
          <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
            <View style={{ height: 3, width: `${pct}%`, backgroundColor: '#1DB954' }} />
          </View>
        </>
      ) : (
        <Text style={{ color: '#71717a', fontSize: 11, fontFamily: 'monospace', marginTop: 8 }}>
          SIGNAL SILENT — nothing playing right now
        </Text>
      )}
    </WidgetShell>
  );
}

// ── Steam Now Playing (real API) ────────────────────────────────────────────
type SteamCfg = { steamid: string; appid: string; game_name: string; playtime_hours: number; recent_hours: number | null };

async function loadSteamCfg(userId: string): Promise<SteamCfg | null> {
  try {
    const raw = await AsyncStorage.getItem(`steam_cfg_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
async function saveSteamCfg(userId: string, cfg: SteamCfg) {
  await AsyncStorage.setItem(`steam_cfg_${userId}`, JSON.stringify(cfg));
}

function SteamModuleWidget({ mod, userId, isOwnProfile }: { mod: any; userId: string; isOwnProfile: boolean }) {
  const [cfg, setCfg] = useState<SteamCfg | null>(null);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [step, setStep] = useState<'display' | 'setup_id' | 'setup_game'>('display');
  const [steamId, setSteamId] = useState('');
  const [gamesCache, setGamesCache] = useState<any[]>([]);
  const [setupError, setSetupError] = useState('');
  const [loadingGames, setLoadingGames] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { loadSteamCfg(userId).then((c) => { setCfg(c); setCfgLoaded(true); }); }, [userId]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['steam-stats', cfg?.steamid, cfg?.appid],
    queryFn: () => authFetch(`/steam/stats?steamid=${cfg!.steamid}&appid=${cfg!.appid}`),
    enabled: !!cfg?.steamid && !!cfg?.appid,
    staleTime: 300_000, refetchInterval: 600_000, retry: 1,
  });

  const submitSteamId = async () => {
    setSetupError('');
    setLoadingGames(true);
    try {
      const body: any = await authFetch(`/steam/games?steamid=${steamId.trim()}`);
      if (!body?.games?.length) throw new Error('No games found — check your Steam ID and make sure your profile is Public.');
      setGamesCache(body.games);
      setStep('setup_game');
    } catch (err: any) {
      setSetupError(err?.message || 'Failed to load library');
    } finally {
      setLoadingGames(false);
    }
  };

  const pickGame = async (game: any) => {
    const next: SteamCfg = {
      steamid: steamId.trim(),
      appid: String(game.appid),
      game_name: game.name,
      playtime_hours: game.playtime_hours,
      recent_hours: game.recent_hours,
    };
    await saveSteamCfg(userId, next);
    setCfg(next);
    setStep('display');
  };

  if (!cfgLoaded) return <WidgetShell mod={mod} accent="#66c0f4" icon={<Gamepad2 size={16} color="#66c0f4" />}><Text style={{ color: '#71717a', fontSize: 11, marginTop: 8 }}>Loading…</Text></WidgetShell>;

  // Setup: enter Steam ID
  if (!cfg && step === 'display' && isOwnProfile) return <SteamSetupIdCard onSubmit={submitSteamId} loading={loadingGames} err={setupError} steamId={steamId} setSteamId={setSteamId} mod={mod} />;
  if (step === 'setup_id') return <SteamSetupIdCard onSubmit={submitSteamId} loading={loadingGames} err={setupError} steamId={steamId} setSteamId={setSteamId} mod={mod} />;
  if (step === 'setup_game') return <SteamGamePickerCard mod={mod} games={gamesCache} search={search} setSearch={setSearch} onPick={pickGame} onBack={() => setStep('setup_id')} />;

  // Not configured on someone else's profile.
  if (!cfg) {
    return (
      <WidgetShell mod={mod} accent="#66c0f4" icon={<Gamepad2 size={16} color="#66c0f4" />}>
        <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace', marginTop: 8, letterSpacing: 1 }}>NOT CONFIGURED</Text>
      </WidgetShell>
    );
  }

  const headerImg = `https://cdn.cloudflare.steamstatic.com/steam/apps/${cfg.appid}/header.jpg`;
  const displayName = (stats as any)?.game_name || cfg.game_name || 'Unknown Game';
  const earned = (stats as any)?.achievements_earned ?? null;
  const total = (stats as any)?.achievements_total ?? null;
  const pct = total ? Math.round((earned / total) * 100) : null;

  return (
    <View style={{ backgroundColor: '#0d1117', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(27,40,56,0.9)', overflow: 'hidden' }}>
      <Image source={{ uri: headerImg }} style={{ width: '100%', height: 96 }} contentFit="cover" />
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Gamepad2 size={12} color="#66c0f4" />
          <Text style={{ color: '#66c0f4', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>STEAM</Text>
          <View style={{ flex: 1 }} />
          {isOwnProfile && (
            <TouchableOpacity onPress={() => { setSteamId(cfg.steamid); setStep('setup_id'); }} hitSlop={6}>
              <Edit2 size={12} color="#71717a" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', marginTop: 3 }} numberOfLines={1}>{displayName}</Text>

        {statsLoading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <ActivityIndicator size="small" color="#66c0f4" />
            <Text style={{ color: '#71717a', fontSize: 11 }}>Loading stats…</Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={11} color="#66c0f4" />
                <View>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>{cfg.playtime_hours ?? '—'}</Text>
                  <Text style={{ color: '#71717a', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }}>TOTAL HRS</Text>
                </View>
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={11} color="#4ade80" />
                <View>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>{cfg.recent_hours ?? '—'}</Text>
                  <Text style={{ color: '#71717a', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }}>2 WK HRS</Text>
                </View>
              </View>
            </View>
            {total != null && total > 0 && (
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Trophy size={10} color="#fbbf24" />
                  <Text style={{ color: '#a1a1aa', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginLeft: 4, flex: 1 }}>ACHIEVEMENTS</Text>
                  <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace' }}>{earned} / {total}</Text>
                </View>
                <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 5, width: `${pct ?? 0}%`, backgroundColor: '#66c0f4' }} />
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function SteamSetupIdCard({
  onSubmit, loading, err, steamId, setSteamId, mod,
}: { onSubmit: () => void; loading: boolean; err: string; steamId: string; setSteamId: (v: string) => void; mod: any }) {
  return (
    <WidgetShell mod={mod} accent="#66c0f4" icon={<Gamepad2 size={16} color="#66c0f4" />}>
      <Text style={{ color: '#a1a1aa', fontSize: 10, lineHeight: 14, marginTop: 8 }}>
        Enter your 64-bit Steam ID to load your library. Find it at{' '}
        <Text onPress={() => openSafe('https://steamid.io')} style={{ color: '#66c0f4', textDecorationLine: 'underline' }}>steamid.io</Text>. Your profile must be Public.
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
        <TextInput
          value={steamId}
          onChangeText={setSteamId}
          placeholder="76561198xxxxxxxxx"
          placeholderTextColor="#3f3f46"
          autoCapitalize="none"
          keyboardType="number-pad"
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 12, paddingHorizontal: 10, paddingVertical: 8, fontFamily: 'monospace' }}
        />
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!steamId || loading}
          style={{ paddingHorizontal: 12, backgroundColor: 'rgba(27,40,56,1)', borderWidth: 1, borderColor: 'rgba(102,192,244,0.35)', borderRadius: 8, alignItems: 'center', justifyContent: 'center', opacity: !steamId || loading ? 0.4 : 1 }}
        >
          {loading ? <ActivityIndicator size="small" color="#66c0f4" /> : <ChevronRight size={14} color="#66c0f4" />}
        </TouchableOpacity>
      </View>
      {err ? <Text style={{ color: '#f87171', fontSize: 10, marginTop: 6 }}>{err}</Text> : null}
    </WidgetShell>
  );
}

function SteamGamePickerCard({
  mod, games, search, setSearch, onPick, onBack,
}: { mod: any; games: any[]; search: string; setSearch: (v: string) => void; onPick: (g: any) => void; onBack: () => void }) {
  const filtered = useMemo(
    () => (!search ? games : games.filter((g) => g.name?.toLowerCase().includes(search.toLowerCase()))),
    [games, search],
  );
  return (
    <WidgetShell mod={mod} accent="#66c0f4" icon={<Gamepad2 size={16} color="#66c0f4" />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 8 }}>
        <Text style={{ color: '#c7d5e0', fontSize: 10, fontWeight: '900', letterSpacing: 1, flex: 1 }}>PICK A GAME</Text>
        <TouchableOpacity onPress={onBack} hitSlop={6}>
          <Text style={{ color: '#71717a', fontSize: 9, letterSpacing: 1 }}>← BACK</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, marginBottom: 8 }}>
        <Search size={12} color="#52525b" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search your library..."
          placeholderTextColor="#3f3f46"
          style={{ flex: 1, color: '#fff', fontSize: 11, paddingVertical: 7, marginLeft: 6 }}
        />
      </View>
      <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 4 }}>
        {filtered.slice(0, 60).map((g: any) => (
          <TouchableOpacity
            key={g.appid}
            onPress={() => onPick(g)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <Image
              source={{ uri: `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg` }}
              style={{ width: 26, height: 26, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
              contentFit="cover"
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>{g.name}</Text>
              <Text style={{ color: '#71717a', fontSize: 9, fontFamily: 'monospace' }}>{g.playtime_hours} hrs</Text>
            </View>
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && <Text style={{ color: '#52525b', fontSize: 10, textAlign: 'center', paddingVertical: 12 }}>No games found.</Text>}
      </ScrollView>
    </WidgetShell>
  );
}

// ── Weather Hex (real Open-Meteo) ───────────────────────────────────────────
function interpretWeatherCode(code: number) {
  if (code === 0)  return { label: 'Clear Sky',    emoji: '☀️',  bg: 'rgba(245,158,11,0.15)' };
  if (code <= 3)   return { label: 'Partly Cloudy',emoji: '⛅',  bg: 'rgba(59,130,246,0.15)' };
  if (code <= 48)  return { label: 'Foggy',        emoji: '🌫️', bg: 'rgba(148,148,148,0.15)' };
  if (code <= 57)  return { label: 'Drizzle',      emoji: '🌦️', bg: 'rgba(34,211,238,0.15)' };
  if (code <= 67)  return { label: 'Rain',         emoji: '🌧️', bg: 'rgba(37,99,235,0.15)' };
  if (code <= 77)  return { label: 'Snow',         emoji: '❄️',  bg: 'rgba(191,219,254,0.15)' };
  if (code <= 82)  return { label: 'Rain Showers', emoji: '🌧️', bg: 'rgba(59,130,246,0.15)' };
  if (code <= 86)  return { label: 'Snow Showers', emoji: '🌨️', bg: 'rgba(191,219,254,0.15)' };
  return           { label: 'Thunderstorm', emoji: '⛈️',  bg: 'rgba(168,85,247,0.15)' };
}

function WeatherWidget({ mod, userId, isOwnProfile }: { mod: any; userId: string; isOwnProfile: boolean }) {
  const queryClient = useQueryClient();
  const [useF, setUseF] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const { data: ownerProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['weather-profile', userId],
    queryFn: async () => {
      const res: any[] = await entities.UserProfile.filter({ user_id: userId });
      return res?.[0] || null;
    },
    enabled: !!userId, staleTime: 60_000,
  });

  const savedCoords = ownerProfile?.weather_coords?.lat != null && ownerProfile?.weather_coords?.lon != null
    ? { lat: ownerProfile.weather_coords.lat, lon: ownerProfile.weather_coords.lon }
    : null;

  // Only the profile owner triggers a location prompt.
  useEffect(() => {
    if (!isOwnProfile || !ownerProfile?.id || savedCoords) return;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setGeoError('denied'); return; }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await entities.UserProfile.update(ownerProfile.id, {
          weather_coords: { lat: pos.coords.latitude, lon: pos.coords.longitude, updated_at: new Date() },
        });
        queryClient.invalidateQueries({ queryKey: ['weather-profile', userId] });
      } catch {
        setGeoError('failed');
      }
    })();
  }, [isOwnProfile, ownerProfile?.id, savedCoords, queryClient, userId]);

  const { data: weather, isLoading: fetching } = useQuery({
    queryKey: ['weather-live', savedCoords?.lat, savedCoords?.lon],
    queryFn: async () => {
      const { lat, lon } = savedCoords!;
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
        `&wind_speed_unit=kmh&timezone=auto`,
      );
      const meteo: any = await r.json();
      const c = meteo.current;
      return {
        temperature: c.temperature_2m,
        feels_like: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        wind_speed: c.wind_speed_10m,
        code: c.weather_code,
      };
    },
    enabled: !!savedCoords, staleTime: 600_000, refetchInterval: 900_000,
  });

  const loadingCoords = loadingProfile || (isOwnProfile && !savedCoords && !geoError);
  const loading = loadingCoords || (!!savedCoords && fetching);
  const cond = weather ? interpretWeatherCode(weather.code) : null;
  const fmt = (c: number) => useF ? `${Math.round(c * 9 / 5 + 32)}°F` : `${Math.round(c)}°C`;

  return (
    <WidgetShell mod={mod} accent="#22d3ee" icon={<Globe size={16} color="#22d3ee" />}>
      <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        {(['C', 'F'] as const).map((u) => {
          const active = (u === 'F') === useF;
          return (
            <TouchableOpacity key={u} onPress={() => setUseF(u === 'F')} style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: active ? 'rgba(34,211,238,0.2)' : 'transparent' }}>
              <Text style={{ color: active ? '#22d3ee' : '#52525b', fontSize: 8, fontWeight: '900' }}>°{u}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <ActivityIndicator size="small" color="#22d3ee" />
          <Text style={{ color: '#71717a', fontSize: 11 }}>{loadingCoords ? 'Getting location…' : 'Fetching weather…'}</Text>
        </View>
      ) : !savedCoords ? (
        <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace', letterSpacing: 1, marginTop: 12 }}>
          {isOwnProfile ? (geoError === 'denied' ? 'LOCATION ACCESS DENIED — ENABLE IN SETTINGS' : 'WEATHER NOT CONFIGURED') : 'WEATHER NOT CONFIGURED'}
        </Text>
      ) : weather && cond ? (
        <>
          <View style={{ marginTop: 10, backgroundColor: cond.bg, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{fmt(weather.temperature)}</Text>
              <Text style={{ color: '#a1a1aa', fontSize: 10 }}>Feels like {fmt(weather.feels_like)}</Text>
              <Text style={{ color: '#d4d4d8', fontSize: 11, fontWeight: '700', marginTop: 3 }}>{cond.label}</Text>
            </View>
            <Text style={{ fontSize: 34 }}>{cond.emoji}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 6, alignItems: 'center' }}>
              <Text style={{ color: '#22d3ee', fontSize: 12, fontWeight: '900' }}>{weather.humidity}%</Text>
              <Text style={{ color: '#71717a', fontSize: 7, fontWeight: '800', letterSpacing: 0.5 }}>HUMIDITY</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 6, alignItems: 'center' }}>
              <Text style={{ color: '#22d3ee', fontSize: 12, fontWeight: '900' }}>{Math.round(weather.wind_speed)} km/h</Text>
              <Text style={{ color: '#71717a', fontSize: 7, fontWeight: '800', letterSpacing: 0.5 }}>WIND</Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={{ color: '#71717a', fontSize: 11, marginTop: 8 }}>No weather data available.</Text>
      )}
    </WidgetShell>
  );
}

// ── PC Specs Flex (real UserProfile.pc_specs) ───────────────────────────────
const SPEC_FIELDS = [
  { key: 'gpu', label: 'GPU', Icon: Monitor, color: '#4ade80' },
  { key: 'cpu', label: 'CPU', Icon: Cpu, color: '#60a5fa' },
  { key: 'ram', label: 'RAM', Icon: MemoryStick, color: '#c084fc' },
  { key: 'storage', label: 'STORAGE', Icon: HardDrive, color: '#fbbf24' },
] as const;

function PCSpecsWidget({ mod, userId, isOwnProfile }: { mod: any; userId: string; isOwnProfile: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data: profile } = useQuery({
    queryKey: ['pc-specs-profile', userId],
    queryFn: async () => {
      const rows: any[] = await entities.UserProfile.filter({ user_id: userId });
      return rows?.[0] || null;
    },
    enabled: !!userId, staleTime: 60_000,
  });
  const specs: Record<string, string> = profile?.pc_specs || profile?.theme?.pc_specs || {};

  const saveMutation = useMutation({
    mutationFn: async (next: Record<string, string>) => {
      if (!profile?.id) return;
      await entities.UserProfile.update(profile.id, { pc_specs: next });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pc-specs-profile', userId] });
      setEditing(false);
    },
  });

  const start = () => { setDraft({ ...specs }); setEditing(true); };
  const save = () => saveMutation.mutate(draft);
  const cancel = () => setEditing(false);

  const hasAnySpecs = SPEC_FIELDS.some((f) => specs[f.key]);

  return (
    <WidgetShell mod={mod} accent="#22d3ee" icon={<Cpu size={16} color="#22d3ee" />}>
      <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 }}>
        {isOwnProfile && !editing && (
          <TouchableOpacity onPress={start} hitSlop={6}>
            <Edit2 size={13} color="#71717a" />
          </TouchableOpacity>
        )}
        {editing && (
          <>
            <TouchableOpacity onPress={save} hitSlop={6}>
              <Check size={14} color="#4ade80" />
            </TouchableOpacity>
            <TouchableOpacity onPress={cancel} hitSlop={6}>
              <X size={14} color="#f87171" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {!hasAnySpecs && !editing ? (
        <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace', letterSpacing: 1, marginTop: 12 }}>
          NO SPECS SET
        </Text>
      ) : (
        <View style={{ marginTop: 12, gap: 6 }}>
          {SPEC_FIELDS.map(({ key, label, Icon, color }) => (
            <View key={key} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 8,
            }}>
              <Icon size={13} color={color} />
              <Text style={{ color, fontSize: 9, fontWeight: '900', letterSpacing: 1, width: 60 }}>{label}</Text>
              {editing ? (
                <TextInput
                  value={draft[key] || ''}
                  onChangeText={(v) => setDraft((prev) => ({ ...prev, [key]: v }))}
                  placeholder="—"
                  placeholderTextColor="#3f3f46"
                  style={{ flex: 1, color: '#fff', fontSize: 12, fontFamily: 'monospace', paddingVertical: 0 }}
                />
              ) : (
                <Text style={{ flex: 1, color: '#fff', fontSize: 12, fontFamily: 'monospace' }} numberOfLines={1}>
                  {specs[key] || '—'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </WidgetShell>
  );
}

// ── Symbiote Entity Pet (real UserProfile.neural_links.symbiote) ────────────
function computeMood(symbiote: any) {
  if (!symbiote?.last_action_at) return 'idle';
  const elapsed = Date.now() - new Date(symbiote.last_action_at).getTime();
  if (symbiote.last_action === 'feed' && elapsed < 5 * 60 * 1000) return 'happy';
  if (symbiote.last_action === 'poke' && elapsed < 60 * 1000) return 'angry';
  return 'idle';
}

const MOOD_EMOJI: Record<string, string> = { idle: '🕷️', happy: '😻', angry: '😾' };
const MOOD_COLOR: Record<string, string> = { idle: '#a855f7', happy: '#4ade80', angry: '#f87171' };

function SymbiotePetWidget({ mod, userId, isOwnProfile }: { mod: any; userId: string; isOwnProfile: boolean }) {
  const queryClient = useQueryClient();
  const [mood, setMood] = useState('idle');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: profile } = useQuery({
    queryKey: ['symbiote-profile', userId],
    queryFn: async () => {
      const rows: any[] = await entities.UserProfile.filter({ user_id: userId });
      return rows?.[0] || null;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    setMood(computeMood(profile?.neural_links?.symbiote));
  }, [profile?.neural_links?.symbiote?.last_action_at]);

  const persist = async (action: 'feed' | 'poke') => {
    if (!isOwnProfile || !profile?.id) return;
    const symbiote = { last_action: action, last_action_at: new Date().toISOString() };
    await entities.UserProfile.update(profile.id, {
      neural_links: { ...(profile.neural_links || {}), symbiote },
    });
    queryClient.invalidateQueries({ queryKey: ['symbiote-profile', userId] });
  };

  const trigger = (nextMood: string, duration: number, action: 'feed' | 'poke') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMood(nextMood);
    persist(action);
    timerRef.current = setTimeout(() => setMood('idle'), duration);
  };

  const accent = MOOD_COLOR[mood];

  return (
    <WidgetShell mod={mod} accent={accent} icon={<Skull size={16} color={accent} />}>
      <View style={{ alignItems: 'center', marginTop: 12, gap: 10 }}>
        <Text style={{ fontSize: 60 }}>{MOOD_EMOJI[mood]}</Text>
        <Text style={{ color: accent, fontSize: 10, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>
          {mood}
        </Text>
        {isOwnProfile ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              onPress={() => trigger('happy', 2000, 'feed')}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)' }}
            >
              <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>FEED</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => trigger('angry', 1000, 'poke')}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(248,113,113,0.15)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' }}
            >
              <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>POKE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={{ color: '#71717a', fontSize: 10 }}>Their symbiote is watching…</Text>
        )}
      </View>
    </WidgetShell>
  );
}

// ── Gaming Uplink Card (read UserProfile.gaming_status set by desktop) ──────
function GamingUplinkWidget({ mod, userId }: { mod: any; userId: string }) {
  const { data: profile } = useQuery({
    queryKey: ['gaming-uplink-profile', userId],
    queryFn: async () => {
      const rows: any[] = await entities.UserProfile.filter({ user_id: userId });
      return rows?.[0] || null;
    },
    enabled: !!userId, staleTime: 30_000, refetchInterval: 45_000,
  });
  const gs = profile?.gaming_status;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!gs?.sessionStart) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - gs.sessionStart) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [gs?.sessionStart]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <WidgetShell mod={mod} accent="#f97316" icon={<Gamepad2 size={16} color="#f97316" />}>
      {gs?.game ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' }} />
            <Text style={{ color: '#f97316', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>LIVE</Text>
            <View style={{ flex: 1 }} />
            {gs?.sessionStart && (
              <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace' }}>{mm}:{ss}</Text>
            )}
          </View>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }} numberOfLines={2}>{gs.game}</Text>
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 }}>NO GAME DETECTED</Text>
          <Text style={{ color: '#52525b', fontSize: 10, marginTop: 4 }}>Activity from Spidr desktop syncs here.</Text>
        </View>
      )}
    </WidgetShell>
  );
}

// ── Daily Streak Counter (real DirectMessage + Message counts) ──────────────
function StreakWidget({ mod, userId }: { mod: any; userId: string }) {
  const { data: msgs = [] } = useQuery({
    queryKey: ['streak-msgs', userId],
    queryFn: () => entities.Message.filter({ author_id: userId }),
    enabled: !!userId, staleTime: 60_000,
  });
  const { data: dms = [] } = useQuery({
    queryKey: ['streak-dms', userId],
    queryFn: () => entities.DirectMessage.filter({ sender_id: userId }),
    enabled: !!userId, staleTime: 60_000,
  });

  const DAYS = 30;
  const buckets = new Array(DAYS).fill(0);
  const bump = (arr: any[]) => {
    const now = Date.now();
    for (const item of arr) {
      const created = new Date(item.created_date || item.sent_at || item.created_at).getTime();
      const daysAgo = Math.floor((now - created) / 86400000);
      if (daysAgo >= 0 && daysAgo < DAYS) buckets[DAYS - 1 - daysAgo]++;
    }
  };
  bump(msgs as any[]); bump(dms as any[]);

  let current = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i] > 0) current++;
    else break;
  }
  const total = buckets.filter((v) => v > 0).length;
  let best = 0, run = 0;
  for (const v of buckets) {
    if (v > 0) { run++; best = Math.max(best, run); } else run = 0;
  }

  return (
    <WidgetShell mod={mod} accent="#fbbf24" icon={<Flame size={16} color="#fbbf24" />}>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
        {[['Current', current, '#fbbf24'], ['Best', best, '#fff'], ['Active', total, '#a1a1aa']].map(([label, val, color]) => (
          <View key={String(label)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ color: color as string, fontSize: 18, fontWeight: '900' }}>{String(val)}</Text>
            <Text style={{ color: '#71717a', fontSize: 8, fontWeight: '800', letterSpacing: 1 }}>{String(label).toUpperCase()}</Text>
          </View>
        ))}
      </View>
      {current > 0 && (
        <Text style={{ color: '#fbbf24', fontSize: 9, fontFamily: 'monospace', letterSpacing: 2, marginTop: 8, textAlign: 'center' }}>KEEP IT GOING!</Text>
      )}
    </WidgetShell>
  );
}

// ── Entry point ──────────────────────────────────────────────────────────────
export function ModuleWidget({ mod, userId, isOwnProfile = false }: { mod: any; userId: string; isOwnProfile?: boolean }) {
  const payload = parsePayload(mod.payload);
  const nameLower = (mod.name || '').toLowerCase();
  const isOfficial = mod.author_id === SPIDR_OFFICIAL;

  // Route official builtins to their real components. The author gate stops
  // name-squatting (a user publishing a module called "Steam Now Playing"
  // and having it hijack the real widget on someone else's profile).
  if (isOfficial) {
    if (mod.name === 'Spotify Now Playing') return <SpotifyModuleWidget mod={mod} userId={userId} />;
    if (mod.name === 'Steam Now Playing')   return <SteamModuleWidget   mod={mod} userId={userId} isOwnProfile={isOwnProfile} />;
    if (mod.name === 'Weather Hex')         return <WeatherWidget       mod={mod} userId={userId} isOwnProfile={isOwnProfile} />;
    if (mod.name === 'PC Specs Flex')       return <PCSpecsWidget       mod={mod} userId={userId} isOwnProfile={isOwnProfile} />;
    if (mod.name === 'Symbiote Entity Pet') return <SymbiotePetWidget   mod={mod} userId={userId} isOwnProfile={isOwnProfile} />;
    if (mod.name === 'Gaming Uplink Card')  return <GamingUplinkWidget  mod={mod} userId={userId} />;
    if (mod.name === 'Daily Streak Counter' || mod.tags?.includes('streak')) return <StreakWidget mod={mod} userId={userId} />;
  }

  // Name-based fallbacks for user-created modules that share the same idea.
  if (payload.service === 'weather' || nameLower.includes('weather')) return <WeatherWidget mod={mod} userId={userId} isOwnProfile={isOwnProfile} />;
  if (payload.timezone || nameLower.includes('clock') || nameLower.includes('timezone')) return <ClockWidget mod={mod} />;

  switch (mod.type || 'static_text') {
    case 'display_widget': return <DisplayWidget mod={mod} />;
    case 'api_sync':       return <ApiSyncWidget mod={mod} />;
    case 'live_feed':      return <LiveFeedWidget mod={mod} />;
    case 'static_text':
    default:               return <StaticTextWidget mod={mod} />;
  }
}
