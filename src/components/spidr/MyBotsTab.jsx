import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, ShieldCheck, ShieldAlert, Loader2, CheckCircle, 
  Trash2, Eye, EyeOff, Terminal, Upload
} from 'lucide-react';
import { toast } from 'sonner';

function StatusBadge({ status }) {
  const config = {
    pending_scan: { color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30', icon: Loader2, text: 'PENDING SCAN', spin: false },
    scanning: { color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: Loader2, text: 'SCANNING...', spin: true },
    verified: { color: 'text-green-500 bg-green-500/10 border-green-500/30', icon: CheckCircle, text: 'VERIFIED', spin: false },
    flagged: { color: 'text-red-500 bg-red-500/10 border-red-500/30', icon: ShieldAlert, text: 'FLAGGED', spin: false },
    rejected: { color: 'text-red-600 bg-red-600/10 border-red-600/30', icon: ShieldAlert, text: 'REJECTED', spin: false },
  }[status] || { color: 'text-gray-500', icon: Loader2, text: 'UNKNOWN', spin: false };

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${config.color}`}>
      <Icon size={10} className={config.spin ? 'animate-spin' : ''} />
      {config.text}
    </span>
  );
}

export default function MyBotsTab({ currentUser }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', prefix: '!', capabilities: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [scanning, setScanning] = useState(null);
  const queryClient = useQueryClient();

  const { data: myBots = [], isLoading } = useQuery({
    queryKey: ['my-bots', currentUser?.id],
    queryFn: () => base44.entities.CustomBot.filter({ author_id: currentUser?.id }),
    enabled: !!currentUser?.id
  });

  const createBotMutation = useMutation({
    mutationFn: async (botData) => {
      let avatar_url = '';
      if (avatarFile) {
        const result = await base44.integrations.Core.UploadFile({ file: avatarFile });
        avatar_url = result.file_url;
      }
      return base44.entities.CustomBot.create({
        ...botData,
        avatar_url,
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.email,
        status: 'pending_scan',
        capabilities: botData.capabilities.split(',').map(c => c.trim()).filter(Boolean)
      });
    },
    onSuccess: (newBot) => {
      queryClient.invalidateQueries(['my-bots']);
      setShowCreate(false);
      setForm({ name: '', description: '', prefix: '!', capabilities: '' });
      setAvatarFile(null);
      toast.success('Bot created! Running safety scan...');
      runSafetyScan(newBot.id, newBot.name, newBot.description);
    }
  });

  const deleteBotMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomBot.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-bots']);
      toast.success('Bot deleted');
    }
  });

  const runSafetyScan = async (botId, name, description) => {
    setScanning(botId);
    await base44.entities.CustomBot.update(botId, { status: 'scanning' });
    queryClient.invalidateQueries(['my-bots']);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a security AI reviewing a user-submitted bot for a social platform called Spidr (similar to Discord). 
Analyze this bot submission for safety concerns:
- Bot Name: "${name}"
- Description: "${description}"

Check for:
1. Harmful or offensive content in the name/description
2. Potential for spam, phishing, or malicious behavior
3. Inappropriate or NSFW themes
4. Impersonation of official system bots

Return your analysis.`,
      response_json_schema: {
        type: 'object',
        properties: {
          is_safe: { type: 'boolean' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          report: { type: 'string' },
          flags: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    const newStatus = result.is_safe ? 'verified' : (result.risk_level === 'high' ? 'rejected' : 'flagged');
    await base44.entities.CustomBot.update(botId, {
      status: newStatus,
      scan_report: result.report
    });
    queryClient.invalidateQueries(['my-bots']);
    setScanning(null);

    if (newStatus === 'verified') {
      toast.success('Bot passed safety scan!');
    } else {
      toast.error(`Bot ${newStatus}: ${result.flags?.[0] || result.report}`);
    }
  };

  const togglePublic = async (bot) => {
    if (bot.status !== 'verified') {
      toast.error('Only verified bots can be made public');
      return;
    }
    await base44.entities.CustomBot.update(bot.id, { is_public: !bot.is_public });
    queryClient.invalidateQueries(['my-bots']);
    toast.success(bot.is_public ? 'Bot set to private' : 'Bot is now public!');
  };

  return (
    <div className="space-y-6">
      {/* Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">My Creations</h3>
          <p className="text-xs text-zinc-500">{myBots.length} bot{myBots.length !== 1 ? 's' : ''} fabricated</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="bg-white text-black hover:bg-gray-200 font-bold">
          <Plus className="w-4 h-4 mr-2" />
          Fabricate New
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Terminal size={18} className="text-[#FF3333]" />
                <span className="text-sm font-bold text-white uppercase tracking-wider">Unit Fabrication</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Unit Name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Music_Viper_v2"
                    className="bg-black/50 border-zinc-600 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Prefix Trigger</label>
                  <Input
                    value={form.prefix}
                    onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                    placeholder="!"
                    className="bg-black/50 border-zinc-600 text-white w-24"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Description</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does your bot do?"
                  className="bg-black/50 border-zinc-600 text-white h-20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase">Capabilities (comma-separated)</label>
                <Input
                  value={form.capabilities}
                  onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
                  placeholder="music, moderation, games"
                  className="bg-black/50 border-zinc-600 text-white"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-400 hover:text-white transition-colors">
                  <Upload size={16} />
                  {avatarFile ? avatarFile.name : 'Upload Avatar'}
                  <input type="file" hidden accept="image/*" onChange={(e) => setAvatarFile(e.target.files[0])} />
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-2 text-[10px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex-1">
                  <ShieldCheck size={14} />
                  <span>AI safety scan will run automatically after creation</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => createBotMutation.mutate(form)}
                  disabled={!form.name.trim() || createBotMutation.isPending}
                  className="bg-[#FF3333] hover:bg-red-700 font-bold flex-1"
                >
                  {createBotMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Compile & Deploy
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-600">
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bot Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      ) : myBots.length === 0 && !showCreate ? (
        <div className="text-center py-16 border-2 border-dashed border-zinc-800 rounded-2xl">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-zinc-500 text-sm">No bots yet. Fabricate your first unit!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myBots.map((bot) => (
            <motion.div
              key={bot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl p-5 hover:border-zinc-600 transition-colors relative group"
            >
              <div className="absolute top-4 right-4">
                <StatusBadge status={scanning === bot.id ? 'scanning' : bot.status} />
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-black border border-zinc-700 overflow-hidden flex items-center justify-center">
                  {bot.avatar_url ? (
                    <img src={bot.avatar_url} className="w-full h-full object-cover" alt={bot.name} />
                  ) : (
                    <span className="text-2xl">🤖</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-white font-bold truncate">{bot.name}</h4>
                  <p className="text-[10px] text-zinc-500">{bot.source === 'discord_import' ? '🌐 Discord Import' : '🔧 Custom'} • {bot.installs || 0} installs</p>
                </div>
              </div>

              {bot.description && (
                <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{bot.description}</p>
              )}

              {bot.scan_report && (
                <div className={`text-[10px] p-2 rounded-lg mb-3 ${
                  bot.status === 'verified' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                  'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {bot.scan_report.slice(0, 120)}...
                </div>
              )}

              <div className="flex gap-2 mt-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => togglePublic(bot)}
                  className="text-xs text-zinc-400 hover:text-white flex-1"
                >
                  {bot.is_public ? <EyeOff size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />}
                  {bot.is_public ? 'Unlist' : 'Publish'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm('Delete this bot?')) deleteBotMutation.mutate(bot.id);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}