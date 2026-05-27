import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { X, Check, Loader2 } from "lucide-react";
import logo from "../../assets/Spidr.png";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BetaSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormState = "idle" | "loading" | "success";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = ["Windows", "macOS", "Linux", "iOS", "Android", "Web"];
const CONFETTI_COLORS = ["#dc2626", "#7c3aed", "#A00000", "#ffffff30", "#dc2626"];

// ── Shared styles ─────────────────────────────────────────────────────────────

const BASE_INPUT: CSSProperties = {
  width: "100%",
  padding: "12px 15px",
  background: "#17171a",
  border: "1px solid #26262b",
  borderRadius: "11px",
  color: "#f5f5f7",
  fontFamily: "Inter, -apple-system, sans-serif",
  fontSize: "15px",
  outline: "none",
  transition: "border-color 0.18s",
};

const ERR_INPUT: CSSProperties = { ...BASE_INPUT, borderColor: "#ef4444" };

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTag({ num, label }: { num: number; label: string }) {
  return (
    <div
      className="flex items-center gap-2.5 text-white text-2xl mb-5"
      style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.06em" }}
    >
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold text-white flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #dc2626, #7c3aed)", fontFamily: "Inter, sans-serif" }}
      >
        {num}
      </span>
      {label}
    </div>
  );
}

function Divider() {
  return <div className="my-6" style={{ height: "1px", background: "#26262b" }} />;
}

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

function Field({ label, required, hint, error, className = "mb-4", children }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold mb-2" style={{ color: "#d4d4d8" }}>
        {label}
        {required && <span style={{ color: "#dc2626" }}> *</span>}
        {hint && (
          <span className="text-xs font-normal ml-1.5" style={{ color: "#8a8a93" }}>
            ({hint})
          </span>
        )}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            className="text-xs mt-1.5"
            style={{ color: "#ef4444" }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ConsentBoxProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

function ConsentBox({ id, checked, onChange, error, disabled, children }: ConsentBoxProps) {
  return (
    <label
      htmlFor={id}
      className="flex gap-3 items-start p-3 rounded-xl cursor-pointer transition-colors"
      style={{
        border: `1px solid ${error ? "#ef4444" : "#26262b"}`,
        background: "#17171a",
      }}
    >
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className="w-5 h-5 rounded flex items-center justify-center transition-all"
          style={
            checked
              ? { background: "linear-gradient(135deg, #dc2626, #7c3aed)", border: "2px solid transparent" }
              : { background: "transparent", border: `2px solid ${error ? "#ef4444" : "#26262b"}` }
          }
        >
          {checked && <Check size={11} color="white" strokeWidth={3} />}
        </div>
      </div>
      <span className="text-sm leading-relaxed" style={{ color: "#d4d4d8" }}>
        {children}
      </span>
    </label>
  );
}

function LegalText() {
  return (
    <div style={{ color: "#c4c4cc" }}>
      <h4 className="font-bold text-white mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "15px", letterSpacing: "0.05em" }}>
        Spidr Beta Testing Agreement
      </h4>
      <p className="mb-3">
        This Beta Testing Agreement ("Agreement") is entered into between you ("Tester") and Spidr ("Company"). By submitting this form, you agree to participate in the Spidr beta testing program ("Program") under the terms below.{" "}
        <b style={{ color: "#fff" }}>This is a plain-language summary and template, not legal advice; final terms are governed by the linked full documents.</b>
      </p>
      <h4 className="font-bold text-white mb-1 mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", letterSpacing: "0.05em" }}>1. Beta Software</h4>
      <p className="mb-3">
        The Program provides access to pre-release software ("Beta Software") that is under active development, provided "AS IS" and "AS AVAILABLE." Beta Software may be incomplete, contain bugs, behave unexpectedly, or change or be discontinued at any time without notice. It is not intended for production use or for storing critical data.
      </p>
      <h4 className="font-bold text-white mb-1 mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", letterSpacing: "0.05em" }}>2. Confidentiality (NDA)</h4>
      <p className="mb-3">
        For closed/private beta participants: you agree that all non-public information you access through the Program — including features, designs, performance, screenshots, and your own feedback — is confidential ("Confidential Information"). You will not disclose, publish, screenshot, stream, demo, or share Confidential Information with any third party without Spidr's prior written consent. This obligation survives termination of the Program. Open beta features publicly announced by Spidr are excluded from this restriction.
      </p>
      <h4 className="font-bold text-white mb-1 mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", letterSpacing: "0.05em" }}>3. Feedback &amp; Ownership</h4>
      <p className="mb-3">
        Any feedback, suggestions, bug reports, or ideas you submit ("Feedback") may be used by Spidr without restriction or compensation. You assign to Spidr all rights in Feedback and acknowledge that Spidr owns all intellectual property in the Beta Software. You receive no ownership, license (beyond the limited right to use the Beta Software for testing), or equity by participating.
      </p>
      <h4 className="font-bold text-white mb-1 mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", letterSpacing: "0.05em" }}>4. No Warranty &amp; Limitation of Liability</h4>
      <p className="mb-3">
        To the maximum extent permitted by law, Spidr disclaims all warranties, express or implied, including merchantability and fitness for a particular purpose. Spidr is not liable for any data loss, damages, or losses arising from your use of the Beta Software. Your participation is voluntary and at your own risk.
      </p>
      <h4 className="font-bold text-white mb-1 mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", letterSpacing: "0.05em" }}>5. Term &amp; Termination</h4>
      <p className="mb-3">
        Spidr may suspend or terminate the Program, or your access, at any time for any reason. You may withdraw at any time by contacting Spidr. Confidentiality and IP obligations survive.
      </p>
      <h4 className="font-bold text-white mb-1 mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", letterSpacing: "0.05em" }}>6. Privacy &amp; Data</h4>
      <p className="mb-3">
        By participating, you consent to Spidr collecting and processing the information in this form and usage/diagnostic data from the Beta Software to operate and improve the Program, as described in the Privacy Policy. You may request deletion of your data at any time, subject to legal retention requirements.
      </p>
      <h4 className="font-bold text-white mb-1 mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "14px", letterSpacing: "0.05em" }}>7. Eligibility</h4>
      <p>
        You confirm you are at least 18 years old and legally able to enter this Agreement.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BetaSignupModal({ isOpen, onClose }: BetaSignupModalProps) {
  const [formState, setFormState] = useState<FormState>("idle");

  // Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [betaType, setBetaType] = useState("");
  const [why, setWhy] = useState("");

  // Consents
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Auto-focus first input
  useEffect(() => {
    if (isOpen && formState === "idle") {
      const t = setTimeout(() => firstInputRef.current?.focus(), 380);
      return () => clearTimeout(t);
    }
  }, [isOpen, formState]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setFormState("idle");
        setFirstName(""); setLastName(""); setEmail(""); setUsername("");
        setAge(""); setPlatforms([]); setBetaType(""); setWhy("");
        setAgreedTerms(false); setAgreedPrivacy(false);
        setConfirmedAge(false); setMarketingOptIn(false);
        setErrors({}); setApiError("");
      }, 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Please enter your first name.";
    if (!lastName.trim()) next.lastName = "Please enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (username.trim().length < 3) next.username = "Pick a username (3+ characters).";
    if (!age || age === "under18") next.age = "You must be 18 or older to join the beta.";
    if (platforms.length === 0) next.platforms = "Select at least one platform.";
    if (!betaType) next.betaType = "Choose a beta track.";
    if (!agreedTerms) next.agreedTerms = "You must agree to the terms.";
    if (!agreedPrivacy) next.agreedPrivacy = "You must consent to data processing.";
    if (!confirmedAge) next.confirmedAge = "You must confirm you are 18+.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
    clearError("platforms");
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
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          username: username.trim(),
          age,
          platforms,
          betaType,
          why: why.trim(),
          agreedTerms,
          agreedPrivacy,
          confirmedAge,
          marketingOptIn,
        }),
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
          />

          {/* ── Modal wrapper ── */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              className="relative w-full max-w-2xl"
              initial={{ opacity: 0, scale: 0.86, y: 48 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.91, y: 24 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Outer glow */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ boxShadow: "0 0 90px rgba(220,38,38,0.22), 0 0 180px rgba(124,58,237,0.10)" }}
              />

              {/* ── Card ── */}
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{ background: "#121214", border: "1px solid #26262b" }}
              >
                {/* Top accent line (red → purple) */}
                <div
                  className="absolute top-0 left-0 right-0 h-px pointer-events-none z-10"
                  style={{ background: "linear-gradient(90deg, transparent, #dc2626 35%, #7c3aed 65%, transparent)" }}
                />
                {/* Grid texture */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
                    backgroundSize: "44px 44px",
                    zIndex: 0,
                  }}
                />
                {/* Radial glows */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle at 15% 10%, rgba(124,58,237,0.10), transparent 40%), radial-gradient(circle at 85% 90%, rgba(220,38,38,0.10), transparent 40%)",
                    zIndex: 0,
                  }}
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
                      {/* Confetti */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                        {[...Array(12)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                              left: `${8 + i * 7}%`,
                              top: "55%",
                            }}
                            initial={{ opacity: 0, y: 0, scale: 0 }}
                            animate={{
                              opacity: [0, 1, 0],
                              y: [0, -(70 + (i % 3) * 40)],
                              x: [0, (i % 2 === 0 ? 1 : -1) * (20 + (i % 4) * 12)],
                              scale: [0, 1.6, 0],
                            }}
                            transition={{ duration: 1.1, delay: 0.2 + i * 0.055, ease: "easeOut" }}
                          />
                        ))}
                      </div>

                      {/* Check circle */}
                      <motion.div
                        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                        style={{
                          background: "linear-gradient(135deg, #dc2626, #7c3aed)",
                          boxShadow: "0 0 50px rgba(124,58,237,0.45)",
                        }}
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 18, stiffness: 300, delay: 0.08 }}
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", damping: 14, stiffness: 260, delay: 0.26 }}
                        >
                          <Check className="text-white w-10 h-10" strokeWidth={2.5} />
                        </motion.div>
                      </motion.div>

                      <motion.h2
                        className="text-4xl sm:text-5xl text-white mb-3"
                        style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.38 }}
                      >
                        YOU'RE ON THE WEB
                      </motion.h2>

                      <motion.p
                        className="text-sm mb-8 leading-relaxed max-w-sm"
                        style={{ color: "#8a8a93" }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.48 }}
                      >
                        Thanks,{" "}
                        <span className="text-white font-semibold">{firstName}</span>. Your beta application is in. We'll
                        email{" "}
                        <span style={{ color: "#dc2626" }}>{email}</span> when your invite is ready. Keep an eye on
                        your inbox.
                      </motion.p>

                      <motion.button
                        className="text-white px-7 py-3 rounded-full text-sm font-semibold"
                        style={{ background: "linear-gradient(135deg, #dc2626, #7c3aed)" }}
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
                      FORM STATE
                  ════════════════════════════════════ */
                    <motion.div
                      key="form"
                      className="relative z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Close button */}
                      <motion.button
                        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center border transition-colors"
                        style={{ background: "#17171a", borderColor: "#26262b" }}
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        aria-label="Close"
                      >
                        <X className="w-4 h-4 text-zinc-400" />
                      </motion.button>

                      {/* Scrollable form area */}
                      <div className="overflow-y-auto px-7 py-8 sm:px-10" style={{ maxHeight: "90vh" }}>

                        {/* ── Header ── */}
                        <motion.div
                          className="text-center mb-8"
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <div className="flex justify-center mb-4">
                            <div className="relative">
                              <div
                                className="absolute inset-0 blur-2xl"
                                style={{ background: "radial-gradient(circle, rgba(220,38,38,0.55) 0%, transparent 70%)" }}
                              />
                              <img
                                src={logo}
                                alt="Spidr"
                                className="w-16 h-16 relative z-10"
                                style={{ filter: "drop-shadow(0 0 28px rgba(220,38,38,0.5))" }}
                              />
                            </div>
                          </div>
                          <div
                            className="text-xs font-bold tracking-[0.3em] uppercase mb-2"
                            style={{ color: "#dc2626" }}
                          >
                            Spidr Beta Program
                          </div>
                          <h1
                            className="text-5xl sm:text-6xl text-white mb-3"
                            style={{
                              fontFamily: "'Bebas Neue', sans-serif",
                              letterSpacing: "0.02em",
                              lineHeight: 0.92,
                              background: "linear-gradient(135deg, #fff 30%, #dc2626)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                              backgroundClip: "text",
                            }}
                          >
                            JOIN THE WEB
                          </h1>
                          <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#8a8a93" }}>
                            Get early access to Spidr before anyone else. Help us build something different and shape
                            the platform from the inside.
                          </p>
                        </motion.div>

                        {/* ── Form ── */}
                        <form onSubmit={handleSubmit} noValidate>

                          {/* ══ SECTION 1 ══ */}
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18 }}
                          >
                            <SectionTag num={1} label="Your Details" />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                              <Field label="First Name" required error={errors.firstName} className="">
                                <input
                                  ref={firstInputRef}
                                  type="text"
                                  value={firstName}
                                  onChange={(e) => { setFirstName(e.target.value); clearError("firstName"); }}
                                  placeholder="Jane"
                                  autoComplete="given-name"
                                  disabled={formState === "loading"}
                                  style={errors.firstName ? ERR_INPUT : BASE_INPUT}
                                />
                              </Field>
                              <Field label="Last Name" required error={errors.lastName} className="">
                                <input
                                  type="text"
                                  value={lastName}
                                  onChange={(e) => { setLastName(e.target.value); clearError("lastName"); }}
                                  placeholder="Smith"
                                  autoComplete="family-name"
                                  disabled={formState === "loading"}
                                  style={errors.lastName ? ERR_INPUT : BASE_INPUT}
                                />
                              </Field>
                            </div>

                            <Field label="Email Address" required error={errors.email}>
                              <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                                placeholder="you@example.com"
                                autoComplete="email"
                                disabled={formState === "loading"}
                                style={errors.email ? ERR_INPUT : BASE_INPUT}
                              />
                            </Field>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <Field label="Preferred Username" required error={errors.username} className="">
                                <input
                                  type="text"
                                  value={username}
                                  onChange={(e) => { setUsername(e.target.value); clearError("username"); }}
                                  placeholder="spidey_01"
                                  disabled={formState === "loading"}
                                  style={errors.username ? ERR_INPUT : BASE_INPUT}
                                />
                              </Field>
                              <Field label="Age" required error={errors.age} className="">
                                <select
                                  value={age}
                                  onChange={(e) => { setAge(e.target.value); clearError("age"); }}
                                  disabled={formState === "loading"}
                                  style={errors.age ? ERR_INPUT : BASE_INPUT}
                                >
                                  <option value="">Select…</option>
                                  <option value="under18">Under 18</option>
                                  <option value="18-24">18 to 24</option>
                                  <option value="25-34">25 to 34</option>
                                  <option value="35-44">35 to 44</option>
                                  <option value="45+">45+</option>
                                </select>
                              </Field>
                            </div>
                          </motion.div>

                          <Divider />

                          {/* ══ SECTION 2 ══ */}
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.26 }}
                          >
                            <SectionTag num={2} label="Beta Preferences" />

                            <Field label="Which platforms will you test on?" required error={errors.platforms}>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {PLATFORMS.map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => togglePlatform(p)}
                                    disabled={formState === "loading"}
                                    className="px-4 py-2 rounded-full text-sm font-semibold border transition-all"
                                    style={
                                      platforms.includes(p)
                                        ? { background: "linear-gradient(135deg, #dc2626, #7c3aed)", borderColor: "transparent", color: "#fff" }
                                        : { borderColor: "#26262b", background: "#17171a", color: "#d4d4d8" }
                                    }
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </Field>

                            <Field label="Beta track" required error={errors.betaType}>
                              <select
                                value={betaType}
                                onChange={(e) => { setBetaType(e.target.value); clearError("betaType"); }}
                                disabled={formState === "loading"}
                                style={errors.betaType ? ERR_INPUT : BASE_INPUT}
                              >
                                <option value="">Select…</option>
                                <option value="closed">Closed Beta — early builds, NDA required, hands-on feedback</option>
                                <option value="open">Open Beta — public preview, lighter commitment</option>
                              </select>
                            </Field>

                            <Field label="Why do you want in?" hint="optional" className="mb-0">
                              <textarea
                                value={why}
                                onChange={(e) => setWhy(e.target.value)}
                                placeholder="Tell us how you'll use Spidr, what you're excited about, or what you'd want to test…"
                                disabled={formState === "loading"}
                                rows={3}
                                style={{ ...BASE_INPUT, resize: "vertical", minHeight: "80px" }}
                              />
                            </Field>
                          </motion.div>

                          <Divider />

                          {/* ══ SECTION 3 ══ */}
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.34 }}
                          >
                            <SectionTag num={3} label="Agreements" />

                            {/* Scrollable legal box */}
                            <div
                              className="rounded-xl p-4 mb-2 overflow-y-auto text-xs leading-relaxed"
                              style={{
                                background: "#17171a",
                                border: "1px solid #26262b",
                                maxHeight: "200px",
                              }}
                            >
                              <LegalText />
                            </div>
                            <p className="text-xs mb-4" style={{ color: "#8a8a93" }}>
                              Scroll above to read the full agreement.
                            </p>

                            {/* Consent checkboxes */}
                            <div className="space-y-2 mb-6">
                              <ConsentBox
                                id="c-terms"
                                checked={agreedTerms}
                                onChange={(v) => { setAgreedTerms(v); clearError("agreedTerms"); }}
                                error={!!errors.agreedTerms}
                                disabled={formState === "loading"}
                              >
                                I have read and agree to the <b>Beta Testing Agreement</b>, the{" "}
                                <a href="#" target="_blank" rel="noopener" style={{ color: "#dc2626" }}>Terms of Service</a>,
                                and (for closed beta) the <b>confidentiality / NDA</b> obligations above.{" "}
                                <span style={{ color: "#dc2626" }}>*</span>
                              </ConsentBox>

                              <ConsentBox
                                id="c-privacy"
                                checked={agreedPrivacy}
                                onChange={(v) => { setAgreedPrivacy(v); clearError("agreedPrivacy"); }}
                                error={!!errors.agreedPrivacy}
                                disabled={formState === "loading"}
                              >
                                I consent to Spidr collecting and processing my data as described in the{" "}
                                <a href="#" target="_blank" rel="noopener" style={{ color: "#dc2626" }}>Privacy Policy</a>,
                                including diagnostic and usage data from the beta build.{" "}
                                <span style={{ color: "#dc2626" }}>*</span>
                              </ConsentBox>

                              <ConsentBox
                                id="c-age"
                                checked={confirmedAge}
                                onChange={(v) => { setConfirmedAge(v); clearError("confirmedAge"); }}
                                error={!!errors.confirmedAge}
                                disabled={formState === "loading"}
                              >
                                I confirm that I am <b>18 years of age or older</b>.{" "}
                                <span style={{ color: "#dc2626" }}>*</span>
                              </ConsentBox>

                              <ConsentBox
                                id="c-marketing"
                                checked={marketingOptIn}
                                onChange={setMarketingOptIn}
                                disabled={formState === "loading"}
                              >
                                <span style={{ color: "#8a8a93" }}>(Optional)</span> Send me Spidr news, launch
                                updates, and beta announcements by email.
                              </ConsentBox>
                            </div>

                            {/* API error */}
                            <AnimatePresence>
                              {apiError && (
                                <motion.p
                                  className="text-xs text-center rounded-xl px-3 py-2 mb-3"
                                  style={{
                                    color: "#ef4444",
                                    background: "rgba(239,68,68,0.10)",
                                    border: "1px solid rgba(239,68,68,0.20)",
                                  }}
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                >
                                  {apiError}
                                </motion.p>
                              )}
                            </AnimatePresence>

                            {/* Submit button */}
                            <motion.button
                              type="submit"
                              disabled={formState === "loading"}
                              className="w-full flex items-center justify-center gap-3 rounded-xl text-white disabled:opacity-60"
                              style={{
                                padding: "15px",
                                fontFamily: "'Bebas Neue', sans-serif",
                                fontSize: "22px",
                                letterSpacing: "0.08em",
                                background: "linear-gradient(135deg, #dc2626, #7c3aed)",
                                boxShadow: "0 10px 30px rgba(220,38,38,0.3)",
                              }}
                              whileHover={formState !== "loading" ? { y: -2, boxShadow: "0 16px 40px rgba(220,38,38,0.45)" } : {}}
                              whileTap={formState !== "loading" ? { scale: 0.99 } : {}}
                            >
                              {formState === "loading" ? (
                                <>
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                                  >
                                    <Loader2 size={20} />
                                  </motion.div>
                                  <span>Securing Your Spot…</span>
                                </>
                              ) : (
                                <>
                                  <img
                                    src={logo}
                                    alt=""
                                    aria-hidden
                                    className="w-7 h-7"
                                    style={{ filter: "drop-shadow(0 0 4px rgba(0,0,0,0.5))" }}
                                  />
                                  <span>SECURE MY SPOT</span>
                                </>
                              )}
                            </motion.button>

                            <p className="text-xs text-center mt-4" style={{ color: "#8a8a93" }}>
                              No spam. Unsubscribe any time. Your data is safe with us.
                            </p>
                          </motion.div>
                        </form>
                      </div>
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
