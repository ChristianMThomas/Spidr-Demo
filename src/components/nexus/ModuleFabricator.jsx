import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Terminal, CheckCircle, AlertTriangle, Code, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SCAN_LINES = [
  { text: '> INITIALIZING AEGIS CODE SCANNER...', color: 'text-white', delay: 0 },
  { text: '> PARSING MODULE PAYLOAD...', color: 'text-gray-400', delay: 400 },
  { text: '> CHECKING FOR <script> INJECTION (XSS)...', color: 'text-gray-400', delay: 800 },
  { text: '> SCANNING TEXT CONTENT FOR VIOLATIONS...', color: 'text-gray-400', delay: 1200 },
  { text: '> RUNNING NLP PROFANITY FILTER...', color: 'text-gray-500', delay: 1600 },
  { text: '> EVALUATING URL ENDPOINTS...', color: 'text-gray-500', delay: 2000 },
];

export default function ModuleFabricator({ currentUser, onPublished }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('static_text');
  const [payload, setPayload] = useState('');
  const [tags, setTags] = useState('');
  const [iconFile, setIconFile] = useState(null);
  const [scanState, setScanState] = useState('idle'); // idle, scanning, passed, failed
  const [scanError, setScanError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [scanLines, setScanLines] = useState([]);

  const runScan = async () => {
    if (!name.trim()) { toast.error('Module name is required'); return; }

    setScanState('scanning');
    setScanError('');
    setScanLines([]);

    // Animate scan lines
    for (let i = 0; i < SCAN_LINES.length; i++) {
      await new Promise(r => setTimeout(r, SCAN_LINES[i].delay ? 400 : 0));
      setScanLines(prev => [...prev, SCAN_LINES[i]]);
    }

    // Actual content moderation via LLM
    const contentToCheck = `Module Name: ${name}\nDescription: ${description}\nPayload: ${payload}\nTags: ${tags}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a content safety scanner. Analyze the following user-submitted module content for a social platform. Check for:
1. Profanity, slurs, hate speech, or offensive language
2. XSS attacks (<script> tags, javascript: URLs, event handlers like onclick/onerror)
3. Inappropriate sexual content
4. Violence promotion or threats
5. Personal information (doxxing)
6. Spam or scam content
7. Malicious URLs or suspicious links

Content to analyze:
${contentToCheck}

Be strict but fair. Legitimate technical content is fine. Only flag genuinely harmful content.`,
      response_json_schema: {
        type: 'object',
        properties: {
          is_safe: { type: 'boolean' },
          reason: { type: 'string' },
          severity: { type: 'string', enum: ['none', 'low', 'medium', 'high'] }
        }
      }
    });

    await new Promise(r => setTimeout(r, 500));

    if (result.is_safe) {
      setScanLines(prev => [...prev, { text: '> ALL CHECKS PASSED — MODULE SAFE', color: 'text-green-500', delay: 0 }]);
      setScanState('passed');
    } else {
      setScanLines(prev => [...prev, { text: `> VIOLATION DETECTED: ${result.reason}`, color: 'text-red-500', delay: 0 }]);
      setScanState('failed');
      setScanError(result.reason);
    }
  };

  const handlePublish = async () => {
    if (scanState !== 'passed') return;
    setPublishing(true);

    let iconUrl = '';
    if (iconFile) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: iconFile });
      iconUrl = file_url;
    }

    await base44.entities.Module.create({
      name: name.trim(),
      description: description.trim(),
      type,
      payload: payload.trim(),
      icon_url: iconUrl,
      author_id: currentUser?.id,
      author_name: currentUser?.display_name || currentUser?.full_name || currentUser?.email,
      status: 'approved',
      install_count: 0,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      reports: [],
    });

    toast.success('Module deployed to the Nexus!');
    setPublishing(false);
    setName(''); setDescription(''); setPayload(''); setTags(''); setIconFile(null);
    setScanState('idle'); setScanLines([]);
    onPublished?.();
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: Builder Form */}
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-black uppercase text-white mb-1">Fabricator Console</h2>
          <p className="text-[10px] text-gray-500 font-mono">Build custom telemetry widgets for the community.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Module Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Live_Weather_Hex" className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this module do?" className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Module Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-[#111] border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="static_text">Static Text</SelectItem>
                <SelectItem value="display_widget">Display Widget</SelectItem>
                <SelectItem value="api_sync">API Sync</SelectItem>
                <SelectItem value="live_feed">Live Feed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Module Icon</label>
            <label className="flex items-center gap-2 px-4 py-3 bg-[#111] border border-white/10 rounded-xl cursor-pointer hover:border-white/20 transition-colors">
              <Upload size={14} className="text-gray-500" />
              <span className="text-sm text-gray-400">{iconFile ? iconFile.name : 'Upload icon image...'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setIconFile(e.target.files?.[0])} />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center justify-between">
              <span>Data Payload / Config</span>
              <span className="text-blue-500 flex items-center gap-1"><Code size={12} /> Editor</span>
            </label>
            <textarea value={payload} onChange={(e) => setPayload(e.target.value)} placeholder={`{\n  "type": "static",\n  "content": "Enter safe text here..."\n}`} className="w-full h-40 bg-[#0a0a0a] border border-white/10 rounded-xl p-4 text-xs text-green-400 font-mono focus:border-[#FF3333] outline-none resize-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Tags (comma separated)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="utility, weather, fun" className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FF3333] outline-none" />
          </div>

          {scanState === 'passed' ? (
            <button onClick={handlePublish} disabled={publishing} className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {publishing ? <><Loader2 size={16} className="animate-spin" /> Deploying...</> : 'Deploy to Nexus'}
            </button>
          ) : (
            <button onClick={runScan} disabled={scanState === 'scanning'} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {scanState === 'scanning' ? <><Loader2 size={16} className="animate-spin" /> Scanning...</> : 'Compile & Scan'}
            </button>
          )}
        </div>
      </div>

      {/* Right: Aegis Terminal */}
      <div className="bg-black border border-white/10 rounded-2xl p-6 relative overflow-hidden flex flex-col min-h-[500px]">
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#FF3333]" />
            <span className="text-xs font-mono text-gray-400">AEGIS_SYNTAX_INSPECTOR</span>
          </div>
          <div className="flex gap-1">
            <div className={`w-2 h-2 rounded-full ${scanState === 'scanning' ? 'bg-yellow-500 animate-pulse' : scanState === 'passed' ? 'bg-green-500' : scanState === 'failed' ? 'bg-red-500' : 'bg-gray-600'}`} />
          </div>
        </div>

        <div className="flex-1 font-mono text-[11px] space-y-1.5 overflow-y-auto relative">
          {scanState === 'idle' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 gap-3">
              <Terminal size={48} className="opacity-20" />
              <span className="text-xs">AWAITING PAYLOAD COMPILATION...</span>
            </div>
          ) : (
            <>
              {scanLines.map((line, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className={line.color}>{line.text}</motion.div>
              ))}
              {scanState === 'passed' && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center text-green-500 gap-3 pt-8">
                  <CheckCircle size={48} />
                  <div className="text-center">
                    <div className="font-bold text-sm">CODE_CLEAN</div>
                    <div className="text-green-500/60 mt-1 text-[10px]">No malicious payloads or inappropriate content detected.</div>
                  </div>
                </motion.div>
              )}
              {scanState === 'failed' && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center text-red-500 gap-3 pt-8">
                  <AlertTriangle size={48} />
                  <div className="text-center">
                    <div className="font-bold text-sm">COMPILATION_REJECTED</div>
                    <div className="text-red-500/60 mt-1 text-[10px] max-w-xs">{scanError}</div>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {scanState === 'scanning' && (
            <motion.div initial={{ top: 0 }} animate={{ top: '100%' }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }} className="absolute left-0 right-0 h-1 bg-[#FF3333] shadow-[0_0_20px_#FF3333]" />
          )}
        </div>
      </div>
    </div>
  );
}