import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<(HTMLDivElement | null)[]>([]);

  // Entrance: tilt in from flat
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.opacity = "0";
    canvas.style.transform = "rotateX(90deg) rotateZ(-25deg) scale(0.8)";

    const entrance = setTimeout(() => {
      canvas.style.transition = "all 2.5s cubic-bezier(0.16, 1, 0.3, 1)";
      canvas.style.opacity = "1";
      canvas.style.transform = "rotateX(55deg) rotateZ(-25deg) scale(1)";
    }, 300);

    return () => clearTimeout(entrance);
  }, []);

  // Mouse parallax — layers shift at different speeds to simulate depth
  useEffect(() => {
    const canvas = canvasRef.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;

      if (canvas) {
        canvas.style.transition = "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)";
        canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;
      }

      layersRef.current.forEach((layer, i) => {
        if (!layer) return;
        const speed = (i + 1) * 0.5;
        layer.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        layer.style.transition = "transform 0.5s ease";
      });
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  return (
    <>
      <style>{`
        @keyframes spidr-glow-pulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        @keyframes spidr-scanline {
          from { background-position-y: 0px; }
          to { background-position-y: 100vh; }
        }
        .spidr-layer-glow { animation: spidr-glow-pulse 8s ease-in-out infinite; }
        .spidr-layer-scan { animation: spidr-scanline 12s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .spidr-layer-glow, .spidr-layer-scan { animation: none; }
        }
      `}</style>

      <section className="relative min-h-dvh overflow-hidden">
        {/* SVG grain filter */}
        <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
          <filter id="spidr-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </svg>
        <div
          className="absolute inset-0 pointer-events-none z-[5]"
          style={{ filter: "url(#spidr-grain)", opacity: 0.1 }}
          aria-hidden="true"
        />

        {/* 3D canvas viewport — perspective lives here */}
        <div
          className="absolute inset-0 z-[1] flex items-center justify-center"
          style={{ perspective: "2000px" }}
          aria-hidden="true"
        >
          <div
            ref={canvasRef}
            className="relative"
            style={{ width: "900px", height: "600px" }}
          >
            {/* Layer 1: dot grid */}
            <div
              ref={(el) => { layersRef.current[0] = el; }}
              className="absolute inset-0"
              style={{
                zIndex: 1,
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            />

            {/* Layer 2: crimson radial glow */}
            <div
              ref={(el) => { layersRef.current[1] = el; }}
              className="spidr-layer-glow absolute inset-0"
              style={{
                zIndex: 2,
                background: "radial-gradient(ellipse at 50% 50%, rgba(139,0,0,0.65) 0%, rgba(90,0,16,0.3) 35%, transparent 70%)",
                mixBlendMode: "screen",
                border: "1px solid rgba(139,0,0,0.1)",
              }}
            />

            {/* Layer 3: scanline sweep */}
            <div
              ref={(el) => { layersRef.current[2] = el; }}
              className="spidr-layer-scan absolute inset-0"
              style={{
                zIndex: 3,
                backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 3px, rgba(196,30,58,0.05) 3px, rgba(196,30,58,0.05) 4px)",
                border: "1px solid rgba(196,30,58,0.06)",
              }}
            />

            {/* Topo contour overlay */}
            <div
              className="absolute pointer-events-none"
              style={{
                zIndex: 4,
                width: "200%",
                height: "200%",
                top: "-50%",
                left: "-50%",
                backgroundImage: "repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 60px, rgba(139,0,0,0.07) 61px, transparent 62px)",
              }}
            />
          </div>
        </div>

        {/* ── DESKTOP: editorial grid overlay ─────────────────────────── */}
        <div
          className="hidden md:grid absolute inset-0 z-10 p-8 pt-24 pointer-events-none"
          style={{
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "auto 1fr auto",
          }}
        >
          {/* Top-left brand tag */}
          <motion.div
            className="font-mono text-xs text-white font-bold tracking-widest self-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            SPIDR_CORE
          </motion.div>

          {/* Top-right metadata */}
          <motion.div
            className="text-right self-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="font-mono text-[0.6rem] text-[#C41E3A] tracking-widest">
              PRE-LAUNCH / AUGUST 2026
            </div>
            <div
              className="font-mono text-[0.6rem] tracking-widest mt-0.5"
              style={{ color: "rgba(196,30,58,0.55)" }}
            >
              PLATFORMS: ALL
            </div>
          </motion.div>

          {/* Headline — center row, staggered word entrance */}
          <motion.h1
            className="font-black text-white tracking-tight"
            style={{
              gridColumn: "1 / -1",
              fontSize: "clamp(3.5rem, 10vw, 9rem)",
              lineHeight: 0.85,
              alignSelf: "center",
            }}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1, delayChildren: 0.7 } },
            }}
          >
            {["WHERE", "EVERYONE", "BELONGS"].map((word) => (
              <motion.div
                key={word}
                variants={{
                  hidden: { opacity: 0, y: 50 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
              >
                {word}
              </motion.div>
            ))}
          </motion.h1>

          {/* Bottom row — tagline left, CTA right */}
          <motion.div
            className="flex justify-between items-end pointer-events-auto"
            style={{ gridColumn: "1 / -1" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <div>
              <p className="font-mono text-[0.7rem] text-zinc-500 tracking-widest mb-2">
                VOICE · AI TOOLS · BOT LAB · THE WEB FEED
              </p>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#C41E3A] rounded-full animate-pulse" />
                <span className="font-mono text-[0.6rem] text-zinc-600 tracking-wide">
                  LAUNCHING SOON — JOIN THE WAITLIST
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <button
                onClick={() =>
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
                }
                className="font-mono text-[0.6rem] text-zinc-600 hover:text-zinc-400 tracking-widest transition-colors cursor-pointer"
              >
                EXPLORE FEATURES ↓
              </button>
            </div>
          </motion.div>
        </div>

        {/* ── MOBILE: centered fallback ────────────────────────────────── */}
        <div className="md:hidden flex flex-col items-center justify-center min-h-dvh px-6 pt-24 pb-16 text-center relative z-10">
          <motion.div
            className="inline-flex items-center gap-2 bg-[#8B0000]/15 border border-[#8B0000]/40 rounded-full px-4 py-1.5 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="w-2 h-2 bg-[#C41E3A] rounded-full animate-pulse" />
            <span className="text-[#C41E3A] text-sm font-semibold tracking-wide">
              Pre-Launch Beta
            </span>
          </motion.div>

          <motion.h1
            className="font-black text-white tracking-tight mb-6"
            style={{ fontSize: "clamp(2.8rem, 14vw, 5rem)", lineHeight: 0.88 }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            WHERE<br />EVERYONE<br />BELONGS
          </motion.h1>

          <motion.p
            className="text-zinc-400 text-base mb-10 max-w-xs leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            Voice, AI tools, bots, and a social feed — built for every crew.
          </motion.p>

          <motion.div
            className="flex flex-col gap-3 w-full max-w-xs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <button
              onClick={() =>
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
              }
              className="border border-zinc-700 text-white px-8 py-4 font-bold text-base flex items-center justify-center gap-2 min-h-[52px] cursor-pointer hover:border-[#8B0000] transition-colors"
            >
              Explore Features
              <ArrowRight size={16} className="opacity-50" />
            </button>
          </motion.div>

          <motion.p
            className="mt-8 text-zinc-600 text-xs font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Free waitlist, no credit card required. We’ll notify you when the beta is live!
          </motion.p>
        </div>

        {/* Scroll indicator (desktop only) */}
        <motion.div
          className="hidden md:block absolute z-10"
          style={{
            left: "calc(50% - 0.5px)",
            bottom: "2rem",
            width: "1px",
            height: "60px",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)",
            transformOrigin: "top center",
          }}
          animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.4, 0.6, 1],
          }}
          aria-hidden="true"
        />
      </section>
    </>
  );
}
