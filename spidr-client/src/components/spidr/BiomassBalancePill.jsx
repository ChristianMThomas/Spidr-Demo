import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { biomass as biomassApi } from '@/api/apiClient';
import { Zap } from 'lucide-react';

/**
 * BiomassBalancePill — compact balance display visible in the global shell.
 *
 * Lives next to the profile chip in the top-right. Click navigates to the
 * full biomass page. Fades in once the wallet is loaded; refetches every
 * 60s so it stays roughly current.
 */
export default function BiomassBalancePill() {
  const navigate = useNavigate();
  const { data: wallet } = useQuery({
    queryKey: ['biomass-wallet'],
    queryFn: () => biomassApi.wallet().catch(() => null),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!wallet) return null;
  const balance = wallet.balance ?? 0;

  // Format compact for big numbers — 1.2k, 15.4k, etc.
  const formatted = balance >= 10_000
    ? `${(balance / 1000).toFixed(1).replace(/\.0$/, '')}k`
    : balance.toLocaleString();

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => navigate('/biomass')}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-yellow-500/30 hover:border-yellow-400 transition-colors text-xs font-bold text-yellow-400"
      title={`${balance.toLocaleString()} biomass`}
    >
      <Zap className="w-3.5 h-3.5 fill-yellow-400" />
      <span>{formatted}</span>
    </motion.button>
  );
}
