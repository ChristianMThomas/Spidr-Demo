import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Calendar, AlertTriangle, Crown, ShieldCheck,
  X, ArrowLeft, Lock, Check, Loader2, Download, ChevronRight, Zap
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { entities, auth } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function ApexCommand({ isOpen, onClose, currentTier = 'free', currentUser, profile }) {
  const [planType,          setPlanType]          = useState('monthly');
  const [step,              setStep]              = useState(currentTier === 'apex' ? 'manage' : 'choose'); // 'choose' | 'billing' | 'confirm' | 'manage'
  const [showCancelDialog,  setShowCancelDialog]  = useState(false);
  const [processing,        setProcessing]        = useState(false);
  const queryClient = useQueryClient();

  // Defense-in-depth: if no profile was passed, resolve it so activation can
  // never silently no-op (the bug where subscribing didn't grant APEX).
  const resolveProfile = async () => {
    if (profile?.id) return profile;
    try {
      const me = currentUser || await auth.me();
      if (!me?.id) return null;
      const rows = await entities.UserProfile.filter({ user_id: me.id });
      return rows?.[0] || null;
    } catch { return null; }
  };

  // Billing form state
  const [billing, setBilling] = useState({
    cardNumber:  '',
    expiry:      '',
    cvc:         '',
    name:        '',
    email:       currentUser?.email || '',
    zip:         '',
  });
  const [billingErrors, setBillingErrors] = useState({});

  const price = planType === 'monthly' ? 7.99 : 6.39; // 20% off annual
  const annualTotal = (6.39 * 12).toFixed(2);

  // Format card number with spaces
  const formatCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d;
  };

  const validateBilling = () => {
    const errors = {};
    const rawCard = billing.cardNumber.replace(/\s/g, '');
    if (rawCard.length < 16)         errors.cardNumber = 'Enter a valid 16-digit card number';
    if (!billing.expiry.match(/^\d{2}\/\d{2}$/)) errors.expiry = 'Enter expiry as MM/YY';
    if (billing.cvc.length < 3)      errors.cvc = 'CVC must be 3-4 digits';
    if (!billing.name.trim())        errors.name = 'Name on card is required';
    if (!billing.email.includes('@')) errors.email = 'Valid email required';
    setBillingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePurchase = async () => {
    if (!validateBilling()) return;
    setProcessing(true);
    try {
      // In production: call your Stripe checkout session endpoint here
      // For now: simulate processing delay then update DB
      await new Promise(r => setTimeout(r, 1800));

      const activeProfile = await resolveProfile();
      if (activeProfile?.id) {
        await entities.UserProfile.update(activeProfile.id, {
          apex_tier: 'apex',
          apex_features: {
            thread_skin: 'default',
            squad_overclock: true,
            deep_storage: true,
            entry_protocol: 'default',
            activated_at: new Date().toISOString(),
            plan_type: planType,
          }
        });
        // Invalidate every key that holds a copy of the user profile so the
        // APEX tab, badge, and unlocked features appear immediately. We hit
        // both the user_id-keyed cache (used by HolographicProfile) and the
        // currentUser.id-keyed cache (used by Settings) — they're the same
        // string in practice, but explicit is safer than implicit.
        queryClient.invalidateQueries({ queryKey: ['userProfile', activeProfile.user_id] });
        queryClient.invalidateQueries({ queryKey: ['userProfile', currentUser?.id] });
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        queryClient.invalidateQueries({ queryKey: ['profiles-for-chat'] });
        // Re-sync the shell's currentUser so the APEX tab + badge unlock
        // immediately without a page reload.
        window.dispatchEvent(new CustomEvent('spidr-profile-updated', {
          detail: { profile: { apex_tier: 'apex' } },
        }));
        toast.success('🕷️ APEX ACTIVATED — Welcome to the network.');
        setStep('manage');
      } else {
        // Don't show a fake success — surface the real problem.
        toast.error('Could not find your profile to activate APEX. Please reload and try again.');
      }
    } catch (err) {
      toast.error('Payment processing failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      await new Promise(r => setTimeout(r, 800));
      if (profile?.id) {
        await entities.UserProfile.update(profile.id, { apex_tier: 'free' });
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        queryClient.invalidateQueries({ queryKey: ['userProfile', profile.user_id] });
        queryClient.invalidateQueries({ queryKey: ['userProfile', currentUser?.id] });
        queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
        window.dispatchEvent(new CustomEvent('spidr-profile-updated', {
          detail: { profile: { apex_tier: 'free' } },
        }));
      }
      toast('Subscription cancelled. Access until next billing cycle.');
      setShowCancelDialog(false);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#050505] border-[#FF3333]/20 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'billing' && (
              <button onClick={() => setStep('choose')} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft size={16} />
              </button>
            )}
            <Crown className="text-[#FF3333]" size={18} />
            <div>
              <h1 className="text-base font-black text-white uppercase tracking-tight">
                {step === 'manage' ? 'APEX COMMAND' : 'UPGRADE TO APEX'}
              </h1>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
                {currentTier === 'apex' ? '🟢 Active Subscription' : 'Premium Membership'}
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
              {/* Plan toggle */}
              <div className="flex bg-zinc-900 border border-white/5 rounded-xl p-1 gap-1">
                {[['monthly', '$7.99/mo', ''], ['yearly', '$6.39/mo', 'SAVE 20%']].map(([id, price, badge]) => (
                  <button key={id} onClick={() => setPlanType(id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${planType === id ? 'bg-[#FF3333] text-white' : 'text-zinc-400 hover:text-white'}`}>
                    {price}
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
                  <p className="text-white font-black text-xl">${price}<span className="text-zinc-500 text-sm font-normal">/mo</span></p>
                  {planType === 'yearly' && <p className="text-zinc-500 text-xs">${annualTotal} billed annually</p>}
                </div>
                <button onClick={() => setStep('billing')}
                  className="px-6 py-2.5 bg-[#FF3333] hover:bg-red-500 text-white font-black rounded-xl text-sm transition-colors shadow-lg shadow-red-900/30">
                  INITIATE UPGRADE →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── BILLING FORM ─────────────────────────────────────────────── */}
          {step === 'billing' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                <Lock size={12} className="text-green-500" />
                <span>Secured with 256-bit SSL encryption</span>
              </div>

              {/* Order summary */}
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-white font-bold text-sm flex items-center gap-2"><Crown size={14} className="text-[#FF3333]" /> SPIDR APEX</p>
                  <p className="text-zinc-500 text-xs capitalize">{planType} plan</p>
                </div>
                <p className="text-white font-black text-lg">${price}<span className="text-zinc-500 text-xs font-normal">/mo</span></p>
              </div>

              {/* Card fields */}
              <div className="space-y-3">
                <BillingField label="Name on Card" value={billing.name} error={billingErrors.name}
                  onChange={v => setBilling(p => ({ ...p, name: v }))} placeholder="John Doe" />
                <BillingField label="Email" value={billing.email} error={billingErrors.email}
                  onChange={v => setBilling(p => ({ ...p, email: v }))} placeholder="you@example.com" />

                {/* Card number */}
                <div>
                  <label className="text-zinc-400 text-xs font-bold block mb-1.5">Card Number</label>
                  <div className="relative">
                    <input
                      value={billing.cardNumber}
                      onChange={e => setBilling(p => ({ ...p, cardNumber: formatCard(e.target.value) }))}
                      placeholder="1234 5678 9012 3456"
                      className={`w-full bg-zinc-900 border ${billingErrors.cardNumber ? 'border-red-500' : 'border-zinc-700'} text-white rounded-lg px-3 py-2.5 text-sm font-mono pr-10 focus:outline-none focus:border-[#FF3333]`}
                    />
                    <CreditCard size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  </div>
                  {billingErrors.cardNumber && <p className="text-red-400 text-[10px] mt-1">{billingErrors.cardNumber}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 text-xs font-bold block mb-1.5">Expiry (MM/YY)</label>
                    <input
                      value={billing.expiry}
                      onChange={e => setBilling(p => ({ ...p, expiry: formatExpiry(e.target.value) }))}
                      placeholder="12/28"
                      className={`w-full bg-zinc-900 border ${billingErrors.expiry ? 'border-red-500' : 'border-zinc-700'} text-white rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF3333]`}
                    />
                    {billingErrors.expiry && <p className="text-red-400 text-[10px] mt-1">{billingErrors.expiry}</p>}
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs font-bold block mb-1.5">CVC</label>
                    <input
                      value={billing.cvc}
                      onChange={e => setBilling(p => ({ ...p, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="•••"
                      className={`w-full bg-zinc-900 border ${billingErrors.cvc ? 'border-red-500' : 'border-zinc-700'} text-white rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#FF3333]`}
                    />
                    {billingErrors.cvc && <p className="text-red-400 text-[10px] mt-1">{billingErrors.cvc}</p>}
                  </div>
                </div>

                <BillingField label="ZIP / Postal Code" value={billing.zip}
                  onChange={v => setBilling(p => ({ ...p, zip: v }))} placeholder="10001" />
              </div>

              <button
                onClick={handlePurchase}
                disabled={processing}
                className="w-full py-3.5 bg-[#FF3333] hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl text-sm transition-colors shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
              >
                {processing
                  ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                  : <><Crown size={16} /> ACTIVATE APEX — ${price}/mo</>
                }
              </button>

              <p className="text-zinc-600 text-[10px] text-center">
                By upgrading you agree to our Terms of Service. Cancel anytime. 
                {planType === 'yearly' ? ` Billed $${annualTotal} annually.` : ' Billed monthly.'}
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
                    <p className="text-green-400 text-xs flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Active Subscription</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-3">
                  {[['Next Billing', 'Apr 14, 2026'], ['Plan', 'Monthly'], ['Amount', '$7.99/mo']].map(([l, v]) => (
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

              {/* Danger zone */}
              <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <p className="text-red-400 font-bold text-sm flex items-center gap-1.5"><AlertTriangle size={14} /> Cancel Subscription</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Access continues until Apr 14, 2026</p>
                </div>
                <button onClick={() => setShowCancelDialog(true)}
                  className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-xs font-bold transition-all flex-shrink-0">
                  CANCEL
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Cancel confirmation */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent className="bg-[#0a0a0a] border-red-500/30 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={18} /> Confirm Cancellation
              </DialogTitle>
            </DialogHeader>
            <p className="text-zinc-400 text-sm mt-2">You'll lose all APEX features at the end of your current billing cycle.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCancelDialog(false)}
                className="flex-1 py-2 border border-white/10 text-white rounded-lg text-sm hover:bg-white/5 transition-colors">
                KEEP APEX
              </button>
              <button onClick={handleCancel} disabled={processing}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {processing ? <Loader2 size={14} className="animate-spin" /> : 'CONFIRM'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function BillingField({ label, value, onChange, placeholder, error }) {
  return (
    <div>
      <label className="text-zinc-400 text-xs font-bold block mb-1.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-zinc-900 border ${error ? 'border-red-500' : 'border-zinc-700'} text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#FF3333] transition-colors`}
      />
      {error && <p className="text-red-400 text-[10px] mt-1">{error}</p>}
    </div>
  );
}
