import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { X, ArrowRight, Check, Loader2 } from "lucide-react";
import logo from "../../assets/Spidr_Transparent.png";

interface BetaSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormState = "idle" | "loading" | "success" | "error";

const CONFETTI_COLORS = ["#8B0000", "#C41E3A", "#A00000", "#ffffff20", "#8B0000"];

export default function BetaSignupModal({ isOpen, onClose }: BetaSignupModalProps) {
  const [formState, setFormState] = useState<FormState>("idle");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({});
  const [apiError, setApiError] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Auto-focus first input after modal enters
  useEffect(() => {
    if (isOpen && formState === "idle") {
      const t = setTimeout(() => firstInputRef.current?.focus(), 380);
      return () => clearTimeout(t);
    }
  }, [isOpen, formState]);

  // Reset form after close animation completes
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setFormState("idle");
        setFullName("");
        setEmail("");
        setErrors({});
        setApiError("");
      }, 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const validate = () => {
    const next: { fullName?: string; email?: string } = {};
    if (!fullName.trim()) next.fullName = "Full name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormState("loading");
    setApiError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_BETA_API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || "Something went wrong. Please try again.");
        setFormState("idle");
        return;
      }
      setFormState("success");
    } catch {
      setApiError("Could not reach the server. Check your connection and try again.");
      setFormState("idle");
    }
  };

  const firstName = fullName.trim().split(" ")[0] || "there";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
          />

          {/* ── Modal wrapper ── */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              className="relative w-full max-w-md"
              initial={{ opacity: 0, scale: 0.86, y: 48 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.91, y: 24 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Outer glow */}
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  boxShadow:
                    "0 0 90px rgba(139,0,0,0.28), 0 0 180px rgba(139,0,0,0.10)",
                }}
              />

              {/* ── Card ── */}
              <div className="relative bg-[#0c0c0c] rounded-3xl border border-[#8B0000]/30 overflow-hidden">
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#8B0000] to-transparent" />
                {/* Inner glow */}
                <div
                  className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ boxShadow: "inset 0 0 80px rgba(139,0,0,0.07)" }}
                />

                <AnimatePresence mode="wait">
                  {/* ════════════════════════════════════
                      SUCCESS STATE
                  ════════════════════════════════════ */}
                  {formState === "success" ? (
                    <motion.div
                      key="success"
                      className="relative z-10 p-10 flex flex-col items-center text-center"
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", damping: 22, stiffness: 260 }}
                    >
                      {/* Confetti dots */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                        {[...Array(10)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                              left: `${10 + i * 8}%`,
                              top: "55%",
                            }}
                            initial={{ opacity: 0, y: 0, scale: 0 }}
                            animate={{
                              opacity: [0, 1, 0],
                              y: [0, -(70 + (i % 3) * 40)],
                              x: [0, (i % 2 === 0 ? 1 : -1) * (20 + (i % 4) * 12)],
                              scale: [0, 1.6, 0],
                            }}
                            transition={{
                              duration: 1.1,
                              delay: 0.2 + i * 0.055,
                              ease: "easeOut",
                            }}
                          />
                        ))}
                      </div>

                      {/* Checkmark */}
                      <motion.div
                        className="w-20 h-20 rounded-full bg-[#8B0000]/15 border border-[#8B0000]/40 flex items-center justify-center mb-6"
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 18, stiffness: 300, delay: 0.08 }}
                      >
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", damping: 14, stiffness: 260, delay: 0.26 }}
                        >
                          <Check className="text-[#C41E3A] w-10 h-10" strokeWidth={2.5} />
                        </motion.div>
                      </motion.div>

                      <motion.h3
                        className="text-2xl sm:text-3xl font-black text-white mb-3"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.38 }}
                      >
                        You're on the list, {firstName}.
                      </motion.h3>

                      <motion.p
                        className="text-zinc-400 text-sm mb-8 leading-relaxed max-w-xs"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.48 }}
                      >
                        We'll send early access to{" "}
                        <span className="text-[#C41E3A] font-medium">{email}</span> when Spidr launches. See you on the other side.
                      </motion.p>

                      <motion.button
                        className="bg-[#8B0000]/20 border border-[#8B0000]/40 text-[#C41E3A] px-6 py-2.5 rounded-full text-sm font-semibold"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.62 }}
                      >
                        Back to Spidr
                      </motion.button>
                    </motion.div>

                  ) : (
                  /* ════════════════════════════════════
                      FORM STATE (idle + loading)
                  ════════════════════════════════════ */
                    <motion.div
                      key="form"
                      className="relative z-10 p-8 sm:p-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Close button */}
                      <motion.button
                        className="absolute top-5 right-5 w-9 h-9 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 hover:border-[#8B0000]/50 transition-colors"
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        aria-label="Close"
                      >
                        <X className="w-4 h-4 text-zinc-400" />
                      </motion.button>

                      {/* Logo */}
                      <motion.div
                        className="flex justify-center mb-5"
                        initial={{ opacity: 0, scale: 0.65 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", damping: 18, stiffness: 240, delay: 0.08 }}
                      >
                        <div className="relative">
                          <div
                            className="absolute inset-0 blur-2xl"
                            style={{
                              background:
                                "radial-gradient(circle, rgba(139,0,0,0.65) 0%, transparent 70%)",
                            }}
                          />
                          <img src={logo} alt="Spidr" className="w-14 h-14 relative z-10" />
                        </div>
                      </motion.div>

                      {/* Badge */}
                      <motion.div
                        className="flex justify-center mb-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.14 }}
                      >
                        <span className="inline-flex items-center gap-2 text-xs font-black tracking-[0.15em] text-[#C41E3A] border border-[#8B0000]/50 rounded-full px-3 py-1.5">
                          <span className="w-1.5 h-1.5 bg-[#C41E3A] rounded-full animate-pulse" />
                          BETA ACCESS
                        </span>
                      </motion.div>

                      {/* Headline */}
                      <motion.h2
                        className="text-2xl sm:text-3xl font-black text-white text-center mb-2 leading-tight"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        Be first. Be part of something.
                      </motion.h2>

                      <motion.p
                        className="text-zinc-500 text-sm text-center mb-7 leading-relaxed"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.26 }}
                      >
                        Early access is limited. Enter your details to secure your spot when Spidr launches.
                      </motion.p>

                      {/* ── Form ── */}
                      <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        {/* Full Name */}
                        <motion.div
                          initial={{ opacity: 0, x: -22 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.32 }}
                        >
                          <label
                            htmlFor="beta-fullname"
                            className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider"
                          >
                            Full Name
                          </label>
                          <input
                            ref={firstInputRef}
                            id="beta-fullname"
                            type="text"
                            value={fullName}
                            onChange={(e) => {
                              setFullName(e.target.value);
                              if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }));
                            }}
                            placeholder="Jane Smith"
                            autoComplete="name"
                            disabled={formState === "loading"}
                            className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 transition-all outline-none focus:ring-2 focus:ring-[#8B0000]/40 disabled:opacity-50 ${
                              errors.fullName
                                ? "border-red-500/70"
                                : "border-zinc-800 focus:border-[#8B0000]/60"
                            }`}
                          />
                          <AnimatePresence>
                            {errors.fullName && (
                              <motion.p
                                className="text-red-400 text-xs mt-1.5"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                              >
                                {errors.fullName}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </motion.div>

                        {/* Email */}
                        <motion.div
                          initial={{ opacity: 0, x: -22 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <label
                            htmlFor="beta-email"
                            className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider"
                          >
                            Email Address
                          </label>
                          <input
                            id="beta-email"
                            type="email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                            }}
                            placeholder="jane@example.com"
                            autoComplete="email"
                            disabled={formState === "loading"}
                            className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 transition-all outline-none focus:ring-2 focus:ring-[#8B0000]/40 disabled:opacity-50 ${
                              errors.email
                                ? "border-red-500/70"
                                : "border-zinc-800 focus:border-[#8B0000]/60"
                            }`}
                          />
                          <AnimatePresence>
                            {errors.email && (
                              <motion.p
                                className="text-red-400 text-xs mt-1.5"
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                              >
                                {errors.email}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </motion.div>

                        {/* API error */}
                        <AnimatePresence>
                          {apiError && (
                            <motion.p
                              className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                            >
                              {apiError}
                            </motion.p>
                          )}
                        </AnimatePresence>

                        {/* Submit */}
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.48 }}
                        >
                          <motion.button
                            type="submit"
                            disabled={formState === "loading"}
                            className="w-full bg-[#8B0000] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-1 min-h-[52px] disabled:opacity-70 transition-colors"
                            whileHover={
                              formState !== "loading"
                                ? { scale: 1.02, backgroundColor: "#A00000" }
                                : {}
                            }
                            whileTap={formState !== "loading" ? { scale: 0.98 } : {}}
                          >
                            {formState === "loading" ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                                >
                                  <Loader2 size={18} />
                                </motion.div>
                                <span>Securing your spot…</span>
                              </>
                            ) : (
                              <>
                                <span>Secure My Beta Spot</span>
                                <ArrowRight size={17} />
                              </>
                            )}
                          </motion.button>
                        </motion.div>
                      </form>

                      <motion.p
                        className="text-zinc-700 text-xs text-center mt-5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.58 }}
                      >
                        No spam. Unsubscribe any time. Your data is safe.
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
