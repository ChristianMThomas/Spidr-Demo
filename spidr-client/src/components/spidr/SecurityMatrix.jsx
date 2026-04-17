import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { entities, auth } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Key, LogOut, AlertTriangle, Lock,
  Smartphone, Mail, Check, X, Loader2, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function SecurityMatrix({ currentUser }) {
  const { logout } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [show2FADialog,      setShow2FADialog]      = useState(false);
  const [showResetDialog,    setShowResetDialog]     = useState(false);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['userProfile', currentUser?.id],
    queryFn:  async () => (await entities.UserProfile.filter({ user_id: currentUser?.id }))[0],
    enabled:  !!currentUser?.id,
  });

  const accountAge = currentUser?.created_date
    ? Math.floor((Date.now() - new Date(currentUser.created_date).getTime()) / 86400000)
    : 0;

  const totpEnabled = currentUser?.twoFactorMethod === 'totp';

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-10 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-red-500/10 rounded-xl border border-red-500/20 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-widest uppercase">Security Matrix</h1>
          <p className="text-zinc-500 text-sm">Identity protection and access management protocols.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">

        {/* ── Left Column ── */}
        <div className="space-y-5">
          {/* Identity */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Identity Credentials</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-zinc-400 text-xs uppercase tracking-wider">Operative ID</span>
              <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Lock className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <p className="text-white font-mono text-base mb-4">{currentUser?.email}</p>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Link Status" value="ACTIVE" green />
              <Stat label="Link Age" value={`${accountAge} DAYS`} />
            </div>
          </div>

          {/* Password */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl border border-red-500/20 flex items-center justify-center">
                <Key className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Access Key Management</p>
                <p className="text-zinc-500 text-xs">Update your encryption passphrase</p>
              </div>
            </div>
            <button onClick={() => setShowPasswordDialog(true)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-white text-sm font-bold rounded-xl transition-colors uppercase tracking-widest">
              RE-ENCRYPT ACCESS KEY
            </button>
          </div>

          {/* 2FA */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${totpEnabled ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <Smartphone className={`w-5 h-5 ${totpEnabled ? 'text-green-400' : 'text-red-500'}`} />
              </div>
              <div>
                <p className="text-white font-bold text-sm flex items-center gap-2">
                  Two-Factor Authentication
                  {totpEnabled && <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-black border border-green-500/20">ACTIVE</span>}
                </p>
                <p className="text-zinc-500 text-xs">{totpEnabled ? 'Authenticator app linked' : 'Protect your account with an authenticator app'}</p>
              </div>
            </div>
            <button onClick={() => setShow2FADialog(true)}
              className={`w-full py-2.5 text-white text-sm font-black rounded-xl transition-colors uppercase tracking-widest ${
                totpEnabled ? 'bg-zinc-800 hover:bg-zinc-700 border border-white/5' : 'bg-red-600 hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
              }`}>
              {totpEnabled ? 'MANAGE AUTHENTICATOR' : 'GENERATE SYNC MATRIX'}
            </button>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-5">
          {/* Current session */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Active Neural Links</p>
            <div className="bg-zinc-800/50 border border-white/5 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-bold text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Current Session
                </p>
                <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-black border border-green-500/20">ACTIVE</span>
              </div>
              {[['Device', 'Desktop Terminal'], ['Connected', new Date().toLocaleTimeString()], ['Protocol', 'SPIDR-SECURE']].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="text-zinc-500 text-xs">{k}</span>
                  <span className="text-white text-xs font-mono font-bold">{v}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 text-xs text-zinc-500">
              <p className="flex items-center gap-2"><span>🔒</span> Session encrypted end-to-end using SPIDR-SECURE protocol.</p>
              <p className="flex items-center gap-2"><span>🕸</span> You'll remain connected until manually disconnected.</p>
              <p className="flex items-center gap-2"><span>⚡</span> All activity is monitored and logged for security.</p>
            </div>
          </div>

          {/* Forgot password */}
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Override Protocol</p>
                <p className="text-zinc-500 text-xs">Forgot your password? Reset via 2FA verification</p>
              </div>
            </div>
            <button onClick={() => setShowResetDialog(true)}
              className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-sm font-bold rounded-xl transition-colors uppercase tracking-widest">
              INITIATE OVERRIDE PROTOCOL
            </button>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-950/20 border border-red-500/20 rounded-2xl p-5">
            <p className="text-red-400 font-bold text-sm flex items-center gap-2 mb-3"><AlertTriangle size={16} /> DANGER ZONE</p>
            <button onClick={() => { if (window.confirm('Sever neural link and log out of all devices?')) logout(); }}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-400 hover:text-white text-sm font-bold rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2">
              <LogOut size={16} /> SEVER NEURAL LINK
            </button>
            <p className="text-zinc-600 text-xs text-center mt-2">This will disconnect you from all devices</p>
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <PasswordDialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)} currentUser={currentUser} />
      <TwoFADialog    open={show2FADialog}      onClose={() => setShow2FADialog(false)}      currentUser={currentUser} totpEnabled={totpEnabled} queryClient={queryClient} />
      <ResetDialog    open={showResetDialog}    onClose={() => setShowResetDialog(false)} />
    </div>
  );
}

// ── Stat Cell ─────────────────────────────────────────────────────────────────
function Stat({ label, value, green }) {
  return (
    <div className="bg-zinc-800/50 rounded-xl p-3">
      <p className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-bold text-sm font-mono ${green ? 'text-green-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

// ── Password Change Dialog ────────────────────────────────────────────────────
function PasswordDialog({ open, onClose, currentUser }) {
  const [curr,    setCurr]    = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (next !== confirm) { toast.error('Passwords do not match'); return; }
    if (next.length < 8)  { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await auth.changePassword?.({ currentPassword: curr, newPassword: next });
      toast.success('Access key re-encrypted!');
      onClose(); setCurr(''); setNext(''); setConfirm('');
    } catch (err) { toast.error(err?.response?.data?.error || err?.message || 'Failed'); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-sm">
        <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Key size={16} className="text-red-400" /> Re-Encrypt Access Key</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-3">
          {[['Current Password', curr, setCurr], ['New Password', next, setNext], ['Confirm Password', confirm, setConfirm]].map(([label, val, set]) => (
            <div key={label}>
              <label className="text-zinc-400 text-xs font-bold block mb-1.5">{label}</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={val} onChange={e => set(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500 pr-10" />
                <button onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
          <button onClick={submit} disabled={loading || !curr || !next || !confirm}
            className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            {loading ? 'Encrypting…' : 'UPDATE PASSWORD'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── 2FA / TOTP Dialog ─────────────────────────────────────────────────────────
function TwoFADialog({ open, onClose, currentUser, totpEnabled, queryClient }) {
  const [step,    setStep]    = useState('choice'); // 'choice' | 'scan' | 'verify'
  const [qrData,  setQrData]  = useState(null);
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = Array.from({ length: 6 }, () => React.useRef(null));

  const handleClose = () => { setStep('choice'); setQrData(null); setCode(''); onClose(); };

  const startTotp = async () => {
    setLoading(true);
    try {
      const data = await auth.setupTotp();
      setQrData(data); setStep('scan');
    } catch (err) { toast.error(err?.response?.data?.error || 'Setup failed'); }
    setLoading(false);
  };

  const verifyTotp = async () => {
    if (code.length < 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      await auth.verifyTotpSetup(code);
      toast.success('🔒 Authenticator linked! Your account is now secured.');
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      handleClose();
    } catch (err) { toast.error(err?.response?.data?.error || 'Invalid code'); }
    setLoading(false);
  };

  const disableTotp = async () => {
    if (!window.confirm('Disable authenticator 2FA? This weakens your account security.')) return;
    setLoading(true);
    try {
      await auth.disableTotp();
      toast.success('Authenticator disabled');
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      handleClose();
    } catch { toast.error('Failed to disable'); }
    setLoading(false);
  };

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const arr = code.split('').concat(Array(6).fill('')).slice(0,6);
    arr[i] = val;
    setCode(arr.join(''));
    if (val && i < 5) inputs[i+1].current?.focus();
    if (val && i === 5 && arr.filter(Boolean).length === 6) verifyTotp();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Smartphone size={16} className="text-red-400" />
            {step === 'choice' ? 'Two-Factor Authentication' : step === 'scan' ? 'Scan QR Code' : 'Verify Code'}
          </DialogTitle>
        </DialogHeader>

        {/* Choice */}
        {step === 'choice' && (
          <div className="space-y-3 mt-3">
            {totpEnabled ? (
              <div className="space-y-3">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-green-400 font-bold text-sm">Authenticator App Active</p>
                    <p className="text-zinc-500 text-xs">Your account is protected with TOTP 2FA</p>
                  </div>
                </div>
                <button onClick={disableTotp} disabled={loading}
                  className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} DISABLE 2FA
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-zinc-400 text-sm text-center pb-1">Choose your security method</p>
                <button onClick={startTotp} disabled={loading}
                  className="w-full flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-700 hover:border-red-500 rounded-xl transition-all text-left">
                  <span className="text-3xl">📱</span>
                  <div>
                    <p className="text-white font-bold text-sm">Authenticator App</p>
                    <p className="text-zinc-500 text-xs">Authy, Google, or Microsoft Authenticator (Recommended)</p>
                  </div>
                  {loading && <Loader2 size={16} className="animate-spin text-zinc-400 ml-auto" />}
                </button>
                <div className="flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-700 rounded-xl opacity-60 cursor-not-allowed">
                  <span className="text-3xl">✉️</span>
                  <div>
                    <p className="text-white font-bold text-sm">Email Verification</p>
                    <p className="text-zinc-500 text-xs">Already active — codes sent to {currentUser?.email}</p>
                  </div>
                  <span className="ml-auto text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-black border border-blue-500/20">ON</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* QR Scan */}
        {step === 'scan' && qrData && (
          <div className="flex flex-col items-center gap-4 mt-3">
            <p className="text-zinc-400 text-sm text-center">Scan this QR code with your authenticator app</p>
            <div className="bg-white p-3 rounded-2xl border-4 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <img src={qrData.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
            </div>
            <div className="w-full p-3 bg-zinc-900 rounded-xl border border-zinc-700">
              <p className="text-zinc-500 text-[10px] uppercase mb-1">Manual Entry Key</p>
              <p className="text-white font-mono text-sm break-all">{qrData.secret}</p>
            </div>
            <button onClick={() => setStep('verify')}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-colors">
              I'VE SCANNED IT → ENTER CODE
            </button>
          </div>
        )}

        {/* Verify */}
        {step === 'verify' && (
          <div className="flex flex-col items-center gap-5 mt-3">
            <p className="text-zinc-400 text-sm text-center">Enter the 6-digit code from your authenticator app</p>
            <div className="flex gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <input key={i} ref={inputs[i]}
                  type="text" inputMode="numeric" maxLength={1}
                  value={code[i] || ''}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Backspace' && !code[i] && i > 0) { inputs[i-1].current?.focus(); handleDigit(i-1, ''); } }}
                  className={`w-11 h-13 bg-zinc-900 border text-white text-center text-xl font-black rounded-xl focus:outline-none transition-colors ${code[i] ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'border-zinc-700 focus:border-red-500/60'}`}
                />
              ))}
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={() => setStep('scan')} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors">← BACK</button>
              <button onClick={verifyTotp} disabled={loading || code.length < 6}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {loading ? 'VERIFYING…' : 'VERIFY'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Password Reset Dialog ─────────────────────────────────────────────────────
function ResetDialog({ open, onClose }) {
  const [step,    setStep]    = useState('identify'); // 'identify' | 'verify' | 'reset'
  const [email,   setEmail]   = useState('');
  const [method,  setMethod]  = useState('');
  const [code,    setCode]    = useState('');
  const [newPw,   setNewPw]   = useState('');
  const [token,   setToken]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleClose = () => { setStep('identify'); setEmail(''); setMethod(''); setCode(''); setNewPw(''); setToken(''); setSuccess(''); onClose(); };

  const identify = async () => {
    setLoading(true);
    try {
      const data = await auth.overrideRequest(email);
      setMethod(data.method); setStep('verify');
      toast.success(data.method === 'totp' ? 'Enter your authenticator code' : 'Reset code sent to your email');
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed'); }
    setLoading(false);
  };

  const verify = async () => {
    setLoading(true);
    try {
      const data = await auth.overrideVerify(email, code, method);
      setToken(data.resetToken); setStep('reset');
    } catch (err) { toast.error(err?.response?.data?.error || 'Invalid code'); }
    setLoading(false);
  };

  const reset = async () => {
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await auth.overrideConfirm(token, newPw);
      setSuccess('Override successful — return to the gateway to access the grid.');
      setTimeout(handleClose, 3000);
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed'); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0a0a0a] border-red-500/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <span className="text-red-500">⚠️</span> Override Protocol
          </DialogTitle>
        </DialogHeader>
        <div className="mt-3">
          {success && <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl text-center mb-4">{success}</div>}

          {step === 'identify' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">Enter your registered email to begin the passcode reset.</p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && identify()}
                placeholder="operative@domain.com"
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500" />
              <button onClick={identify} disabled={loading || !email}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                {loading ? 'SCANNING…' : 'INITIATE OVERRIDE'}
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm text-center">
                {method === 'totp' ? '📱 Enter the 6-digit code from your authenticator app' : '✉️ Check your email for the 6-digit reset code'}
              </p>
              <input type="text" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g,''))}
                placeholder="••••••"
                className="w-full bg-zinc-900 border border-zinc-700 text-white text-center text-3xl tracking-[0.4em] font-black rounded-xl px-4 py-4 focus:outline-none focus:border-red-500 font-mono" />
              <button onClick={verify} disabled={loading || code.length < 6}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {loading ? 'VERIFYING…' : 'CONFIRM IDENTITY'}
              </button>
              <button onClick={() => setStep('identify')} className="w-full text-zinc-500 text-xs hover:text-white text-center transition-colors">← Back</button>
            </div>
          )}

          {step === 'reset' && !success && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm text-center">Identity confirmed. Set a new passphrase.</p>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New passphrase (8+ characters)"
                className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500" />
              <button onClick={reset} disabled={loading || newPw.length < 8}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {loading ? 'ENCRYPTING…' : 'LOCK NEW PASSCODE'}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
