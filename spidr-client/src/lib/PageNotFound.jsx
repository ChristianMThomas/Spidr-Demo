import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Home, LogIn } from 'lucide-react';
import { auth } from '@/api/apiClient';

/**
 * 404 — "lost in the web".
 *
 * Fully code-drawn (no image assets): a procedural SVG orb-web fills the
 * viewport with one visibly severed sector — two snapped strands dangle where
 * the ring should close — and a vector spider descends on its silk line into
 * the gap. Ember particles drift up, the whole web breathes with a slow
 * parallax tied to the cursor, and a terminal trace prints the path that
 * dead-ended here. Everything respects prefers-reduced-motion.
 */

// ── Procedural web geometry ─────────────────────────────────────────────────
// 12 spokes, 6 polygonal rings, centered above the headline. The sector
// between spokes BROKEN_A→BROKEN_B is omitted from every outer ring — that's
// the hole the user "fell through" — and replaced with two dangling threads.
const CX = 500;
const CY = 340;
const SPOKES = 12;
const RINGS = [70, 130, 195, 265, 340, 420];
const BROKEN_A = 8; // spoke indices bounding the torn sector
const BROKEN_B = 9;

const spokeAngle = (i) => (i * 2 * Math.PI) / SPOKES - Math.PI / 2;
const pt = (i, r) => ({
  x: CX + r * Math.cos(spokeAngle(i)),
  y: CY + r * Math.sin(spokeAngle(i)),
});

function ringPath(r, skipBroken) {
  let d = '';
  for (let i = 0; i < SPOKES; i++) {
    const a = pt(i, r);
    const b = pt((i + 1) % SPOKES, r);
    if (skipBroken && i === BROKEN_A) continue; // the torn sector
    // Sag each segment toward the center a touch so rings read as silk, not wire.
    const mx = (a.x + b.x) / 2 + (CX - (a.x + b.x) / 2) * 0.06;
    const my = (a.y + b.y) / 2 + (CY - (a.y + b.y) / 2) * 0.06;
    d += `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)} `;
  }
  return d;
}

// Dangling thread stubs at the torn edges of the two outermost rings.
function danglePath(spokeIndex, r, len, drift) {
  const p = pt(spokeIndex, r);
  return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} q ${drift} ${len * 0.45} ${drift * 0.4} ${len}`;
}

const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  size: 2 + ((i * 7) % 3),
  delay: `${(i * 1.7) % 12}s`,
  duration: `${14 + ((i * 3) % 9)}s`,
  red: i % 3 === 0,
}));

export default function PageNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const attemptedPath = location.pathname + (location.search || '');

  const { data: authData } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const user = await auth.me();
        return { user, isAuthenticated: true };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const isAuthenticated = !!authData?.isAuthenticated;
  const goHome = () => navigate(isAuthenticated ? '/home' : '/');
  const goBack = () => (window.history.length > 1 ? navigate(-1) : goHome());

  // Cursor parallax — the web layer drifts a few px against the pointer so the
  // scene has depth. Driven through rAF so mousemove never floods layout.
  const webRef = useRef(null);
  const target = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (reduceMotion) return;
    let raf;
    let current = { x: 0, y: 0 };
    const onMove = (e) => {
      target.current = {
        x: (e.clientX / window.innerWidth - 0.5) * -18,
        y: (e.clientY / window.innerHeight - 0.5) * -12,
      };
    };
    const tick = () => {
      current = {
        x: current.x + (target.current.x - current.x) * 0.06,
        y: current.y + (target.current.y - current.y) * 0.06,
      };
      if (webRef.current) {
        webRef.current.style.transform = `translate(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  // Terminal trace types itself out.
  const traceLine = `> trace ${attemptedPath} :: no page exist LMAO`;
  const [typed, setTyped] = useState(reduceMotion ? traceLine : '');
  useEffect(() => {
    if (reduceMotion) return;
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(traceLine.slice(0, i));
      if (i >= traceLine.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptedPath, reduceMotion]);

  return (
    <div role="alert" aria-live="polite" className="min-h-screen w-full relative overflow-hidden bg-black text-white">
      <style>{`
        @keyframes spidr404-ember {
          0%   { transform: translateY(0) scale(1);      opacity: 0; }
          8%   { opacity: .7; }
          92%  { opacity: .15; }
          100% { transform: translateY(-105vh) scale(.4); opacity: 0; }
        }
        @keyframes spidr404-sway    { 0%,100% { transform: rotate(-2.2deg); } 50% { transform: rotate(2.2deg); } }
        @keyframes spidr404-descend { 0%,100% { transform: translateY(0); }   50% { transform: translateY(16px); } }
        @keyframes spidr404-dangle  { 0%,100% { transform: rotate(-4deg); }   50% { transform: rotate(5deg); } }
        @keyframes spidr404-shimmer { 0%,100% { opacity: .45; } 50% { opacity: .9; } }
        @keyframes spidr404-blink   { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .spidr404-anim, .spidr404-anim * { animation: none !important; }
        }
      `}</style>

      {/* ── Atmosphere: red pulse behind the wound in the web, then vignette ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 30%, rgba(220,38,38,0.14), transparent 65%),' +
            'radial-gradient(ellipse 90% 70% at 50% 110%, rgba(127,29,29,0.18), transparent 60%)',
        }}
      />

      {/* ── The web ── */}
      <div ref={webRef} className="pointer-events-none absolute inset-0 will-change-transform">
        <svg
          viewBox="0 0 1000 900"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full spidr404-anim"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="spidr404-silk" cx="50%" cy="38%" r="65%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
              <stop offset="70%" stopColor="rgba(255,255,255,0.10)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
            </radialGradient>
          </defs>

          {/* Spokes — the two bounding the torn sector stop short and glow red. */}
          {Array.from({ length: SPOKES }, (_, i) => {
            const torn = i === BROKEN_A || i === BROKEN_B;
            const end = pt(i, torn ? RINGS[3] : 560);
            return (
              <line
                key={`spoke-${i}`}
                x1={CX} y1={CY} x2={end.x} y2={end.y}
                stroke={torn ? 'rgba(239,68,68,0.35)' : 'url(#spidr404-silk)'}
                strokeWidth={torn ? 1.2 : 1}
              />
            );
          })}

          {/* Rings — inner three intact, outer three torn open. */}
          {RINGS.map((r, ri) => (
            <path
              key={`ring-${r}`}
              d={ringPath(r, ri >= 3)}
              fill="none"
              stroke="url(#spidr404-silk)"
              strokeWidth={ri < 2 ? 1.2 : 1}
              style={{ animation: `spidr404-shimmer ${7 + ri * 2}s ease-in-out infinite`, animationDelay: `${ri * 0.9}s` }}
            />
          ))}

          {/* Snapped strands dangling from the torn edges. */}
          {[
            danglePath(BROKEN_A, RINGS[3], 60, 14),
            danglePath(BROKEN_A, RINGS[4], 90, 20),
            danglePath(BROKEN_B, RINGS[3], 52, -12),
            danglePath(BROKEN_B, RINGS[4], 78, -18),
          ].map((d, i) => (
            <path
              key={`dangle-${i}`}
              d={d}
              fill="none"
              stroke="rgba(239,68,68,0.45)"
              strokeWidth="1"
              strokeLinecap="round"
              style={{
                transformOrigin: `${pt(i < 2 ? BROKEN_A : BROKEN_B, RINGS[3 + (i % 2)]).x}px ${pt(i < 2 ? BROKEN_A : BROKEN_B, RINGS[3 + (i % 2)]).y}px`,
                animation: `spidr404-dangle ${3.4 + i * 0.7}s ease-in-out infinite`,
              }}
            />
          ))}

          {/* Dew nodes where inner rings meet spokes — tiny points of light. */}
          {RINGS.slice(0, 3).flatMap((r, ri) =>
            Array.from({ length: SPOKES }, (_, i) => {
              const p = pt(i, r);
              return (
                <circle
                  key={`dew-${ri}-${i}`}
                  cx={p.x} cy={p.y} r={ri === 0 ? 1.6 : 1.1}
                  fill={(i + ri) % 5 === 0 ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.35)'}
                  style={{ animation: `spidr404-shimmer ${4 + ((i * 13 + ri * 7) % 5)}s ease-in-out infinite`, animationDelay: `${(i * 0.37 + ri) % 4}s` }}
                />
              );
            })
          )}
        </svg>
      </div>

      {/* ── Embers drifting up through the scene ── */}
      <div className="pointer-events-none absolute inset-0 spidr404-anim" aria-hidden="true">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: e.left,
              bottom: '-2vh',
              width: e.size,
              height: e.size,
              background: e.red ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.35)',
              boxShadow: e.red ? '0 0 8px rgba(239,68,68,0.8)' : '0 0 6px rgba(255,255,255,0.4)',
              animation: `spidr404-ember ${e.duration} linear infinite`,
              animationDelay: e.delay,
            }}
          />
        ))}
      </div>

      {/* ── Content ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-4 sm:px-6 py-16"
      >
        {/* Headline — the spider descends into the first 0. */}
        <h1 className="relative font-black tracking-tighter leading-none select-none" style={{ fontSize: 'clamp(6rem,20vw,15rem)' }}>
          <span className="text-red-600 drop-shadow-[0_0_35px_rgba(220,38,38,0.45)]">4</span>
          <span className="relative inline-block text-zinc-200/90">
            0
            {/* Silk line + spider, anchored to the zero's center. */}
            <span
              className="absolute left-1/2 -translate-x-1/2 spidr404-anim"
              style={{ top: '-42vh', height: '42vh', pointerEvents: 'none' }}
              aria-hidden="true"
            >
              <span className="block h-full w-px mx-auto" style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.5))' }} />
            </span>
            <span
              className="absolute left-1/2 top-1/2 spidr404-anim"
              style={{ transform: 'translate(-50%, -58%)', animation: 'spidr404-descend 5.5s ease-in-out infinite' }}
              aria-hidden="true"
            >
              <SpiderGlyph />
            </span>
          </span>
          <span className="text-zinc-200/90">4</span>
        </h1>

        <h2 className="mt-3 font-mono font-bold text-red-500" style={{ fontSize: 'clamp(0.75rem,1.8vw,1.05rem)', letterSpacing: '0.55em' }}>
          SIGNAL LOST IN THE WEB
        </h2>

        <p className="mt-6 text-zinc-300 max-w-xl leading-relaxed" style={{ fontSize: 'clamp(1rem,2.2vw,1.35rem)' }}>
          Oops — you got lost in the web.
          <br />
          <span className="text-zinc-500">This can happen sometimes.</span>
        </p>

        {/* Terminal trace */}
        <div className="mt-8 w-full max-w-2xl rounded-lg border border-white/10 bg-black/60 backdrop-blur-sm px-4 py-3 text-left overflow-x-auto">
          <p className="font-mono text-[11px] sm:text-xs text-zinc-500 whitespace-nowrap">
            <span className="text-red-500/90">{typed}</span>
            <span className="inline-block w-[7px] h-[13px] ml-0.5 align-middle bg-red-500/80 spidr404-anim" style={{ animation: 'spidr404-blink 1.1s step-end infinite' }} />
          </p>
          {authData?.user?.role === 'admin' && (
            <p className="mt-1.5 font-mono text-[10px] text-zinc-600">
              admin note: this route isn't wired up in pages.config.js
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-mono text-xs font-bold tracking-[0.2em] text-zinc-200 bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <ArrowLeft className="w-4 h-4" />
            GO BACK
          </button>

          <button
            onClick={goHome}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-mono text-xs font-bold tracking-[0.2em] text-white bg-red-600 hover:bg-red-500 transition-colors shadow-[0_0_30px_-6px_rgba(220,38,38,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Home className="w-4 h-4" />
            {isAuthenticated ? 'RETURN HOME' : 'BACK TO LANDING'}
          </button>

          {!isAuthenticated && (
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-mono text-xs font-bold tracking-[0.2em] text-red-300 bg-red-950/30 border border-red-900/60 hover:bg-red-950/60 hover:text-red-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <LogIn className="w-4 h-4" />
              SIGN IN
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Vector spider — body, mandibles, eight jointed legs, red eyes ───────────
function SpiderGlyph() {
  return (
    <svg
      width="clamp(54px, 8vw, 96px)"
      height="clamp(54px, 8vw, 96px)"
      viewBox="0 0 100 100"
      className="spidr404-anim drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)]"
      style={{ animation: 'spidr404-sway 6s ease-in-out infinite', transformOrigin: '50% 0%' }}
    >
      <g stroke="#18181b" strokeWidth="3.4" strokeLinecap="round" fill="none">
        {/* Legs — four per side, jointed. */}
        <path d="M42 46 Q24 38 14 22" /><path d="M40 52 Q20 50 8 40" />
        <path d="M40 58 Q20 62 10 76" /><path d="M43 63 Q30 74 26 88" />
        <path d="M58 46 Q76 38 86 22" /><path d="M60 52 Q80 50 92 40" />
        <path d="M60 58 Q80 62 90 76" /><path d="M57 63 Q70 74 74 88" />
      </g>
      {/* Abdomen + cephalothorax */}
      <ellipse cx="50" cy="62" rx="15" ry="18" fill="#111113" />
      <ellipse cx="50" cy="62" rx="15" ry="18" fill="none" stroke="#27272a" strokeWidth="1" />
      {/* Red hourglass marking */}
      <path d="M50 52 l4.5 7 -4.5 7 -4.5 -7 z" fill="#dc2626" opacity="0.9" />
      <circle cx="50" cy="40" r="9.5" fill="#18181b" />
      {/* Eyes */}
      <circle cx="46.5" cy="38" r="2" fill="#ef4444" />
      <circle cx="53.5" cy="38" r="2" fill="#ef4444" />
      <circle cx="46" cy="37.4" r="0.7" fill="#fca5a5" />
      <circle cx="53" cy="37.4" r="0.7" fill="#fca5a5" />
    </svg>
  );
}
