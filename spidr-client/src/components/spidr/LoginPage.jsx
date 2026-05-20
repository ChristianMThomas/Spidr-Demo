import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/api/apiClient';
import SpiderLogo from './SpiderLogo';
import { Loader2, Eye, EyeOff, RefreshCw, Smartphone, Mail, ArrowLeft } from 'lucide-react';

// ─── Spider web background ────────────────────────────────────────────────────
function WebLines() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      {[...Array(12)].map((_, i) => {
        const rad = (i / 12) * Math.PI * 2;
        return <line key={i} x1="50%" y1="50%" x2={`${50 + 70 * Math.cos(rad)}%`} y2={`${50 + 70 * Math.sin(rad)}%`} stroke="#ef4444" strokeWidth="0.5"/>;
      })}
      {[8, 18, 30, 45, 62].map(r => (
        <ellipse key={r} cx="50%" cy="50%" rx={`${r}%`} ry={`${r*0.55}%`} fill="none" stroke="#ef4444" strokeWidth="0.4"/>
      ))}
    </svg>
  );
}

// ─── Shared input class ───────────────────────────────────────────────────────
const inp = "w-full bg-black/60 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/40 transition-all placeholder-white/20";

// ─── Auth Gateway (login / register) ─────────────────────────────────────────
function AuthGateway({ onSuccess, onForgot }) {
  const { login, register } = useAuth();
  const [mode,    setMode]    = useState('login');
  const [form,    setForm]    = useState({ email: '', password: '', username: '', full_name: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMove = (e) => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setTilt({ x: -((e.clientY - r.top - r.height/2) / 50), y: (e.clientX - r.left - r.width/2) / 50 });
  };

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handle = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = mode === 'login'
        ? await login(form.email, form.password)
        : await register({
            email: form.email,
            password: form.password,
            username: form.username,
            full_name: form.full_name,
            // Empty discriminator means "server, please pick one for me"
            discriminator: (form.discriminator || '').trim() || undefined,
          });

      if (result?.requires2FA || result?.requiresVerification) {
        onSuccess({ email: form.email, mode: result.requires2FA ? 'login' : 'verify' });
      }
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.error || err?.message ||
        'Connection failed — make sure the server is running on port 4000'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="perspective-[1200px] w-full max-w-md z-10" onMouseMove={onMove} onMouseLeave={() => setTilt({x:0,y:0})}>
      <div ref={cardRef}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: 'preserve-3d', transition: 'transform 0.15s ease-out' }}
        className="relative bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.9)] p-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="flex items-center justify-center mb-3"><SpiderLogo size={52} /></div>
          <h1 className="text-4xl font-black text-white tracking-tighter">SPID<span className="text-red-500">R</span></h1>
          <p className="text-white/25 text-[10px] tracking-[0.35em] uppercase mt-1">Module Nexus Gateway</p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-black/50 rounded-xl p-1 mb-6 border border-white/5">
          {[['login','INITIALIZE'],['register','FORM CONNECTION']].map(([m, label]) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${mode===m ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-white/30 hover:text-white/60'}`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handle} className="space-y-3">
          <AnimatePresence>
            {mode === 'register' && (
              <motion.div key="reg" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} className="space-y-3 overflow-hidden">
                <div>
                  <label className="text-white/30 text-[10px] font-bold tracking-widest uppercase block mb-1.5">Full Name</label>
                  <input type="text" placeholder="Your name" className={inp} value={form.full_name} onChange={set('full_name')} />
                </div>
                <div>
                  <label className="text-white/30 text-[10px] font-bold tracking-widest uppercase block mb-1.5">Alias</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Choose your handle"
                      className={inp + ' flex-1'}
                      value={form.username}
                      onChange={set('username')}
                      required={mode === 'register'}
                    />
                    <span className="text-white/30 text-xs font-mono select-none">#</span>
                    <input
                      type="text"
                      placeholder="abcd"
                      maxLength={4}
                      pattern="[a-z0-9]{4}"
                      title="Optional — 4 lowercase letters or numbers. Leave blank to auto-assign."
                      className={inp + ' w-16 text-center font-mono lowercase'}
                      value={form.discriminator || ''}
                      onChange={(e) => setForm(f => ({ ...f, discriminator: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) }))}
                    />
                  </div>
                  <p className="text-white/25 text-[9px] mt-1.5 leading-snug">
                    Your @username and a 4-character tag together make you unique. Leave the tag empty and we'll pick one for you.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="text-white/30 text-[10px] font-bold tracking-widest uppercase block mb-1.5">Secure Signal</label>
            <input type="email" placeholder="name@domain.com" className={inp} value={form.email} onChange={set('email')} required />
          </div>

          <div>
            <label className="text-white/30 text-[10px] font-bold tracking-widest uppercase block mb-1.5">Passcode</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} placeholder="••••••••" className={inp + ' pr-10'} value={form.password} onChange={set('password')} required />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          {mode === 'login' && (
            <div className="flex justify-end">
              <button type="button" onClick={onForgot} className="text-[10px] text-white/25 hover:text-red-400 transition-colors">
                Forgot passcode? → Override Protocol
              </button>
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
              className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg text-center">
              {error}
            </motion.div>
          )}

          <button type="submit" disabled={loading}
            className="w-full mt-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] text-sm tracking-widest uppercase flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Encrypting…</> : mode === 'login' ? 'ACCESS GRID' : 'JOIN NETWORK'}
          </button>
        </form>

        <p className="text-center text-white/15 text-[10px] mt-5">
          {mode === 'login' ? 'A 6-digit code will be sent to your email — or use your authenticator app.' : 'A verification code will be sent to your email.'}
        </p>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </div>
  );
}

// ─── OTP Screen — handles both email code AND authenticator app ───────────────
function OTPScreen({ email, mode, onBack }) {
  const { verifyOTP, resendOTP } = useAuth();
  const [method,    setMethod]    = useState('email'); // 'email' | 'totp'
  const [digits,    setDigits]    = useState(['','','','','','']);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resent,    setResent]    = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devOtp,    setDevOtp]    = useState(null); // shows OTP in dev when no email configured
  const refs = useRef([]);

  // Auto-focus first box
  useEffect(() => { refs.current[0]?.focus(); }, [method]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c-1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // In dev: automatically fetch OTP from server if no email configured
  useEffect(() => {
    const fetchDevOtp = async () => {
      try {
        const data = await auth.devGetOtp(email);
        if (data?.otp) setDevOtp(data.otp);
      } catch { /* silently ignore — email may be configured */ }
    };
    if (method === 'email') fetchDevOtp();
  }, [email, method]);

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits]; next[i] = val; setDigits(next);
    if (val && i < 5) refs.current[i+1]?.focus();
    if (val && i === 5 && next.every(Boolean)) submitCode(next.join(''));
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i-1]?.focus();
  };

  const handlePaste = (e) => {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if (p.length === 6) { setDigits(p.split('')); refs.current[5]?.focus(); submitCode(p); }
  };

  const submitCode = async (code) => {
    setError(''); setLoading(true);
    try {
      await verifyOTP(email, code);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Invalid or expired code');
      setDigits(['','','','','','']);
      refs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    try {
      await resendOTP(email);
      setResent(true); setCountdown(60); setError('');
      setDevOtp(null);
      // Re-fetch dev OTP after resend
      setTimeout(async () => {
        try { const d = await auth.devGetOtp(email); if (d?.otp) setDevOtp(d.otp); } catch {}
      }, 500);
      setTimeout(() => setResent(false), 3000);
    } catch (err) { setError(err?.response?.data?.error || 'Could not resend'); }
  };

  const masked = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 16)) + c);

  return (
    <div className="w-full max-w-md z-10">
      <div className="relative bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.9)] p-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            {method === 'totp' ? <Smartphone size={28} className="text-red-400" /> : <span className="text-3xl">🛡️</span>}
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {mode === 'verify' ? 'Verify Account' : '2FA Required'}
          </h2>
          {method === 'email' ? (
            <p className="text-white/30 text-sm mt-2">
              Signal sent to <span className="text-red-400 font-mono">{masked}</span>
            </p>
          ) : (
            <p className="text-white/30 text-sm mt-2">Enter the code from your authenticator app</p>
          )}
        </div>

        {/* Method switcher — only on login (not account verification) */}
        {mode === 'login' && (
          <div className="flex gap-2 mb-5">
            <button onClick={() => { setMethod('email'); setDigits(['','','','','','']); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all border ${method==='email' ? 'bg-red-600 border-red-500 text-white' : 'bg-black/40 border-white/10 text-white/40 hover:text-white/70'}`}>
              <Mail size={13}/> Email Code
            </button>
            <button onClick={() => { setMethod('totp'); setDigits(['','','','','','']); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all border ${method==='totp' ? 'bg-red-600 border-red-500 text-white' : 'bg-black/40 border-white/10 text-white/40 hover:text-white/70'}`}>
              <Smartphone size={13}/> Authenticator App
            </button>
          </div>
        )}

        {/* Dev mode banner — shows OTP when no email is configured */}
        {devOtp && method === 'email' && (
          <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
            className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
            <span className="text-amber-400 text-lg">🔧</span>
            <div>
              <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Dev Mode — No Email Config</p>
              <p className="text-amber-300 text-xs mt-0.5">
                Your code: <span className="font-black font-mono text-base tracking-[0.3em]">{devOtp}</span>
              </p>
              <p className="text-amber-500/60 text-[9px] mt-0.5">Set EMAIL_USER + EMAIL_PASS in server .env to send real emails</p>
            </div>
          </motion.div>
        )}

        {/* 6 digit boxes */}
        <form onSubmit={e => { e.preventDefault(); const c = digits.join(''); if (c.length < 6) { setError('Enter all 6 digits'); return; } submitCode(c); }} className="space-y-5">
          <div className="flex justify-between gap-2" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input key={i} ref={el => refs.current[i] = el}
                type="text" inputMode="numeric" maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKey(i, e)}
                className={`w-12 h-14 bg-black/60 border text-white text-center text-2xl font-black rounded-xl focus:outline-none transition-all
                  ${d ? 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]' : 'border-white/10 focus:border-red-500/70'}`}
              />
            ))}
          </div>

          {error && (
            <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
              className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg text-center">
              {error}
            </motion.div>
          )}

          <button type="submit" disabled={loading || digits.join('').length < 6}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] text-sm tracking-widest uppercase flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : 'ESTABLISH CONNECTION'}
          </button>
        </form>

        {/* Footer row */}
        <div className="mt-5 flex items-center justify-between">
          <button onClick={onBack} className="text-white/20 hover:text-white/50 text-xs transition-colors flex items-center gap-1">
            <ArrowLeft size={12}/> Back
          </button>
          {method === 'email' && (
            <button onClick={handleResend} disabled={countdown > 0}
              className="text-xs text-white/25 hover:text-white/60 disabled:opacity-30 transition-colors flex items-center gap-1">
              <RefreshCw size={11}/>
              {resent ? '✓ Sent!' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend signal'}
            </button>
          )}
        </div>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </div>
  );
}

// ─── Password Reset (Override Protocol) ──────────────────────────────────────
function ForgotPassword({ onBack }) {
  const [step,    setStep]    = useState('identify'); // identify | verify | reset
  const [email,   setEmail]   = useState('');
  const [method,  setMethod]  = useState('email');
  const [code,    setCode]    = useState('');
  const [newPw,   setNewPw]   = useState('');
  const [token,   setToken]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [showPw,  setShowPw]  = useState(false);

  const identify = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await auth.overrideRequest(email);
      setMethod(data.method || 'email');
      setStep('verify');
    } catch (err) { setError(err?.response?.data?.error || 'Failed to locate account'); }
    setLoading(false);
  };

  const verify = async (e) => {
    e.preventDefault();
    if (code.length < 6) { setError('Enter the 6-digit code'); return; }
    setError(''); setLoading(true);
    try {
      const data = await auth.overrideVerify(email, code, method);
      setToken(data.resetToken);
      setStep('reset');
    } catch (err) { setError(err?.response?.data?.error || 'Invalid code'); }
    setLoading(false);
  };

  const reset = async (e) => {
    e.preventDefault();
    if (newPw.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError(''); setLoading(true);
    try {
      await auth.overrideConfirm(token, newPw);
      setSuccess('Override successful! Returning to gateway…');
      setTimeout(onBack, 2500);
    } catch (err) { setError(err?.response?.data?.error || 'Reset failed'); }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md z-10">
      <div className="relative bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-red-500/20 shadow-[0_0_60px_rgba(0,0,0,0.9)] p-8">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />

        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-widest">Override Protocol</h2>
          <p className="text-white/30 text-xs mt-2 uppercase tracking-widest">
            {step === 'identify' ? 'Enter your email' : step === 'verify' ? 'Verify identity' : 'Set new passcode'}
          </p>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl text-center">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
            {error}
          </div>
        )}

        {step === 'identify' && (
          <form onSubmit={identify} className="space-y-4">
            <p className="text-white/30 text-sm text-center">Enter your registered email to begin.</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="operative@domain.com" className={inp} />
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin"/>Scanning…</> : 'INITIATE OVERRIDE'}
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-white/30 text-sm text-center">
              {method === 'totp' ? '📱 Enter the code from your authenticator app.' : '✉️ Enter the 6-digit code sent to your email.'}
            </p>
            <input type="text" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g,''))}
              placeholder="••••••"
              className="w-full bg-black/60 border border-white/10 text-white text-center text-3xl tracking-[0.4em] font-black rounded-xl px-4 py-4 focus:outline-none focus:border-red-500 font-mono" />
            <button type="submit" disabled={loading || code.length < 6}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin"/>Verifying…</> : 'CONFIRM IDENTITY'}
            </button>
          </form>
        )}

        {step === 'reset' && !success && (
          <form onSubmit={reset} className="space-y-4">
            <p className="text-white/30 text-sm text-center">Identity confirmed. Set a new passphrase.</p>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} required
                placeholder="New passphrase (8+ chars)" className={inp + ' pr-10'} />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            <button type="submit" disabled={loading || newPw.length < 8}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin"/>Encrypting…</> : 'LOCK NEW PASSCODE'}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <button onClick={onBack} className="text-white/20 hover:text-white/50 text-xs transition-colors flex items-center gap-1 mx-auto">
            <ArrowLeft size={11}/> Cancel & return to gateway
          </button>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    </div>
  );
}

// ─── Root LoginPage ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const { pendingEmail, otpMode, cancelOTP } = useAuth();
  const [showForgot, setShowForgot] = useState(false);

  return (
    <div className="fixed inset-0 bg-[#080808] flex items-center justify-center overflow-hidden">
      <WebLines />
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-900/5 rounded-full blur-[100px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {showForgot ? (
          <motion.div key="forgot" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} transition={{ duration:0.25 }} className="w-full max-w-md px-4">
            <ForgotPassword onBack={() => setShowForgot(false)} />
          </motion.div>
        ) : pendingEmail ? (
          <motion.div key="otp" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} transition={{ duration:0.25 }} className="w-full max-w-md px-4">
            <OTPScreen email={pendingEmail} mode={otpMode} onBack={cancelOTP} />
          </motion.div>
        ) : (
          <motion.div key="auth" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} transition={{ duration:0.25 }} className="w-full max-w-md px-4">
            <AuthGateway onSuccess={() => {}} onForgot={() => setShowForgot(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
