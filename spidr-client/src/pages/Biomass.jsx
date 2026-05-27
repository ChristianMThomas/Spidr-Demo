import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { biomass as biomassApi } from '@/api/apiClient';
import { toast } from 'sonner';
import { Zap, Sparkles, ShoppingBag, Clock, Check, Lock } from 'lucide-react';

/**
 * /biomass — wallet, shop, and transaction history for the in-app currency.
 *
 * Three panels, switchable via tabs:
 *   • Wallet — balance, daily claim, lifetime earned
 *   • Shop   — purchasable items grouped by category
 *   • History — last 50 transactions
 *
 * The wallet auto-creates server-side on first fetch, so we don't need to
 * pre-provision anything from the client.
 */
const CATEGORY_LABELS = {
  username: 'Username Effects',
  profile:  'Profile Themes',
  badge:    'Badges',
};

export default function BiomassPage() {
  const [activeTab, setActiveTab] = useState('wallet');
  const queryClient = useQueryClient();

  const { data: wallet } = useQuery({
    queryKey: ['biomass-wallet'],
    queryFn: () => biomassApi.wallet().catch(() => null),
    staleTime: 15_000,
  });

  const { data: shopData } = useQuery({
    queryKey: ['biomass-shop'],
    queryFn: () => biomassApi.shop().catch(() => ({ items: [] })),
    staleTime: 300_000, // shop is static for now
  });
  const shop = shopData?.items || [];

  const claimDaily = useMutation({
    mutationFn: () => biomassApi.claimDaily(),
    onSuccess: (data) => {
      toast.success(`+${data.amount} biomass — see you tomorrow!`);
      queryClient.invalidateQueries({ queryKey: ['biomass-wallet'] });
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err?.message || 'Could not claim';
      const hours = err?.response?.data?.hoursLeft;
      toast.error(hours ? `${msg} — try again in ${hours}h` : msg);
    },
  });

  const buyItem = useMutation({
    mutationFn: (itemId) => biomassApi.buy(itemId),
    onSuccess: (data) => {
      toast.success(`${data.item.name} unlocked!`);
      queryClient.invalidateQueries({ queryKey: ['biomass-wallet'] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Purchase failed');
    },
  });

  // Inventory comes back as a plain object from the API (Mongoose Map → JSON).
  // Items the user already owns get a check-icon disabled state.
  const inventory = wallet?.inventory || {};
  const ownedSet = new Set(Object.keys(inventory));

  const balance = wallet?.balance ?? 0;
  const lifetime = wallet?.lifetime_earned ?? 0;
  const claimable = !wallet?.last_daily_claim
    || (Date.now() - new Date(wallet.last_daily_claim).getTime()) >= 22 * 60 * 60 * 1000;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black/40 backdrop-blur-sm">
      {/* Header */}
      <div className="px-6 md:px-10 py-6 border-b border-white/5 bg-gradient-to-r from-yellow-900/20 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-7 h-7 text-yellow-400 fill-yellow-400" />
          <h1 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white">
            Biomass
          </h1>
        </div>
        <p className="text-zinc-500 text-sm">Earn it. Spend it. Glow with it.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 px-6 md:px-10 bg-[#050505]">
        {['wallet', 'shop', 'history'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`py-3 px-5 text-[10px] font-black uppercase tracking-widest transition-colors relative ${
              activeTab === t ? 'text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'wallet' && <span className="flex items-center gap-2"><Sparkles className="w-3 h-3" /> Wallet</span>}
            {t === 'shop'   && <span className="flex items-center gap-2"><ShoppingBag className="w-3 h-3" /> Shop</span>}
            {t === 'history'&& <span className="flex items-center gap-2"><Clock className="w-3 h-3" /> History</span>}
            {activeTab === t && (
              <motion.div
                layoutId="biomass-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'wallet' && (
            <motion.div key="wallet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl space-y-5">
              {/* Big balance card */}
              <div className="relative rounded-2xl overflow-hidden border border-yellow-500/30 bg-gradient-to-br from-yellow-900/30 via-zinc-900 to-zinc-900 p-6 md:p-8">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
                <p className="text-yellow-400/70 text-xs font-bold uppercase tracking-widest mb-1">Current Balance</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl md:text-6xl font-black text-white tracking-tight">{balance.toLocaleString()}</span>
                  <Zap className="w-7 h-7 text-yellow-400 fill-yellow-400" />
                </div>
                <p className="text-zinc-500 text-xs mt-3">Lifetime earned: <span className="text-yellow-400">{lifetime.toLocaleString()}</span></p>
              </div>

              {/* Daily claim card */}
              <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-bold">Daily Login Bonus</p>
                    <p className="text-zinc-500 text-xs mt-1">Claim 50 biomass once every 24 hours.</p>
                  </div>
                  <button
                    onClick={() => claimDaily.mutate()}
                    disabled={!claimable || claimDaily.isPending}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                      claimable
                        ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.4)]'
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    {claimable ? '+50 Claim' : 'Claimed today'}
                  </button>
                </div>
              </div>

              {/* How to earn */}
              <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-5">
                <p className="text-white font-bold mb-3">How to earn more</p>
                <ul className="text-zinc-400 text-sm space-y-2">
                  <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-yellow-400" /> 1 biomass per message (cap 50/day)</li>
                  <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-yellow-400" /> 100 biomass per clip you post on THE WEB (cap 200/day)</li>
                  <li className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-yellow-400" /> 50 biomass daily login</li>
                </ul>
              </div>
            </motion.div>
          )}

          {activeTab === 'shop' && (
            <motion.div key="shop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                const items = shop.filter(it => it.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="mb-8">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">{label}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map((item) => {
                        const owned = ownedSet.has(item.id);
                        const canAfford = balance >= item.price;
                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl border p-4 transition-colors ${
                              owned
                                ? 'border-green-500/30 bg-green-900/10'
                                : 'border-white/10 bg-zinc-900/50 hover:border-yellow-500/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-white font-bold text-sm">{item.name}</p>
                              {owned && <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />}
                            </div>
                            <p className="text-zinc-500 text-xs mb-4 leading-relaxed">{item.description}</p>
                            <button
                              onClick={() => buyItem.mutate(item.id)}
                              disabled={owned || !canAfford || buyItem.isPending}
                              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                owned
                                  ? 'bg-green-500/15 text-green-400 cursor-default'
                                  : canAfford
                                    ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                              }`}
                            >
                              {owned ? (
                                'Owned'
                              ) : !canAfford ? (
                                <><Lock className="w-3.5 h-3.5" /> {item.price.toLocaleString()}</>
                              ) : (
                                <><Zap className="w-3.5 h-3.5 fill-current" /> {item.price.toLocaleString()}</>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {shop.length === 0 && (
                <p className="text-zinc-500 text-sm">No shop items available yet.</p>
              )}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="max-w-3xl">
              {wallet?.transactions?.length ? (
                <div className="space-y-1">
                  {wallet.transactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-zinc-900/60 border border-white/5">
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{tx.reason || 'Activity'}</p>
                        <p className="text-zinc-500 text-[10px] font-mono">{new Date(tx.created_date).toLocaleString()}</p>
                      </div>
                      <span className={`font-bold text-sm whitespace-nowrap ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">No transactions yet. Claim your daily bonus to get started.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
