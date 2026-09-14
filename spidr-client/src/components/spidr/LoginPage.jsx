import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import { auth } from '@/api/apiClient';
import { checkPassword, isPasswordStrong, PASSWORD_REQUIREMENTS_MESSAGE } from '@/lib/passwordPolicy';
import SpiderLogo from './SpiderLogo';
import {
  Loader2, Eye, EyeOff, RefreshCw, Smartphone, Mail, Lock, User, AtSign,
  ArrowLeft, Check, CircleCheck, KeyRound,
} from 'lucide-react';

/**
 * Auth surfaces — Login / Register / Forgot Password / Verify.
 *
 * Visual system is defined once in the token block below; each screen only
 * applies it. Structure on every card, top to bottom:
 *   logo 52 → SpidR wordmark → red eyebrow → (title/body) → fields → CTA
 *   → meta line → footer link
 *
 * Two rules that look like mistakes but aren't:
 *  - The card has NO drop shadow. Depth comes from the white hairline + the
 *    red top hairline + inputs sitting darker than the glass. A shadow smears
 *    while the card mouse-tilts.
 *  - Login and Register are one component with a `mode` flag, but there is no
 *    tab control — the footer link swaps them. The old red tab block competed
 *    with the primary CTA for the eye.
 */

// Terms + Privacy live on the public marketing site, not in-app. Opened in a
// new tab so a half-filled signup form is never lost; Electron routes
// target=_blank through setWindowOpenHandler to the system browser.
const LEGAL_URL = 'https://www.spidrapp.com/#privacy';

// ─── Design tokens ────────────────────────────────────────────────────────────
const CARD =
  'relative w-full bg-white/[0.03] backdrop-blur-[40px] rounded-3xl border border-white/10 p-8 sm:p-10 flex flex-col gap-6';
const EYEBROW = 'text-[11px] font-semibold tracking-[0.14em] uppercase text-red-500';
const TITLE = 'text-[22px] font-semibold tracking-[-0.01em] text-white leading-tight';
const BODY = 'text-sm leading-relaxed text-white/55';
const META = 'text-xs leading-snug text-white/35';
const LABEL = 'text-[11px] font-semibold tracking-[0.12em] uppercase text-white/55';
const BTN =
  'flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[15px] font-semibold transition-colors shadow-[0_0_20px_rgba(239,68,68,0.25)]';
const LINK = 'text-[13px] text-white/55 hover:text-white transition-colors';
const FOOT = 'text-center text-[13px] text-white/35';

// Card edge hairlines — white top, red accent over it, muted bottom.
function Edges() {
  return (
    <>
      <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/[0.16] to-transparent pointer-events-none" />
      <div className="absolute -top-px left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent pointer-events-none" />
      <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
    </>
  );
}

// Header block. Logo sits beside the wordmark+eyebrow stack rather than above
// it — the lockup reads as one mark, and the reclaimed vertical space lets the
// spider run much larger. Title/body (Forgot + Verify only) stay centred below.
function Head({ eyebrow, title, body }) {
  return (
    <div className="flex flex-col items-center gap-2.5 text-center">
      <div className="flex items-center gap-3.5">
        <SpiderLogo size={96} />
        <div className="flex flex-col items-start">
          {/* leading-[1.45] not leading-none — Le Chaudron Magique is a brush
              script whose ascenders overshoot a 1.0 line box and clip at the top. */}
          <div className="font-chaudron text-6xl leading-[1.45] tracking-[5px] text-white">
            Spid<span className="text-red-500">R</span>
          </div>
          {eyebrow && <div className={`${EYEBROW} mt-3 text-left`}>{eyebrow}</div>}
        </div>
      </div>
      {title && <div className={`${TITLE} mt-0.5`}>{title}</div>}
      {body && <div className={BODY}>{body}</div>}
    </div>
  );
}

// Labelled input. Leading icon turns red on focus alongside the ring.
function Field({
  label, icon: Icon, hint, trailing, inputRef, ...props
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL}>{label}</label>
      <div
        className={`flex items-center gap-2.5 h-[46px] px-3.5 rounded-xl bg-black/60 border transition-all ${
          focused
            ? 'border-red-500/70 shadow-[0_0_0_3px_rgba(239,68,68,0.12),inset_0_0_28px_rgba(239,68,68,0.07)]'
            : 'border-white/10'
        }`}
      >
        <Icon size={16} strokeWidth={1.75} className={focused ? 'text-red-500 shrink-0' : 'text-white/30 shrink-0'} />
        <input
          ref={inputRef}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-white placeholder-white/[0.22]"
          {...props}
        />
        {trailing}
      </div>
      {hint && <div className={META}>{hint}</div>}
    </div>
  );
}

function Checkbox({ checked, onChange, children }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5 text-[13px] text-white/55 hover:text-white/80 transition-colors text-left">
      <span
        className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
          checked ? 'bg-red-600 border-red-600' : 'bg-black/60 border-white/20'
        }`}
      >
        {checked && <Check size={12} strokeWidth={3} className="text-white" />}
      </span>
      <span>{children}</span>
    </button>
  );
}

function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-red-500/[0.22] bg-red-500/[0.06] px-4 py-3.5 text-[13px] text-red-300 text-center"
    >
      {children}
    </motion.div>
  );
}

// Live strength checklist under new-password fields (Register + Reset).
function PasswordChecklist({ password }) {
  return (
    <ul className="flex flex-col gap-1 -mt-2" aria-label="Password requirements">
      {checkPassword(password).map(({ id, label, passed }) => (
        <li key={id} className={`flex items-center gap-2 text-xs leading-snug transition-colors ${passed ? 'text-white/70' : 'text-white/35'}`}>
          <Check size={12} strokeWidth={3} className={passed ? 'text-red-500 shrink-0' : 'text-white/15 shrink-0'} />
          {label}
        </li>
      ))}
    </ul>
  );
}

// ─── Spider web background — Login only ───────────────────────────────────────
function WebLines() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
      {[...Array(12)].map((_, i) => {
        const rad = (i / 12) * Math.PI * 2;
        return <line key={i} x1="50%" y1="50%" x2={`${50 + 70 * Math.cos(rad)}%`} y2={`${50 + 70 * Math.sin(rad)}%`} stroke="#ef4444" strokeWidth="0.5" />;
      })}
      {[8, 18, 30, 45, 62].map(r => (
        <ellipse key={r} cx="50%" cy="50%" rx={`${r}%`} ry={`${r * 0.55}%`} fill="none" stroke="#ef4444" strokeWidth="0.4" />
      ))}
    </svg>
  );
}

// ─── Login / Register ─────────────────────────────────────────────────────────
function AuthGateway({ onForgot }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', username: '', full_name: '', discriminator: '' });
  const [remember, setRemember] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const isLogin = mode === 'login';

  const onMove = (e) => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setTilt({ x: -((e.clientY - r.top - r.height / 2) / 50), y: (e.clientX - r.left - r.width / 2) / 50 });
  };

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const swapMode = () => {
    setMode(m => (m === 'login' ? 'register' : 'login'));
    setError('');
  };

  const handle = async (e) => {
    e.preventDefault();
    if (!isLogin && !isPasswordStrong(form.password)) { setError(PASSWORD_REQUIREMENTS_MESSAGE); return; }
    if (!isLogin && !agreed) { setError('Please accept the Terms and Privacy Policy to continue.'); return; }
    setError(''); setLoading(true);
    try {
      isLogin
        ? await login(form.email, form.password)
        : await register({
            email: form.email,
            password: form.password,
            username: form.username,
            full_name: form.full_name,
            // Empty discriminator means "server, please pick one for me"
            discriminator: (form.discriminator || '').trim() || undefined,
          });
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

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw(v => !v)} className="text-white/30 hover:text-white/60 transition-colors shrink-0">
      {showPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
    </button>
  );

  return (
    <div className="perspective-[1200px] w-full max-w-md z-10" onMouseMove={onMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
      <div
        ref={cardRef}
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: 'preserve-3d', transition: 'transform 0.15s ease-out' }}
        className={CARD}
      >
        <Edges />
        <Head eyebrow={isLogin ? 'Welcome back to the web' : 'Join the web'} />

        <form onSubmit={handle} className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {!isLogin && (
              <motion.div
                key="reg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-4 overflow-hidden"
              >
                <Field
                  label="Display name" icon={User} type="text"
                  placeholder="What should we call you?"
                  value={form.full_name} onChange={set('full_name')}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <Field
            label="Email" icon={Mail} type="email" required
            placeholder="you@example.com"
            value={form.email} onChange={set('email')}
          />

          <Field
            label="Password" icon={Lock} required
            type={showPw ? 'text' : 'password'}
            placeholder={isLogin ? '••••••••••' : 'At least 8 characters'}
            value={form.password} onChange={set('password')}
            trailing={eyeBtn}
          />
          {!isLogin && <PasswordChecklist password={form.password} />}

          <AnimatePresence initial={false}>
            {!isLogin && (
              <motion.div
                key="alias"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-4 overflow-hidden"
              >
                {/* Alias — the API needs @username#tag, so this takes the
                    single optional slot rather than adding a fifth field.
                    One glass container hosts both inputs; `Field`'s single
                    input can't express the #tag split. */}
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>Your alias</label>
                  <div className="flex items-center gap-2 h-[46px] px-3.5 rounded-xl bg-black/60 border border-white/10 transition-all focus-within:border-red-500/70 focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.12),inset_0_0_28px_rgba(239,68,68,0.07)]">
                    <AtSign size={16} strokeWidth={1.75} className="text-white/30 shrink-0" />
                    <input
                      type="text" placeholder="username" required={!isLogin}
                      className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-white placeholder-white/[0.22]"
                      value={form.username} onChange={set('username')} aria-label="Username"
                    />
                    <span className="text-white/25 text-sm select-none shrink-0">#</span>
                    <input
                      type="text" placeholder="abcd" maxLength={4} pattern="[a-z0-9]{4}"
                      title="Optional — 4 lowercase letters or numbers. Leave blank to auto-assign."
                      className="w-14 bg-transparent border-0 outline-none text-sm text-white text-center tracking-[0.2em] placeholder-white/[0.22]"
                      value={form.discriminator}
                      onChange={(e) => setForm(f => ({ ...f, discriminator: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) }))}
                      aria-label="4-character tag"
                    />
                  </div>
                  <div className={META}>Leave the tag blank and we'll pick one for you.</div>
                </div>

                <Checkbox checked={agreed} onChange={setAgreed}>
                  I agree to the{' '}
                  <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Terms</a>
                  {' '}and{' '}
                  <a href={LEGAL_URL} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Privacy Policy</a>
                </Checkbox>
              </motion.div>
            )}
          </AnimatePresence>

          {isLogin && (
            <div className="flex items-center justify-between gap-3">
              <Checkbox checked={remember} onChange={setRemember}>Remember me</Checkbox>
              <button type="button" onClick={onForgot} className={LINK}>Forgot password?</button>
            </div>
          )}

          <ErrorNote>{error}</ErrorNote>

          <button type="submit" disabled={loading} className={BTN}>
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> {isLogin ? 'Signing in…' : 'Creating account…'}</>
              : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className={`${META} text-center`}>
          {isLogin
            ? "We'll send a 6-digit code to your email, or use your authenticator app."
            : "We'll send a verification code to your email."}
        </div>

        <div className={FOOT}>
          {isLogin ? 'New to Spidr? ' : 'Already have an account? '}
          <button type="button" onClick={swapMode} className="text-white font-medium hover:underline">
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Verify Account / 2FA ─────────────────────────────────────────────────────
function OTPScreen({ email, mode, onBack }) {
  const { verifyOTP, resendOTP } = useAuth();
  const [method, setMethod] = useState('email'); // 'email' | 'totp'
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState(null); // shows OTP in dev when no email configured
  const refs = useRef([]);

  useEffect(() => { refs.current[0]?.focus(); }, [method]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
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
    if (val && i < 5) refs.current[i + 1]?.focus();
    if (val && i === 5 && next.every(Boolean)) submitCode(next.join(''));
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (p.length === 6) { setDigits(p.split('')); refs.current[5]?.focus(); submitCode(p); }
  };

  const submitCode = async (code) => {
    setError(''); setLoading(true);
    try {
      await verifyOTP(email, code);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Invalid or expired code');
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    try {
      await resendOTP(email);
      setResent(true); setCountdown(60); setError('');
      setDevOtp(null);
      setTimeout(async () => {
        try { const d = await auth.devGetOtp(email); if (d?.otp) setDevOtp(d.otp); } catch { /* ignore */ }
      }, 500);
      setTimeout(() => setResent(false), 3000);
    } catch (err) { setError(err?.response?.data?.error || 'Could not resend'); }
  };

  // Mask rule: first char + •• + domain.
  const masked = email.replace(/^(.)([^@]*)(@.*)$/, (_, a, _b, c) => `${a}••${c}`);
  const complete = digits.join('').length === 6;

  return (
    <div className="w-full max-w-md z-10">
      <div className={CARD}>
        <Edges />
        <Head eyebrow="Almost in" title={mode === 'verify' ? 'Check your email' : 'Two-factor required'} />

        {method === 'email' ? (
          <div className="flex flex-col items-center gap-2.5 -mt-2">
            <div className={`${BODY} text-center`}>We sent a 6-digit code to</div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 border border-white/10 text-xs text-white/55">
              <Mail size={13} strokeWidth={1.75} className="text-white/40" />
              <span className="text-white font-medium">{masked}</span>
            </div>
          </div>
        ) : (
          <div className={`${BODY} text-center -mt-2`}>Enter the code from your authenticator app.</div>
        )}

        {/* Method switcher — only on login 2FA, not account verification */}
        {mode === 'login' && (
          <div className="flex gap-2">
            {[['email', Mail, 'Email code'], ['totp', Smartphone, 'Authenticator']].map(([m, Icon, label]) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setDigits(['', '', '', '', '', '']); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl border text-[13px] transition-colors ${
                  method === m ? 'bg-red-600/[0.12] border-red-500/40 text-white' : 'bg-black/60 border-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                <Icon size={14} strokeWidth={1.75} /> {label}
              </button>
            ))}
          </div>
        )}

        {/* Dev mode banner — shows OTP when no email is configured */}
        {devOtp && method === 'email' && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 items-start rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3.5"
          >
            <KeyRound size={18} strokeWidth={1.75} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <div className="text-[13px] font-medium text-white">Dev mode — no email configured</div>
              <div className={META}>
                Your code: <span className="text-amber-300 text-base font-semibold tracking-[0.3em]">{devOtp}</span>
              </div>
            </div>
          </motion.div>
        )}

        <form
          onSubmit={e => { e.preventDefault(); if (!complete) { setError('Enter all 6 digits'); return; } submitCode(digits.join('')); }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>Verification code</label>
            <div className="flex justify-between gap-2" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i} ref={el => refs.current[i] = el}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKey(i, e)}
                  className={`w-[50px] h-[58px] rounded-xl bg-black/60 border text-white text-center text-2xl font-bold outline-none transition-all
                    focus:border-red-500/70 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12),inset_0_0_22px_rgba(239,68,68,0.07)]
                    ${d ? 'border-red-500/60' : 'border-white/10'}`}
                />
              ))}
            </div>
          </div>

          <ErrorNote>{error}</ErrorNote>

          <button type="submit" disabled={loading || !complete} className={BTN}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : 'Verify'}
          </button>
        </form>

        <div className="flex items-center justify-between gap-3">
          <button onClick={onBack} className={`${LINK} inline-flex items-center gap-1.5`}>
            <ArrowLeft size={14} strokeWidth={1.75} /> Wrong email?
          </button>
          {method === 'email' && (
            resent ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-red-400">
                <CircleCheck size={13} strokeWidth={1.75} /> Sent
              </span>
            ) : countdown > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-white/35">
                <RefreshCw size={13} strokeWidth={1.75} /> Resend in {countdown}s
              </span>
            ) : (
              <button onClick={handleResend} className={`${LINK} inline-flex items-center gap-1.5`}>
                <RefreshCw size={13} strokeWidth={1.75} /> Resend code
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
function ForgotPassword({ onBack }) {
  const [step, setStep] = useState('identify'); // identify | verify | reset
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState('email');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
    if (!isPasswordStrong(newPw)) { setError(PASSWORD_REQUIREMENTS_MESSAGE); return; }
    setError(''); setLoading(true);
    try {
      await auth.overrideConfirm(token, newPw);
      setDone(true);
      setTimeout(onBack, 2500);
    } catch (err) { setError(err?.response?.data?.error || 'Reset failed'); }
    setLoading(false);
  };

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw(v => !v)} className="text-white/30 hover:text-white/60 transition-colors shrink-0">
      {showPw ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
    </button>
  );

  const bodyCopy = {
    identify: "Enter the email on your account and we'll send a recovery code.",
    verify: method === 'totp'
      ? 'Enter the code from your authenticator app.'
      : 'Enter the 6-digit code we just sent you.',
    reset: 'Identity confirmed. Choose a new password.',
  }[step];

  return (
    <div className="w-full max-w-md z-10">
      <div className={CARD}>
        <Edges />
        <Head eyebrow="Lost your thread?" title="Reset your password" body={bodyCopy} />

        {done ? (
          <div className="flex gap-3 items-start rounded-xl border border-red-500/[0.22] bg-red-500/[0.06] px-4 py-3.5">
            <CircleCheck size={18} strokeWidth={1.75} className="text-red-500 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <div className="text-sm font-medium text-white">Password updated</div>
              <div className={META}>Taking you back to sign in…</div>
            </div>
          </div>
        ) : (
          <>
            {step === 'identify' && (
              <form onSubmit={identify} className="flex flex-col gap-4">
                <Field
                  label="Email" icon={Mail} type="email" required
                  placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
                <ErrorNote>{error}</ErrorNote>
                <button type="submit" disabled={loading} className={BTN}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Send recovery code'}
                </button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={verify} className="flex flex-col gap-4">
                <div className="flex gap-3 items-start rounded-xl border border-red-500/[0.22] bg-red-500/[0.06] px-4 py-3.5">
                  <CircleCheck size={18} strokeWidth={1.75} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <div className="text-sm font-medium text-white">Code sent — check your inbox</div>
                    <div className={META}>It's valid for 15 minutes.</div>
                  </div>
                </div>
                <Field
                  label="Recovery code" icon={KeyRound} type="text" required
                  inputMode="numeric" maxLength={6} placeholder="000000"
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <ErrorNote>{error}</ErrorNote>
                <button type="submit" disabled={loading || code.length < 6} className={BTN}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : 'Enter the code'}
                </button>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={reset} className="flex flex-col gap-4">
                <Field
                  label="New password" icon={Lock} required
                  type={showPw ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={newPw} onChange={e => setNewPw(e.target.value)}
                  trailing={eyeBtn}
                />
                <PasswordChecklist password={newPw} />
                <ErrorNote>{error}</ErrorNote>
                <button type="submit" disabled={loading || !isPasswordStrong(newPw)} className={BTN}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save new password'}
                </button>
              </form>
            )}
          </>
        )}

        <div className="flex justify-center">
          <button onClick={onBack} className={`${LINK} inline-flex items-center gap-1.5`}>
            <ArrowLeft size={14} strokeWidth={1.75} /> Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { pendingEmail, otpMode, cancelOTP } = useAuth();
  const [showForgot, setShowForgot] = useState(false);

  // Web-line motif on the login screen only; the other states get the glow alone.
  const showMotif = !showForgot && !pendingEmail;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {showMotif && <WebLines />}
      <div className="absolute left-1/2 top-[46%] w-[960px] h-[960px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.13) 0%, rgba(220,38,38,0.05) 32%, rgba(0,0,0,0) 62%)' }} />

      <AnimatePresence mode="wait">
        {showForgot ? (
          <motion.div key="forgot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }} className="w-full max-w-md px-4">
            <ForgotPassword onBack={() => setShowForgot(false)} />
          </motion.div>
        ) : pendingEmail ? (
          <motion.div key="otp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }} className="w-full max-w-md px-4">
            <OTPScreen email={pendingEmail} mode={otpMode} onBack={cancelOTP} />
          </motion.div>
        ) : (
          <motion.div key="auth" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }} className="w-full max-w-md px-4">
            <AuthGateway onForgot={() => setShowForgot(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
