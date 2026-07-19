import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Crown, X, Check, Loader2, ExternalLink, Sparkles
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { entities, auth, payments } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const MONTHLY_PRICE = 7.99;
const YEARLY_PRICE  = 69.99;
const YEARLY_MO_EQUIV = (YEARLY_PRICE / 12).toFixed(2);
const YEARLY_SAVINGS_PCT = Math.round((1 - (YEARLY_PRICE / (MONTHLY_PRICE * 12))) * 100);

export default function ApexCommand({ isOpen, onClose, currentTier = 'free', currentUser, profile }) {
  const [planType,   setPlanType]   = useState('monthly');
  const [step,       setStep]       = useState(currentTier === 'apex' ? 'manage' : 'choose'); // 'choose' | 'manage'
  const [processing, setProcessing] = useState(false);
  const queryClient = useQueryClient();

  // Resolve the profile if the caller didn't pass one — we need
  // apex_first_activated_at to decide whether to show the "First month free"
  // trial hint on the choose step, and stripe_current_period_end for the
  // manage step's next-billing row.
  const [resolvedProfile, setResolvedProfile] = useState(profile || null);
  useEffect(() => { if (profile) setResolvedProfile(profile); }, [profile]);

  useEffect(() => {
    if (!isOpen || resolvedProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const me = currentUser || await auth.me();
        if (!me?.id) return;
        const rows = await entities.UserProfile.filter({ user_id: me.id });
        if (!cancelled && rows?.[0]) setResolvedProfile(rows[0]);
      } catch { /* leave null — UI still works without trial hint */ }
    })();
    return () => { cancelled = true; };
  }, [isOpen, currentUser, resolvedProfile]);

  // Return-from-Checkout refresh — Stripe Checkout opens in a new tab / system
  // browser, so we won't know the moment the webhook flips apex_tier. When the
  // user comes back to the app (window focus fires), invalidate every profile
  // query so the APEX badge, tab, and features unlock without a manual reload.
  useEffect(() => {
    if (!isOpen) return;
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', resolvedProfile?.user_id] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['profiles-for-chat'] });
    };
    window.addEventListener('focus', invalidate);
    // Electron packaged app fires window:focus via preload.js's onWindowFocus
    // even when the window itself isn't the OS focus target (e.g. after
    // returning from an external browser tab).
    const off = window.electronAPI?.onWindowFocus?.(invalidate);
    return () => {
      window.removeEventListener('focus', invalidate);
      off?.();
    };
  }, [isOpen, queryClient, resolvedProfile?.user_id, currentUser?.id]);

  const monthlyPrice = MONTHLY_PRICE;
  const yearlyPrice  = YEARLY_PRICE;
  const displayMoRate = planType === 'monthly' ? monthlyPrice : YEARLY_MO_EQUIV;

  // Trial eligibility — if profile has never activated Apex, show trial CTA.
  // The server enforces this authoritatively; the client hint is just UX.
  const isTrialEligible = resolvedProfile && !resolvedProfile.apex_first_activated_at;

  const handleUpgrade = async () => {
    setProcessing(true);
    try {
      const { url } = await payments.createCheckoutSession(planType);
      if (!url) throw new Error('No checkout URL returned');
      window.open(url, '_blank');
      toast('Opening secure checkout…', { icon: '🔒' });
    } catch (err) {
      console.error('Checkout failed:', err);
      toast.error(err?.message || 'Could not open checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setProcessing(true);
    try {
      const { url } = await payments.createPortalSession();
      if (!url) throw new Error('No portal URL returned');
      window.open(url, '_blank');
    } catch (err) {
      console.error('Portal failed:', err);
      toast.error(err?.message || 'Could not open billing portal.');
    } finally {
      setProcessing(false);
    }
  };

  const nextBillingLabel = (() => {
    const t = resolvedProfile?.stripe_current_period_end;
    if (!t) return '—';
    try {
      return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return '—'; }
  })();
  const activePlanType = resolvedProfile?.apex_features?.plan_type || resolvedProfile?.plan_type || 'Monthly';
  const activeAmount   = activePlanType === 'yearly' ? `$${YEARLY_PRICE}/yr` : `$${MONTHLY_PRICE}/mo`;
  const isTrialing     = resolvedProfile?.stripe_subscription_status === 'trialing';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#050505] border-[#FF3333]/20 p-0 overflow-hidden max-h-[90vh] overflow-y-auto z-[500]" overlayClassName="z-[499]">

        {/* Header */}
        <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="text-[#FF3333]" size={18} />
            <div>
              <h1 className="text-base font-black text-white uppercase tracking-tight">
                {step === 'manage' ? 'APEX COMMAND' : 'UPGRADE TO APEX'}
              </h1>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
                {currentTier === 'apex'
                  ? (isTrialing ? '🟡 Free trial active' : '🟢 Active Subscription')
                  : 'Premium Membership'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── CHOOSE PLAN ─────────────────────────────────────────────── */}
          {step === 'choose' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Trial banner */}
              {isTrialEligible && (
                <div className="bg-gradient-to-r from-[#FF3333]/15 to-purple-500/10 border border-[#FF3333]/30 rounded-xl p-3 flex items-center gap-3">
                  <Sparkles className="text-[#FF3333]" size={18} />
                  <div>
                    <p className="text-white font-bold text-sm">First month free</p>
                    <p className="text-zinc-400 text-xs">30-day trial for new Apex members — cancel anytime.</p>
                  </div>
                </div>
              )}

              {/* Plan toggle */}
              <div className="flex bg-zinc-900 border border-white/5 rounded-xl p-1 gap-1">
                {[
                  ['monthly', `$${MONTHLY_PRICE}/mo`, ''],
                  ['yearly',  `$${YEARLY_MO_EQUIV}/mo`, `SAVE ${YEARLY_SAVINGS_PCT}%`],
                ].map(([id, priceLabel, badge]) => (
                  <button key={id} onClick={() => setPlanType(id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${planType === id ? 'bg-[#FF3333] text-white' : 'text-zinc-400 hover:text-white'}`}>
                    {priceLabel}
                    {badge && <span className="text-[9px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black">{badge}</span>}
                  </button>
                ))}
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { emoji: '⚡', title: 'Squad Overclock', desc: 'Boost voice calls to 4K/60FPS' },
                  { emoji: '🗄️', title: 'Deep Storage',    desc: 'Unlimited media uploads' },
                  { emoji: '🎨', title: 'Thread Skins',    desc: 'Custom voice thread colors' },
                  { emoji: '🚀', title: 'Entry Protocol',  desc: 'Custom join animations' },
                  { emoji: '🏆', title: 'Apex Badge',      desc: 'Exclusive profile crown' },
                  { emoji: '🌐', title: 'Priority Support', desc: 'Faster response times' },
                ].map(f => (
                  <div key={f.title} className="bg-zinc-900 border border-white/5 rounded-xl p-3 flex gap-3 items-start">
                    <span className="text-lg">{f.emoji}</span>
                    <div>
                      <p className="text-white font-bold text-xs">{f.title}</p>
                      <p className="text-zinc-500 text-[10px]">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-900 border border-white/5 rounded-xl">
                <div>
                  <p className="text-white font-black text-xl">
                    ${displayMoRate}
                    <span className="text-zinc-500 text-sm font-normal">/mo</span>
                  </p>
                  {planType === 'yearly' && (
                    <p className="text-zinc-500 text-xs">${yearlyPrice} billed annually</p>
                  )}
                  {isTrialEligible && (
                    <p className="text-[#FF3333] text-[11px] font-bold">$0.00 due today</p>
                  )}
                </div>
                <button
                  onClick={handleUpgrade}
                  disabled={processing}
                  className="px-6 py-2.5 bg-[#FF3333] hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl text-sm transition-colors shadow-lg shadow-red-900/30 flex items-center gap-2"
                >
                  {processing
                    ? <><Loader2 size={14} className="animate-spin" /> OPENING…</>
                    : <>{isTrialEligible ? 'START FREE TRIAL' : 'INITIATE UPGRADE'} <ExternalLink size={14} /></>
                  }
                </button>
              </div>

              <p className="text-zinc-600 text-[10px] text-center">
                Secure checkout by Stripe. Card details never touch our servers.
                {planType === 'yearly'
                  ? ` Billed $${yearlyPrice} annually.`
                  : ' Billed monthly.'}
                {isTrialEligible && ' Cancel any time during your 30-day trial to avoid the first charge.'}
              </p>
            </motion.div>
          )}

          {/* ── MANAGE SUBSCRIPTION ──────────────────────────────────────── */}
          {step === 'manage' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Status card */}
              <div className="bg-gradient-to-br from-[#FF3333]/10 to-purple-500/5 border border-[#FF3333]/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-[#FF3333]/20 rounded-xl flex items-center justify-center">
                    <Crown className="text-[#FF3333]" size={20} />
                  </div>
                  <div>
                    <p className="text-white font-black">APEX TIER 1</p>
                    <p className={`text-xs flex items-center gap-1 ${isTrialing ? 'text-yellow-400' : 'text-green-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isTrialing ? 'bg-yellow-400' : 'bg-green-400'}`} />
                      {isTrialing ? 'Free trial active' : 'Active Subscription'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-3">
                  {[
                    [isTrialing ? 'Trial Ends' : 'Next Billing', nextBillingLabel],
                    ['Plan', activePlanType === 'yearly' ? 'Yearly' : 'Monthly'],
                    ['Amount', activeAmount],
                  ].map(([l, v]) => (
                    <div key={l}><p className="text-zinc-500 text-[9px] uppercase">{l}</p><p className="text-white font-bold text-sm">{v}</p></div>
                  ))}
                </div>
              </div>

              {/* Active perks */}
              <div className="space-y-1.5">
                {['Squad Overclock', 'Deep Storage', 'Thread Skins', 'Entry Protocol', 'Apex Badge'].map(perk => (
                  <div key={perk} className="flex items-center gap-2.5 px-3 py-2 bg-zinc-900/50 rounded-lg">
                    <Check size={14} className="text-green-400 flex-shrink-0" />
                    <span className="text-white text-sm">{perk}</span>
                  </div>
                ))}
              </div>

              {/* Manage / cancel via Stripe Billing Portal — we don't build our
                  own cancel dialog anymore; Stripe's portal handles cancel,
                  resume, plan swap, payment-method update, and invoice history. */}
              <div className="p-4 border border-white/10 bg-white/5 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-bold text-sm flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-zinc-400" />
                    Manage Billing
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Update payment method, cancel, change plan, view invoices.
                  </p>
                </div>
                <button
                  onClick={handleManageBilling}
                  disabled={processing}
                  className="px-4 py-2 bg-white/5 border border-white/20 text-white hover:bg-white hover:text-black rounded-lg text-xs font-bold transition-all flex-shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {processing
                    ? <><Loader2 size={12} className="animate-spin" /> OPENING…</>
                    : <>MANAGE <ExternalLink size={12} /></>
                  }
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
