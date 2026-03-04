import React from 'react';
import { motion } from 'framer-motion';
import { Blocks, Globe, Radio, FileText, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Dynamically renders any user-created module based on its type and payload.
 * This is the core widget that makes ALL modules actually functional.
 */
export default function DynamicModuleWidget({ mod }) {
  const type = mod.type || 'static_text';
  const payload = parsePayload(mod.payload);

  // Special handling for weather modules
  if (payload.service === 'weather' || mod.name?.toLowerCase().includes('weather')) {
    return <WeatherWidget mod={mod} />;
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
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a data widget. ${query}. Return a concise JSON response with a "title" string, "content" string (2-3 sentences max), and optionally a "stats" object with 2-3 key/value pairs.`,
        add_context_from_internet: true,
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
    staleTime: 300000, // 5 min cache
    refetchInterval: 600000, // refresh every 10 min
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
      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Live sync" />
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
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `${prompt}. Return JSON with an "items" array where each item has "title" (string) and "detail" (short string).`,
        add_context_from_internet: true,
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
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
        <span className="text-[8px] text-purple-500 font-mono">LIVE</span>
      </div>
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

// --- WEATHER: Shows real weather data ---
function WeatherWidget({ mod }) {
  const { data: weather, isLoading } = useQuery({
    queryKey: ['module-weather', mod.id],
    queryFn: async () => {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Get the current weather conditions. Return JSON with: "location" (city name), "temperature" (number in celsius), "condition" (one of: sunny, cloudy, rainy, snowy, stormy, windy, foggy, partly_cloudy, clear_night), "humidity" (number %), "wind_speed" (number km/h), "feels_like" (number in celsius). Use a major city's real current weather.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            location: { type: "string" },
            temperature: { type: "number" },
            condition: { type: "string" },
            humidity: { type: "number" },
            wind_speed: { type: "number" },
            feels_like: { type: "number" }
          }
        }
      });
      return res;
    },
    staleTime: 600000,
    refetchInterval: 900000,
  });

  const conditionEmoji = {
    sunny: '☀️', cloudy: '☁️', rainy: '🌧️', snowy: '❄️', stormy: '⛈️',
    windy: '💨', foggy: '🌫️', partly_cloudy: '⛅', clear_night: '🌙'
  };

  const conditionGradient = {
    sunny: 'from-amber-500/20 to-yellow-500/10',
    cloudy: 'from-gray-500/20 to-slate-500/10',
    rainy: 'from-blue-500/20 to-cyan-500/10',
    snowy: 'from-blue-200/20 to-white/10',
    stormy: 'from-purple-500/20 to-gray-500/10',
    windy: 'from-teal-500/20 to-cyan-500/10',
    foggy: 'from-gray-400/20 to-gray-300/10',
    partly_cloudy: 'from-blue-400/20 to-amber-400/10',
    clear_night: 'from-indigo-500/20 to-purple-500/10'
  };

  return (
    <div className="bg-[#0a0a0a] border border-cyan-500/20 rounded-xl p-5 relative overflow-hidden">
      <WidgetHeader mod={mod} icon={Globe} color="text-cyan-400" />
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-zinc-500">
          <Loader2 size={18} className="animate-spin mr-2" /> Fetching weather...
        </div>
      ) : weather ? (
        <div className="mt-3">
          <div className={`bg-gradient-to-br ${conditionGradient[weather.condition] || 'from-cyan-500/20 to-blue-500/10'} rounded-lg p-4 relative`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-black text-white">{Math.round(weather.temperature)}°C</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Feels like {Math.round(weather.feels_like)}°C</div>
              </div>
              <div className="text-4xl">{conditionEmoji[weather.condition] || '🌡️'}</div>
            </div>
            <div className="text-xs text-gray-300 font-medium mt-2 capitalize">{weather.condition?.replace('_', ' ')}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">📍 {weather.location}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-black/40 border border-white/5 rounded-lg p-2 text-center">
              <div className="text-sm font-bold text-cyan-400">{weather.humidity}%</div>
              <div className="text-[8px] text-gray-500 uppercase font-bold">Humidity</div>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-lg p-2 text-center">
              <div className="text-sm font-bold text-cyan-400">{weather.wind_speed} km/h</div>
              <div className="text-[8px] text-gray-500 uppercase font-bold">Wind</div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-3">No weather data available.</p>
      )}
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
        <span className="text-[8px] text-cyan-500 font-mono">LIVE</span>
      </div>
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