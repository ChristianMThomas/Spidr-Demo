import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Blocks, Globe, Radio, FileText, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';

/**
 * Dynamically renders any user-created module based on its type and payload.
 * This is the core widget that makes ALL modules actually functional.
 */
export default function DynamicModuleWidget({ mod, userId, isOwnProfile }) {
  const type = mod.type || 'static_text';
  const payload = parsePayload(mod.payload);

  // Special-cased modules
  if (payload.service === 'weather' || mod.name?.toLowerCase().includes('weather')) {
    return <WeatherWidget mod={mod} userId={userId} isOwnProfile={isOwnProfile} />;
  }
  if (payload.timezone || mod.name?.toLowerCase().includes('clock') || mod.name?.toLowerCase().includes('timezone')) {
    return <ClockWidget mod={mod} />;
  }
  if (mod.tags?.includes('streak') || mod.name?.toLowerCase().includes('streak')) {
    return <StreakWidget mod={mod} userId={userId} />;
  }

  switch (type) {
    case 'static_text':
      return <StaticTextWidget mod={mod} />;
    case 'display_widget':
      return <DisplayWidget mod={mod} />;
    case 'api_sync':
      return <ApiSyncWidget mod={mod} />;
    case 'live_feed':
      return <LiveFeedWidget mod={mod} />;
    default:
      return <StaticTextWidget mod={mod} />;
  }
}

function parsePayload(payloadStr) {
  if (!payloadStr) return {};
  try { return JSON.parse(payloadStr); } catch { return { raw: payloadStr }; }
}

// --- STATIC TEXT: Renders text/markdown content from payload ---
function StaticTextWidget({ mod }) {
  const data = parsePayload(mod.payload);
  const content = data.content || data.text || data.raw || mod.description || 'No content configured.';

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 relative overflow-hidden">
      <WidgetHeader mod={mod} icon={FileText} color="text-green-400" />
      <div className="mt-3 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
      {data.link && (
        <a href={data.link} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-3 text-[10px] text-blue-400 hover:text-blue-300 font-mono underline">
          {data.link_label || data.link}
        </a>
      )}
    </div>
  );
}

// --- DISPLAY WIDGET: Shows images, banners, or custom visual content ---
function DisplayWidget({ mod }) {
  const data = parsePayload(mod.payload);
  const imageUrl = data.image_url || data.background || data.banner || mod.icon_url;
  const title = data.title || mod.name;
  const subtitle = data.subtitle || data.description || '';
  const content = data.content || data.text || '';

  return (
    <div className="bg-[#0a0a0a] border border-amber-500/20 rounded-xl overflow-hidden relative">
      {imageUrl && (
        <div className="h-32 relative">
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        </div>
      )}
      <div className="p-5">
        <WidgetHeader mod={mod} icon={Blocks} color="text-amber-400" />
        {subtitle && <p className="text-[11px] text-amber-400/70 font-mono mt-1">{subtitle}</p>}
        {content && <p className="text-sm text-gray-300 mt-3 leading-relaxed whitespace-pre-wrap">{content}</p>}
        {data.stats && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {Object.entries(data.stats).map(([key, val]) => (
              <div key={key} className="bg-black/50 border border-white/5 rounded-lg p-2 text-center">
                <div className="text-lg font-black text-white">{val}</div>
                <div className="text-[8px] text-gray-500 uppercase font-bold">{key}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- API SYNC: Fetches data from web and displays it ---
function ApiSyncWidget({ mod }) {
  const data = parsePayload(mod.payload);
  const query = data.query || data.prompt || `Give me current information about: ${mod.name}`;

  const { data: result, isLoading } = useQuery({
    queryKey: ['module-api-sync', mod.id],
    queryFn: async () => {
      const res = await integrations.Core.InvokeLLM({
        prompt: `You are a data widget. ${query}. Return a concise JSON response with a "title" string, "content" string (2-3 sentences max), and optionally a "stats" object with 2-3 key/value pairs.`,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            stats: { type: "object" }
          }
        }
      });
      return res;
    },
    staleTime: 300000,
    refetchInterval: 600000,
  });

  return (
    <div className="bg-[#0a0a0a] border border-blue-500/20 rounded-xl p-5 relative overflow-hidden">
      <WidgetHeader mod={mod} icon={Globe} color="text-blue-400" />
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-zinc-500">
          <Loader2 size={18} className="animate-spin mr-2" /> Syncing data...
        </div>
      ) : result ? (
        <div className="mt-3">
          {result.title && <h4 className="text-sm font-bold text-white mb-2">{result.title}</h4>}
          {result.content && <p className="text-[11px] text-gray-400 leading-relaxed">{result.content}</p>}
          {result.stats && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {Object.entries(result.stats).map(([key, val]) => (
                <div key={key} className="bg-black/50 border border-blue-500/10 rounded-lg p-2 text-center">
                  <div className="text-sm font-black text-blue-400">{String(val)}</div>
                  <div className="text-[8px] text-gray-500 uppercase font-bold">{key}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-3">No data available.</p>
      )}
      <div className="absolute top-3 right-3 text-[8px] text-blue-500/50 font-mono">AI</div>
    </div>
  );
}

// --- LIVE FEED: Shows a scrolling/updating feed of items ---
function LiveFeedWidget({ mod }) {
  const data = parsePayload(mod.payload);
  const items = data.items || data.feed || [];
  const feedTitle = data.feed_title || 'Live Feed';

  const { data: liveData, isLoading } = useQuery({
    queryKey: ['module-live-feed', mod.id],
    queryFn: async () => {
      if (items.length > 0) return items;
      const prompt = data.query || data.prompt || `Generate 5 recent feed items about: ${mod.name}`;
      const res = await integrations.Core.InvokeLLM({
        prompt: `${prompt}. Return JSON with an "items" array where each item has "title" (string) and "detail" (short string).`,
        response_json_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  detail: { type: "string" }
                }
              }
            }
          }
        }
      });
      return res.items || [];
    },
    staleTime: 180000,
    refetchInterval: 300000,
  });

  const displayItems = liveData || items;

  return (
    <div className="bg-[#0a0a0a] border border-purple-500/20 rounded-xl p-5 relative overflow-hidden">
      <WidgetHeader mod={mod} icon={Radio} color="text-purple-400" />
      <div className="absolute top-3 right-3 text-[8px] text-purple-500/50 font-mono">AI</div>
      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-zinc-500">
          <Loader2 size={18} className="animate-spin mr-2" /> Loading feed...
        </div>
      ) : (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
          {displayItems.length === 0 ? (
            <p className="text-[11px] text-gray-500">No feed items yet.</p>
          ) : displayItems.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-start gap-2 p-2 bg-black/40 border border-white/5 rounded-lg"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white truncate">{item.title || item}</div>
                {item.detail && <div className="text-[10px] text-gray-500 truncate">{item.detail}</div>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// WMO weather interpretation code → label, emoji, gradient
function interpretWeatherCode(code) {
  if (code === 0)              return { label: 'Clear Sky',      emoji: '☀️',  gradient: 'from-amber-500/20 to-yellow-500/10' };
  if (code <= 3)               return { label: 'Partly Cloudy',  emoji: '⛅',  gradient: 'from-blue-400/20 to-amber-400/10' };
  if (code <= 48)              return { label: 'Foggy',          emoji: '🌫️', gradient: 'from-gray-400/20 to-gray-300/10' };
  if (code <= 57)              return { label: 'Drizzle',        emoji: '🌦️', gradient: 'from-blue-400/20 to-cyan-400/10' };
  if (code <= 67)              return { label: 'Rain',           emoji: '🌧️', gradient: 'from-blue-600/20 to-cyan-600/10' };
  if (code <= 77)              return { label: 'Snow',           emoji: '❄️',  gradient: 'from-blue-200/20 to-white/10' };
  if (code <= 82)              return { label: 'Rain Showers',   emoji: '🌧️', gradient: 'from-blue-500/20 to-cyan-500/10' };
  if (code <= 86)              return { label: 'Snow Showers',   emoji: '🌨️', gradient: 'from-blue-200/20 to-white/10' };
  return                              { label: 'Thunderstorm',   emoji: '⛈️',  gradient: 'from-purple-500/20 to-gray-500/10' };
}

// --- WEATHER: shows the PROFILE OWNER's weather (not the viewer's) ---
// The widget reads the owner's saved coords from their UserProfile and asks
// Open-Meteo for current conditions at those coords. The owner's coords are
// captured the first time they grant the browser geolocation prompt on their
// own profile, then persisted. Viewers never see a location label — only the
// temperature, condition, humidity, and wind — so the owner's precise area
// stays private even though the weather is theirs.
function WeatherWidget({ mod, userId, isOwnProfile }) {
  const queryClient = useQueryClient();
  const [useFahrenheit, setUseFahrenheit] = useState(false);
  const [geoError, setGeoError] = useState(null);

  // Pull the profile owner's saved coords. Without a userId we can't scope
  // anything — fall back to viewer-less empty state.
  const { data: ownerProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['weather-profile', userId],
    queryFn: async () => {
      const res = await entities.UserProfile.filter({ user_id: userId });
      return res?.[0] || null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const savedCoords = ownerProfile?.weather_coords?.lat != null && ownerProfile?.weather_coords?.lon != null
    ? { lat: ownerProfile.weather_coords.lat, lon: ownerProfile.weather_coords.lon }
    : null;

  // Owner-only: if no coords are saved yet, request browser geolocation and
  // persist them. We never trigger this for visitors — viewing someone else's
  // profile shouldn't pop a location prompt on your browser, and the viewer's
  // coords shouldn't end up on the owner's profile.
  useEffect(() => {
    if (!isOwnProfile || !ownerProfile?.id || savedCoords) return;
    if (!navigator.geolocation) { setGeoError('unsupported'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await entities.UserProfile.update(ownerProfile.id, {
            weather_coords: {
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              updated_at: new Date(),
            },
          });
          queryClient.invalidateQueries({ queryKey: ['weather-profile', userId] });
        } catch (err) {
          console.error('[weather] failed to save coords:', err);
        }
      },
      () => setGeoError('denied'),
      { timeout: 10000 }
    );
  }, [isOwnProfile, ownerProfile?.id, savedCoords, queryClient, userId]);

  // Fetch live weather for the OWNER's coords (no reverse-geocode — we don't
  // want or need the city name).
  const { data: weather, isLoading: fetching } = useQuery({
    queryKey: ['weather-live', savedCoords?.lat, savedCoords?.lon],
    queryFn: async () => {
      const { lat, lon } = savedCoords;
      const meteo = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
        `&wind_speed_unit=kmh&timezone=auto`
      ).then(r => r.json());
      const c = meteo.current;
      return {
        temperature: c.temperature_2m,
        feels_like:  c.apparent_temperature,
        humidity:    c.relative_humidity_2m,
        wind_speed:  c.wind_speed_10m,
        code:        c.weather_code,
      };
    },
    enabled: !!savedCoords,
    staleTime: 600_000,
    refetchInterval: 900_000,
  });

  const loadingCoords = loadingProfile || (isOwnProfile && !savedCoords && !geoError);
  const loading = loadingCoords || (!!savedCoords && fetching);
  const cond    = weather ? interpretWeatherCode(weather.code) : null;

  const fmt = (celsius) => useFahrenheit
    ? `${Math.round(celsius * 9 / 5 + 32)}°F`
    : `${Math.round(celsius)}°C`;

  return (
    <div className="bg-[#0a0a0a] border border-cyan-500/20 rounded-xl p-5 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <WidgetHeader mod={mod} icon={Globe} color="text-cyan-400" />
        <button
          onClick={() => setUseFahrenheit(f => !f)}
          className="flex items-center shrink-0 rounded-md overflow-hidden border border-white/10 text-[9px] font-black uppercase tracking-wider"
        >
          <span className={`px-2 py-1 transition-colors ${!useFahrenheit ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/30 hover:text-white/60'}`}>°C</span>
          <span className={`px-2 py-1 transition-colors ${useFahrenheit  ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/30 hover:text-white/60'}`}>°F</span>
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8 text-zinc-500">
          <Loader2 size={18} className="animate-spin mr-2" />
          {loadingCoords ? 'Getting location…' : 'Fetching weather…'}
        </div>
      ) : !savedCoords ? (
        // Empty state. Two flavors:
        //   - Own profile with denied/unsupported geolocation → ask to enable it
        //   - Viewing someone else who hasn't configured their weather → blank
        isOwnProfile ? (
          <div className="mt-3 text-center py-4">
            <div className="text-2xl mb-2">📍</div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              {geoError === 'denied'
                ? <>Location access denied.<br />Enable location to share your weather.</>
                : <>Weather not configured.</>}
            </p>
          </div>
        ) : (
          <div className="mt-3 text-center py-6">
            <p className="text-[11px] text-gray-600 font-mono uppercase tracking-widest">Weather not configured</p>
          </div>
        )
      ) : weather && cond ? (
        <div className="mt-3">
          <div className={`bg-gradient-to-br ${cond.gradient} rounded-lg p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-black text-white">{fmt(weather.temperature)}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Feels like {fmt(weather.feels_like)}</div>
              </div>
              <div className="text-4xl">{cond.emoji}</div>
            </div>
            <div className="text-xs text-gray-300 font-medium mt-2">{cond.label}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-black/40 border border-white/5 rounded-lg p-2 text-center">
              <div className="text-sm font-bold text-cyan-400">{weather.humidity}%</div>
              <div className="text-[8px] text-gray-500 uppercase font-bold">Humidity</div>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-lg p-2 text-center">
              <div className="text-sm font-bold text-cyan-400">{Math.round(weather.wind_speed)} km/h</div>
              <div className="text-[8px] text-gray-500 uppercase font-bold">Wind</div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-3">No weather data available.</p>
      )}
    </div>
  );
}

// --- CLOCK: Live local time display ---
function ClockWidget({ mod }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const data = parsePayload(mod.payload);
  const tz = data.timezone === 'auto' || !data.timezone ? undefined : data.timezone;

  const timeStr = now.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: tz,
    hour12: true,
  });
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: tz,
  });
  const tzLabel = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 relative overflow-hidden">
      <WidgetHeader mod={mod} icon={Globe} color="text-cyan-400" />
      <div className="mt-4 text-center">
        <div className="text-3xl font-black text-white tracking-tighter font-mono">{timeStr}</div>
        <div className="text-[11px] text-gray-400 mt-1">{dateStr}</div>
        <div className="text-[9px] text-gray-600 font-mono mt-1 uppercase tracking-widest">{tzLabel}</div>
      </div>
    </div>
  );
}

// --- STREAK: Real consecutive-day activity streak ---
function buildDailyBuckets(items, days) {
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  items.forEach(item => {
    const created = new Date(item.created_date || item.sent_at || item.created_at).getTime();
    const daysAgo = Math.floor((now - created) / 86400000);
    if (daysAgo >= 0 && daysAgo < days) buckets[days - 1 - daysAgo]++;
  });
  return buckets;
}

function calcStreak(buckets) {
  let streak = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i] > 0) streak++;
    else break;
  }
  return streak;
}

function StreakWidget({ mod, userId }) {
  const { data: msgs = [] } = useQuery({
    queryKey: ['streak-msgs', userId],
    queryFn: () => entities.Message.filter({ author_id: userId }),
    enabled: !!userId,
    staleTime: 60000,
  });
  const { data: dms = [] } = useQuery({
    queryKey: ['streak-dms', userId],
    queryFn: () => entities.DirectMessage.filter({ sender_id: userId }),
    enabled: !!userId,
    staleTime: 60000,
  });

  const DAYS = 30;
  const msgBuckets = buildDailyBuckets(msgs, DAYS);
  const dmBuckets  = buildDailyBuckets(dms, DAYS);
  const combined   = msgBuckets.map((v, i) => v + (dmBuckets[i] || 0));
  const current    = calcStreak(combined);
  const best       = Math.max(...combined.map((_, i) => calcStreak(combined.slice(0, i + 1))));
  const total      = combined.filter(v => v > 0).length;

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 relative overflow-hidden">
      <WidgetHeader mod={mod} icon={Radio} color="text-amber-400" />
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[['Current', current, 'text-amber-400'], ['Best', best, 'text-white'], ['Active Days', total, 'text-gray-400']].map(([label, val, cls]) => (
          <div key={label} className="bg-black/50 border border-white/5 rounded-lg p-2 text-center">
            <div className={`text-lg font-black ${cls}`}>{val}</div>
            <div className="text-[8px] text-gray-500 uppercase font-bold">{label}</div>
          </div>
        ))}
      </div>
      {current > 0 && (
        <p className="text-[9px] text-amber-400/60 font-mono uppercase tracking-widest mt-3 text-center">keep it going!</p>
      )}
    </div>
  );
}

// --- Shared header ---
function WidgetHeader({ mod, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-black border border-white/10 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
        {mod.icon_url ? <img src={mod.icon_url} alt="" className="w-full h-full object-cover" /> : <Icon size={14} className={color} />}
      </div>
      <div className="min-w-0">
        <h3 className="text-xs font-bold text-white truncate">{mod.name}</h3>
        <div className="text-[9px] text-gray-600 font-mono">by @{mod.author_name || 'Unknown'}</div>
      </div>
    </div>
  );
}