import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Zap, CheckCircle, Users, AlertCircle, Mail } from "lucide-react";
import { beta } from "@/api/apiClient";

const BETA_CAP = 50;

function AnimatedNumber({ value }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prevRef.current = value;
  }, [value]);

  return <span>{displayed}</span>;
}

export default function BetaSignupSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, margin: "-80px" });

  const [status, setStatus] = useState({ count: 0, spotsLeft: BETA_CAP, isFull: false, cap: BETA_CAP });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  // Poll live count every 15 seconds
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await beta.status();
        if (!cancelled) setStatus(data);
      } catch { /* silently ignore — counter stays at last known value */ }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (phase === "loading" || phase === "success") return;
    setPhase("loading");
    setErrorMsg("");

    try {
      const result = await beta.signup(email.trim(), name.trim());
      setStatus((prev) => ({
        ...prev,
        count: prev.count + 1,
        spotsLeft: result.spotsLeft,
        isFull: result.isFull,
      }));
      setPhase("success");
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setPhase("error");
    }
  };

  const spotsLeft = status.spotsLeft;
  const isFull = status.isFull;
  const pct = Math.round(((BETA_CAP - spotsLeft) / BETA_CAP) * 100);

  // Urgency color: green → amber → red
  const urgencyColor =
    spotsLeft > 20 ? "#22c55e" : spotsLeft > 10 ? "#f59e0b" : "#FF3333";

  return (
    <section id="beta" className="py-24 px-6 relative overflow-hidden">
      {/* Background glow */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${urgencyColor}18 0%, transparent 65%)`,
          filter: "blur(80px)",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        ref={ref}
        className="max-w-3xl mx-auto relative z-10"
        initial={{ opacity: 0, y: 60 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <div className="bg-[#111] rounded-[2.5rem] border-2 border-[#FF3333]/25 overflow-hidden relative p-10 md:p-14">
          {/* Pulsing inner glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 3.5, repeat: Infinity }}
            style={{ borderRadius: "2.5rem", boxShadow: "inset 0 0 50px rgba(255,51,51,0.35)" }}
          />

          {/* Corner accents */}
          {[{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, right: 0 }, { bottom: 0, left: 0 }].map((pos, i) => (
            <div key={i} className="absolute w-16 h-16 animate-spin" style={{ ...pos, animationDuration: "25s" }}>
              <div className="w-full h-full border-t-2 border-l-2 border-[#FF3333]/25 rounded-tl-2xl" />
            </div>
          ))}

          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-[#FF3333]/10 border border-[#FF3333]/30 rounded-full px-4 py-1.5 mb-5">
                <motion.span
                  className="w-2 h-2 rounded-full bg-[#FF3333] block"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="text-[#FF3333] text-sm font-semibold tracking-wide uppercase">
                  {isFull ? "Beta Full" : "Limited Beta"}
                </span>
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-white mb-3">
                {isFull ? "Beta is closed." : "Claim your spot."}
              </h2>
              <p className="text-gray-400 text-lg">
                {isFull
                  ? "All 50 beta spots have been claimed. Stay tuned for the public launch."
                  : "Be one of the first 50 to experience Spidr before anyone else."}
              </p>
            </div>

            {/* Live counter */}
            <div className="flex flex-col items-center mb-8">
              <motion.div
                key={spotsLeft}
                className="text-7xl md:text-8xl font-black mb-1 tabular-nums"
                style={{ color: urgencyColor, textShadow: `0 0 40px ${urgencyColor}60` }}
                animate={{ scale: [1.05, 1] }}
                transition={{ duration: 0.35 }}
              >
                <AnimatedNumber value={spotsLeft} />
              </motion.div>
              <p className="text-white/70 text-lg font-medium">
                {isFull ? "spots — all claimed" : `spot${spotsLeft === 1 ? "" : "s"} left out of ${BETA_CAP}`}
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-sm mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: urgencyColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <p className="text-white/40 text-xs mt-1.5 tabular-nums">
                {status.count} / {BETA_CAP} claimed
              </p>
            </div>

            {/* Signup form / states */}
            <AnimatePresence mode="wait">
              {phase === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 border border-green-500/40 mb-4"
                  >
                    <CheckCircle className="text-green-400" size={32} />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-1">You're in!</h3>
                  <p className="text-gray-400">We'll reach out when your beta access is ready.</p>
                </motion.div>
              ) : isFull ? (
                <motion.div
                  key="full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-6"
                >
                  <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-6 py-3 text-gray-400 font-medium">
                    <Users size={18} />
                    <span>All spots claimed</span>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    placeholder="Your name (optional)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-[#FF3333]/60 transition-colors text-base"
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                      <input
                        type="email"
                        required
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (phase === "error") setPhase("idle");
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-[#FF3333]/60 transition-colors text-base"
                      />
                    </div>
                    <motion.button
                      type="submit"
                      disabled={phase === "loading"}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="relative overflow-hidden bg-[#FF3333] text-white rounded-2xl px-7 py-3.5 font-bold text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                    >
                      <motion.div
                        className="absolute inset-0 bg-white"
                        initial={{ scale: 0, opacity: 0.4 }}
                        whileHover={{ scale: 2.5, opacity: 0 }}
                        transition={{ duration: 0.5 }}
                      />
                      {phase === "loading" ? (
                        <motion.div
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                        />
                      ) : (
                        <>
                          <Zap size={18} className="relative z-10" />
                          <span className="relative z-10 whitespace-nowrap">Claim Spot</span>
                        </>
                      )}
                    </motion.button>
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {phase === "error" && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5"
                      >
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{errorMsg}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-center text-white/30 text-xs pt-1">
                    No spam — just your beta invite when it's ready.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
