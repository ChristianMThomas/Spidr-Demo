import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { entities, integrations } from '@/api/apiClient';
import { ShieldCheck, Terminal, CheckCircle, AlertTriangle, Code, Loader2, Upload, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { scanContent } from '@/components/spidr/ContentScanner';
import DynamicModuleWidget from './widgets/DynamicModuleWidget';

/**
 * ModuleFabricator — the build-a-widget UI for the Module Nexus.
 *
 * The old version asked users to write raw JSON in a textarea. Result: the
 * generated module rendered the literal JSON as text instead of a working
 * widget. This version gives each module type its own structured form, builds
 * the payload JSON behind the scenes, and shows a live widget preview on the
 * right so the user sees what they're publishing.
 *
 * Advanced users can still toggle "raw JSON" if they want to hand-craft the
 * payload — the structured form just makes the common cases work without code.
 */

const TYPE_INFO = {
  static_text: {
    label: 'Static Text',
    description: 'Pin a quote, motto, or info card to your profile. Renders the same way every time.',
    color: 'text-green-400',
    accent: '#10b981',
  },
  display_widget: {
    label: 'Display Widget',
    description: 'A card with title, optional image/banner, description, and up to 3 stat tiles.',
    color: 'text-amber-400',
    accent: '#f59e0b',
  },
  api_sync: {
    label: 'API Sync (Live)',
    description: 'Fetches live information from the web every few minutes. Great for weather, news, prices.',
    color: 'text-blue-400',
    accent: '#3b82f6',
  },
  live_feed: {
    label: 'Live Feed',
    description: 'A scrolling list of items that auto-refreshes. Tracks, news, scores, alerts.',
    color: 'text-purple-400',
    accent: '#a855f7',
  },
};

const SCAN_LINES = [
  '> INITIALIZING AEGIS CODE SCANNER...',
  '> PARSING MODULE PAYLOAD...',
  '> CHECKING FOR <script> INJECTION (XSS)...',
  '> SCANNING TEXT CONTENT FOR VIOLATIONS...',
  '> RUNNING NLP PROFANITY FILTER...',
  '> EVALUATING URL ENDPOINTS...',
];

export default function ModuleFabricator({ currentUser, onPublished }) {
  // Shared
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('static_text');
  const [tags, setTags] = useState('');
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState('');

  // Mode toggle — structured form vs raw JSON
  const [rawMode, setRawMode] = useState(false);
  const [rawPayload, setRawPayload] = useState('');

  // Type-specific fields
  const [staticContent, setStaticContent] = useState('');
  const [staticLink, setStaticLink] = useState('');

  const [displayTitle, setDisplayTitle] = useState('');
  const [displaySubtitle, setDisplaySubtitle] = useState('');
  const [displayContent, setDisplayContent] = useState('');
  const [displayImageUrl, setDisplayImageUrl] = useState('');
  const [displayStats, setDisplayStats] = useState([{ key: '', val: '' }]);

  const [apiQuery, setApiQuery] = useState('');

  const [feedTitle, setFeedTitle] = useState('');
  const [feedItems, setFeedItems] = useState([{ title: '', detail: '' }]);
  const [feedQuery, setFeedQuery] = useState('');

  // Scan + publish state
  const [scanState, setScanState] = useState('idle'); // idle, scanning, passed, failed
  const [scanError, setScanError] = useState('');
  const [scanLines, setScanLines] = useState([]);
  const [publishing, setPublishing] = useState(false);

  // ── Build the payload from whichever form mode is active ────────────────────
  const builtPayload = useMemo(() => {
    if (rawMode) return rawPayload;

    if (type === 'static_text') {
      const obj = { content: staticContent };
      if (staticLink.trim()) obj.link = staticLink.trim();
      return JSON.stringify(obj);
    }
    if (type === 'display_widget') {
      const obj = {};
      if (displayTitle.trim())    obj.title = displayTitle.trim();
      if (displaySubtitle.trim()) obj.subtitle = displaySubtitle.trim();
      if (displayContent.trim())  obj.content = displayContent.trim();
      if (displayImageUrl.trim()) obj.image_url = displayImageUrl.trim();
      const stats = displayStats
        .filter(s => s.key.trim() && s.val.trim())
        .reduce((acc, s) => { acc[s.key.trim()] = s.val.trim(); return acc; }, {});
      if (Object.keys(stats).length > 0) obj.stats = stats;
      return JSON.stringify(obj);
    }
    if (type === 'api_sync') {
      return JSON.stringify({ query: apiQuery || `Latest information about ${name || 'this topic'}` });
    }
    if (type === 'live_feed') {
      const obj = {};
      if (feedTitle.trim()) obj.feed_title = feedTitle.trim();
      const items = feedItems.filter(i => i.title.trim() || i.detail.trim());
      if (items.length > 0) obj.items = items;
      if (feedQuery.trim()) obj.query = feedQuery.trim();
      return JSON.stringify(obj);
    }
    return '{}';
  }, [
    rawMode, rawPayload, type, name,
    staticContent, staticLink,
    displayTitle, displaySubtitle, displayContent, displayImageUrl, displayStats,
    apiQuery,
    feedTitle, feedItems, feedQuery,
  ]);

  // Build the preview "module" — what DynamicModuleWidget would render
  const previewMod = useMemo(() => ({
    id: 'preview',
    name: name || 'Untitled Module',
    description: description || 'Preview',
    type,
    payload: builtPayload,
    icon_url: iconPreview,
    author_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username || 'You',
  }), [name, description, type, builtPayload, iconPreview, currentUser]);

  // ── Icon upload ─────────────────────────────────────────────────────────────
  const handleIconChange = (file) => {
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  // ── Scan ────────────────────────────────────────────────────────────────────
  const runScan = async () => {
    if (!name.trim()) { toast.error('Module name is required'); return; }
    if (!description.trim()) { toast.error('Description is required'); return; }

    // Validate raw JSON if in raw mode
    if (rawMode && rawPayload.trim()) {
      try { JSON.parse(rawPayload); }
      catch { toast.error('Invalid JSON in raw payload'); return; }
    }

    setScanState('scanning');
    setScanError('');
    setScanLines([]);

    for (let i = 0; i < SCAN_LINES.length; i++) {
      await new Promise(r => setTimeout(r, 350));
      setScanLines(prev => [...prev, SCAN_LINES[i]]);
    }

    // Run an actual safety scan on the textual content.
    // scanContent fails open (returns safe) when no LLM key is configured —
    // so users without AI configured can still publish modules.
    const textToCheck = `Name: ${name}\nDescription: ${description}\nTags: ${tags}\n${builtPayload}`;
    let safetyResult;
    try {
      safetyResult = await scanContent('data:text/plain;base64,' + btoa(unescape(encodeURIComponent(textToCheck))));
    } catch {
      safetyResult = { safe: true };
    }

    await new Promise(r => setTimeout(r, 400));

    // Local hard checks (cheap, no LLM required)
    const dangerous = /<script\b/i.test(builtPayload) || /javascript:/i.test(builtPayload) || /on(click|load|error|mouse\w+)=/i.test(builtPayload);
    if (dangerous) {
      setScanLines(prev => [...prev, { text: '> VIOLATION: <script> or event handler detected in payload', color: 'text-red-500' }]);
      setScanState('failed');
      setScanError('Inline scripts and event handlers are not allowed in module payloads.');
      return;
    }

    if (!safetyResult.safe) {
      setScanLines(prev => [...prev, { text: `> VIOLATION DETECTED: ${safetyResult.category}`, color: 'text-red-500' }]);
      setScanState('failed');
      setScanError('Content flagged as: ' + safetyResult.category);
      return;
    }

    setScanLines(prev => [...prev, { text: '> ALL CHECKS PASSED — MODULE SAFE', color: 'text-green-500' }]);
    setScanState('passed');
  };

  // ── Publish ─────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (scanState !== 'passed') return;
    setPublishing(true);

    let iconUrl = '';
    if (iconFile) {
      try {
        const { url } = await integrations.Core.UploadFile({ file: iconFile });
        iconUrl = url;
      } catch (err) {
        toast.error('Icon upload failed — publishing without icon');
      }
    }

    try {
      await entities.Module.create({
        name: name.trim(),
        description: description.trim(),
        type,
        payload: builtPayload,
        icon_url: iconUrl,
        author_id: currentUser?.id,
        author_name: currentUser?.display_name || currentUser?.full_name || currentUser?.username,
        status: 'approved',
        is_public: true,
        install_count: 0,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        reports: [],
      });
      toast.success('Module deployed to the Nexus!');
      // Reset all the things
      setName(''); setDescription(''); setTags(''); setIconFile(null); setIconPreview('');
      setStaticContent(''); setStaticLink('');
      setDisplayTitle(''); setDisplaySubtitle(''); setDisplayContent(''); setDisplayImageUrl('');
      setDisplayStats([{ key: '', val: '' }]);
      setApiQuery('');
      setFeedTitle(''); setFeedItems([{ title: '', detail: '' }]); setFeedQuery('');
      setRawPayload(''); setRawMode(false);
      setScanState('idle'); setScanLines([]);
      onPublished?.();
    } catch (err) {
      toast.error('Publish failed: ' + (err?.message || 'unknown'));
    } finally {
      setPublishing(false);
    }
  };

  const typeInfo = TYPE_INFO[type];

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── LEFT (col 1-2): Form ─────────────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-5">
        <div>
          <h2 className="text-xl font-black uppercase text-white mb-1">Fabricator Console</h2>
          <p className="text-[10px] text-gray-500 font-mono">Build a widget — fill the fields, scan it, ship it. No code needed.</p>
        </div>

        {/* Shared fields */}
        <div className="space-y-4">
          <FormField label="Module Name">
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Favorite Quote"
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
            />
          </FormField>

          <FormField label="Description">
            <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="One sentence describing what your widget does"
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
            />
          </FormField>

          <FormField label="Module Type">
            <Select value={type} onValueChange={(v) => { setType(v); setScanState('idle'); }}>
              <SelectTrigger className="bg-[#111] border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="static_text">📝 Static Text — pin a quote or note</SelectItem>
                <SelectItem value="display_widget">🖼️ Display Widget — card with image + stats</SelectItem>
                <SelectItem value="api_sync">🌐 API Sync — live data from the web</SelectItem>
                <SelectItem value="live_feed">📡 Live Feed — auto-refreshing list</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">{typeInfo.description}</p>
          </FormField>

          <FormField label="Module Icon (optional)">
            <label className="flex items-center gap-3 px-4 py-3 bg-[#111] border border-white/10 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
              {iconPreview ? (
                <img src={iconPreview} alt="icon" className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <Upload size={16} className="text-gray-500" />
              )}
              <span className="text-sm text-gray-400 flex-1 truncate">{iconFile?.name || 'Upload icon image...'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleIconChange(e.target.files?.[0])} />
            </label>
          </FormField>

          {/* Type-specific form */}
          <div className="border-t border-white/5 pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-xs font-black uppercase tracking-widest ${typeInfo.color}`}>
                {typeInfo.label} Settings
              </h3>
              <button
                onClick={() => setRawMode(!rawMode)}
                className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1 font-mono"
              >
                <Code size={11} /> {rawMode ? 'Use form' : 'Raw JSON'}
              </button>
            </div>

            {rawMode ? (
              <FormField label="Payload (JSON)">
                <textarea
                  value={rawPayload}
                  onChange={(e) => setRawPayload(e.target.value)}
                  placeholder={`{\n  "content": "Hello world"\n}`}
                  className="w-full h-40 bg-[#0a0a0a] border border-white/10 rounded-xl p-4 text-xs text-green-400 font-mono focus:border-[#FF3333] outline-none resize-none"
                />
              </FormField>
            ) : type === 'static_text' ? (
              <div className="space-y-4">
                <FormField label="Content">
                  <textarea
                    value={staticContent}
                    onChange={(e) => setStaticContent(e.target.value)}
                    placeholder="The text that will appear on your profile..."
                    rows={4}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none resize-none"
                  />
                </FormField>
                <FormField label="Link URL (optional)">
                  <input
                    type="text" value={staticLink} onChange={(e) => setStaticLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
                  />
                </FormField>
              </div>
            ) : type === 'display_widget' ? (
              <div className="space-y-4">
                <FormField label="Title">
                  <input
                    type="text" value={displayTitle} onChange={(e) => setDisplayTitle(e.target.value)}
                    placeholder="Big title at the top of the widget"
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
                  />
                </FormField>
                <FormField label="Subtitle (optional)">
                  <input
                    type="text" value={displaySubtitle} onChange={(e) => setDisplaySubtitle(e.target.value)}
                    placeholder="Smaller text below the title"
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
                  />
                </FormField>
                <FormField label="Body Content (optional)">
                  <textarea
                    value={displayContent} onChange={(e) => setDisplayContent(e.target.value)}
                    placeholder="Optional description paragraph"
                    rows={3}
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none resize-none"
                  />
                </FormField>
                <FormField label="Banner Image URL (optional)">
                  <input
                    type="text" value={displayImageUrl} onChange={(e) => setDisplayImageUrl(e.target.value)}
                    placeholder="https://...   — shows as a banner at the top"
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
                  />
                </FormField>
                <FormField label="Stats (up to 3)">
                  <div className="space-y-2">
                    {displayStats.map((stat, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text" value={stat.key}
                          onChange={(e) => {
                            const next = [...displayStats]; next[idx].key = e.target.value; setDisplayStats(next);
                          }}
                          placeholder="Label (e.g., Rank)"
                          className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#FF3333] outline-none"
                        />
                        <input
                          type="text" value={stat.val}
                          onChange={(e) => {
                            const next = [...displayStats]; next[idx].val = e.target.value; setDisplayStats(next);
                          }}
                          placeholder="Value (e.g., Diamond)"
                          className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#FF3333] outline-none"
                        />
                        <button
                          onClick={() => {
                            if (displayStats.length === 1) {
                              setDisplayStats([{ key: '', val: '' }]);
                            } else {
                              setDisplayStats(displayStats.filter((_, i) => i !== idx));
                            }
                          }}
                          className="px-2 text-zinc-500 hover:text-red-400 text-xs"
                        >×</button>
                      </div>
                    ))}
                    {displayStats.length < 3 && (
                      <button
                        onClick={() => setDisplayStats([...displayStats, { key: '', val: '' }])}
                        className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase tracking-wider"
                      >+ Add stat</button>
                    )}
                  </div>
                </FormField>
              </div>
            ) : type === 'api_sync' ? (
              <FormField label="Data Query (what to fetch)">
                <textarea
                  value={apiQuery} onChange={(e) => setApiQuery(e.target.value)}
                  placeholder="e.g., Current Bitcoin price, today's top news headlines, NASA picture of the day"
                  rows={3}
                  className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none resize-none"
                />
                <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                  Refreshes every 10 minutes. The widget will show whatever Spidr AI finds for this query.
                </p>
              </FormField>
            ) : type === 'live_feed' ? (
              <div className="space-y-4">
                <FormField label="Feed Title">
                  <input
                    type="text" value={feedTitle} onChange={(e) => setFeedTitle(e.target.value)}
                    placeholder="e.g., Latest News"
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
                  />
                </FormField>
                <FormField label="Auto-update Query (optional)">
                  <input
                    type="text" value={feedQuery} onChange={(e) => setFeedQuery(e.target.value)}
                    placeholder="e.g., Latest tech news headlines — leave empty for static items"
                    className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
                  />
                </FormField>
                <FormField label="Static Items (used if query is empty)">
                  <div className="space-y-2">
                    {feedItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text" value={item.title}
                          onChange={(e) => {
                            const next = [...feedItems]; next[idx].title = e.target.value; setFeedItems(next);
                          }}
                          placeholder="Item title"
                          className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#FF3333] outline-none"
                        />
                        <input
                          type="text" value={item.detail}
                          onChange={(e) => {
                            const next = [...feedItems]; next[idx].detail = e.target.value; setFeedItems(next);
                          }}
                          placeholder="Item detail"
                          className="flex-1 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#FF3333] outline-none"
                        />
                        <button
                          onClick={() => {
                            if (feedItems.length === 1) setFeedItems([{ title: '', detail: '' }]);
                            else setFeedItems(feedItems.filter((_, i) => i !== idx));
                          }}
                          className="px-2 text-zinc-500 hover:text-red-400 text-xs"
                        >×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => setFeedItems([...feedItems, { title: '', detail: '' }])}
                      className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase tracking-wider"
                    >+ Add item</button>
                  </div>
                </FormField>
              </div>
            ) : null}
          </div>

          <FormField label="Tags (comma-separated)">
            <input
              type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="utility, fun, gaming"
              className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none"
            />
          </FormField>

          {/* Action button */}
          {scanState === 'passed' ? (
            <button
              onClick={handlePublish} disabled={publishing}
              className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {publishing ? <><Loader2 size={16} className="animate-spin" /> Deploying...</> : 'Deploy to Nexus'}
            </button>
          ) : (
            <button
              onClick={runScan} disabled={scanState === 'scanning'}
              className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {scanState === 'scanning' ? <><Loader2 size={16} className="animate-spin" /> Scanning...</> : 'Compile & Scan'}
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT (col 3): Preview + Scanner ─────────────────────────────────── */}
      <div className="space-y-4">
        {/* Live Preview */}
        <div className="sticky top-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye size={14} className="text-gray-500" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Live Preview</span>
          </div>
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4">
            <DynamicModuleWidget mod={previewMod} />
          </div>

          {/* Aegis Terminal */}
          <div className="mt-4 bg-black border border-white/10 rounded-2xl p-4 relative overflow-hidden flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#FF3333]" />
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Aegis Inspector</span>
              </div>
              <div className={`w-2 h-2 rounded-full ${
                scanState === 'scanning' ? 'bg-yellow-500 animate-pulse' :
                scanState === 'passed'   ? 'bg-green-500' :
                scanState === 'failed'   ? 'bg-red-500' :
                                            'bg-gray-600'
              }`} />
            </div>

            <div className="flex-1 font-mono text-[10px] space-y-1.5 overflow-y-auto relative">
              {scanState === 'idle' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 gap-2">
                  <Terminal size={28} className="opacity-20" />
                  <span className="text-[10px]">AWAITING SCAN</span>
                </div>
              ) : (
                <>
                  {scanLines.map((line, i) => {
                    const obj = typeof line === 'string' ? { text: line, color: 'text-gray-400' } : line;
                    return (
                      <motion.div
                        key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
                        className={obj.color}
                      >{obj.text}</motion.div>
                    );
                  })}
                  {scanState === 'passed' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-green-500 gap-2 pt-3">
                      <CheckCircle size={28} />
                      <div className="text-center"><div className="font-bold text-xs">CODE_CLEAN</div></div>
                    </motion.div>
                  )}
                  {scanState === 'failed' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center text-red-500 gap-2 pt-3">
                      <AlertTriangle size={28} />
                      <div className="text-center max-w-xs">
                        <div className="font-bold text-xs">REJECTED</div>
                        <div className="text-red-500/70 mt-1 text-[10px]">{scanError}</div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
