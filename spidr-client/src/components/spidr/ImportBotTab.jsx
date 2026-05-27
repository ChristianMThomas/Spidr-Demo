import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe, ShieldCheck, Zap, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';


export default function ImportBotTab({ currentUser }) {
  const [clientId, setClientId] = useState('');
  const [botName, setBotName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async () => {
      setIsImporting(true);
      
      // Create the bot record
      const bot = await entities.CustomBot.create({
        name: botName || `Discord Bot ${clientId.slice(0, 6)}`,
        description: `Imported from Discord (Client ID: ${clientId})`,
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.username,
        source: 'discord_import',
        discord_client_id: clientId,
        status: 'scanning'
      });

      // Run AI safety scan
      const result = await integrations.Core.InvokeLLM({
        prompt: `You are a security AI. A user is trying to import a Discord bot into the Spidr platform.
Bot Name: "${botName || 'Unknown'}"
Discord Client ID: "${clientId}"

Evaluate if this bot import request seems legitimate and safe:
1. Is the client ID format valid (should be a numeric string)?
2. Does the bot name contain offensive or harmful content?
3. Are there any red flags?

Be reasonable — most Discord bots are safe.`,
        response_json_schema: {
          type: 'object',
          properties: {
            is_safe: { type: 'boolean' },
            report: { type: 'string' },
            risk_level: { type: 'string', enum: ['low', 'medium', 'high'] }
          }
        }
      });

      const status = result.is_safe ? 'verified' : 'flagged';
      await entities.CustomBot.update(bot.id, {
        status,
        scan_report: result.report
      });

      return { status, report: result.report };
    },
    onSuccess: (data) => {
      setIsImporting(false);
      queryClient.invalidateQueries({ queryKey: ['my-bots'] });
      setClientId('');
      setBotName('');
      if (data.status === 'verified') {
        toast.success('Bot imported and verified!');
      } else {
        toast.error('Bot flagged during safety scan');
      }
    },
    onError: () => {
      setIsImporting(false);
      toast.error('Import failed');
    }
  });

  return (
    <div className="space-y-8">
      {/* Import Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-800/50 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[80px] rounded-full pointer-events-none" />

        <div className="flex items-center gap-4 mb-6 relative">
          <div className="w-12 h-12 bg-[#5865F2] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Globe className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Import from Discord</h2>
            <p className="text-xs text-zinc-400">Bridge existing bots from Discord's ecosystem into Spidr</p>
          </div>
        </div>

        <div className="space-y-4 relative">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Bot Name</label>
            <Input
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g. Music Bot"
              className="bg-black/50 border-zinc-600 text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase">Discord Client ID / Application ID</label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="847382910..."
              className="bg-black/50 border-zinc-600 text-white font-mono"
            />
          </div>

          <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex gap-3">
            <ShieldCheck className="text-yellow-500 flex-shrink-0 mt-0.5" size={16} />
            <div className="text-[11px] text-zinc-400">
              <strong className="text-yellow-500">Safety Scan Required</strong> — Imported bots undergo AI security analysis before receiving Spidr API access.
            </div>
          </div>

          <Button
            onClick={() => importMutation.mutate()}
            disabled={!clientId.trim() || !botName.trim() || isImporting}
            className="w-full py-3 bg-[#5865F2] hover:bg-indigo-500 text-white font-bold"
          >
            {isImporting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Scanning & Importing...
              </>
            ) : (
              <>
                <Zap size={16} className="mr-2" />
                Initiate Transfer
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
