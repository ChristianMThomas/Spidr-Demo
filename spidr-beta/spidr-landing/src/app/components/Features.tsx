import { motion, useInView, AnimatePresence } from "motion/react";
import { useRef, useState, useEffect } from "react";
import { Hash, Headphones, Wrench, Sparkles, Shield, Music, Check } from "lucide-react";

// ── Mini preview components per feature ─────────────────────────────────────

function ChannelsPreview() {
  const channels = ["general", "dev-talk", "announcements", "off-topic"];
  return (
    <div className="flex flex-col gap-1.5 mt-auto pt-5">
      {channels.map((ch, i) => (
        <motion.div
          key={ch}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-default"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 + i * 0.08 }}
        >
          <span className="text-[#C41E3A] text-xs font-bold">#</span>
          <span className="text-zinc-400 text-xs font-mono">{ch}</span>
          {i === 0 && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#C41E3A] animate-pulse" />
          )}
        </motion.div>
      ))}
    </div>
  );
}

function WaveformPreview() {
  const heights = [3, 6, 4, 8, 5, 9, 4, 7, 3, 6, 5, 8];
  return (
    <div className="flex items-end gap-1 mt-auto pt-5 h-12">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 bg-[#C41E3A]/50 rounded-full"
          style={{ height: `${h * 4}px` }}
          animate={{
            height: [`${h * 4}px`, `${Math.max(2, h - 2) * 4}px`, `${(h + 1) * 4}px`, `${h * 4}px`],
            opacity: [0.5, 0.9, 0.6, 0.5],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.09,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function BotStorePreview() {
  const bots = [
    { icon: Shield,   label: "Guardian",  color: "#10b981", sub: "Moderation"  },
    { icon: Sparkles, label: "Nexus AI",  color: "#3b82f6", sub: "Scientist"   },
    { icon: Music,    label: "GrooveBot", color: "#ec4899", sub: "Entertainer" },
  ];
  const [installed, setInstalled] = useState<number | null>(null);

  return (
    <div className="mt-auto pt-5 flex flex-col gap-2">
      {bots.map((bot, i) => {
        const Icon = bot.icon;
        const isInstalled = installed === i;
        return (
          <motion.div
            key={bot.label}
            className="flex items-center gap-2.5 bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55 + i * 0.1 }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${bot.color}22`, border: `1px solid ${bot.color}44` }}
            >
              <Icon style={{ color: bot.color }} className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[11px] font-semibold leading-none">{bot.label}</p>
              <p className="text-zinc-600 text-[10px] mt-0.5">{bot.sub}</p>
            </div>
            <motion.button
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 transition-colors"
              style={
                isInstalled
                  ? { background: "#10b98122", color: "#10b981", border: "1px solid #10b98144" }
                  : { background: "rgba(139,0,0,0.2)", color: "#C41E3A", border: "1px solid rgba(139,0,0,0.35)" }
              }
              whileTap={{ scale: 0.93 }}
              onClick={() => setInstalled(i)}
            >
              {isInstalled ? (
                <span className="flex items-center gap-1"><Check className="w-3 h-3" />Added</span>
              ) : "Install"}
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}

const CHAT_SCENARIOS = [
  {
    label: "🎮 Gaming",
    messages: [
      { side: "right", text: "anyone down to play tonight at 9?" },
      { side: "left",  text: "Alex and Jordan are online right now. Want me to ping them?" },
      { side: "right", text: "yes please!" },
    ],
  },
  {
    label: "📚 Homework",
    messages: [
      { side: "right", text: "ugh stuck on this calc problem for an hour" },
      { side: "left",  text: "Share it — I can walk you through it step by step." },
      { side: "right", text: "you're a lifesaver fr" },
    ],
  },
];

function AIChatPreview() {
  const [sceneIdx, setSceneIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setSceneIdx((i) => (i + 1) % CHAT_SCENARIOS.length);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  const scene = CHAT_SCENARIOS[sceneIdx];

  return (
    <div className="mt-auto pt-4 flex flex-col gap-2">
      {/* Topic pill */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.label}
          className="self-center text-[10px] text-zinc-600 border border-zinc-800 rounded-full px-2.5 py-0.5 mb-1"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.25 }}
        >
          {scene.label}
        </motion.div>
      </AnimatePresence>

      {/* Messages */}
      <AnimatePresence mode="wait">
        <motion.div
          key={sceneIdx}
          className="flex flex-col gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {scene.messages.map((m, i) => (
            <motion.div
              key={i}
              className={`flex ${m.side === "right" ? "justify-end" : "justify-start"}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.28 }}
            >
              <span
                className={`px-3 py-1.5 rounded-2xl text-[11px] leading-snug max-w-[82%] ${
                  m.side === "right"
                    ? "bg-[#8B0000]/35 border border-[#8B0000]/30 text-zinc-300 rounded-tr-sm"
                    : "bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 rounded-tl-sm"
                }`}
              >
                {m.text}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Feature data ─────────────────────────────────────────────────────────────

const features = [
  {
    num: "01",
    icon: Hash,
    title: "Organized by default",
    description:
      "Servers are built around topic-based channels — not a single sprawling group chat. Keep conversations focused, searchable, and on-topic.",
    colSpan: "md:col-span-2",
    rowSpan: "",
    preview: <ChannelsPreview />,
  },
  {
    num: "02",
    icon: Headphones,
    title: "Voice that just works",
    description:
      "Drop into a voice channel whenever you're free. No call to start, no link to share — your community sees you're available and pops in instantly.",
    colSpan: "md:col-span-1",
    rowSpan: "",
    preview: <WaveformPreview />,
  },
  {
    num: "03",
    icon: Wrench,
    title: "Build your own bots",
    description:
      "Spidr's Bot Laboratory lets any member spin up custom automations — from moderation helpers to project trackers — no external hosting required.",
    colSpan: "md:col-span-1",
    rowSpan: "",
    preview: <BotStorePreview />,
  },
  {
    num: "04",
    icon: Sparkles,
    title: "AI in your corner",
    description:
      "Spidr AI lives inside your channels. Ask it to summarize threads, explain code, draft replies, or answer questions — without leaving the conversation.",
    colSpan: "md:col-span-2",
    rowSpan: "",
    preview: <AIChatPreview />,
  },
];

// ── Card ─────────────────────────────────────────────────────────────────────

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const [hovered, setHovered] = useState(false);

  const directions = [
    { x: -30, y: 0 },
    { x: 30, y: 0 },
    { x: 0, y: 30 },
    { x: 0, y: 30 },
  ];
  const dir = directions[index] ?? { x: 0, y: 30 };

  return (
    <motion.div
      ref={ref}
      className={`${feature.colSpan} ${feature.rowSpan}`}
      initial={{ opacity: 0, x: dir.x, y: dir.y }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="relative h-full min-h-[260px] rounded-2xl overflow-hidden cursor-default flex flex-col p-7"
        style={{
          background: "linear-gradient(145deg, #131313 0%, #0c0c0c 100%)",
          border: "1px solid rgba(139,0,0,0.18)",
        }}
        whileHover={{ scale: 1.015, borderColor: "rgba(139,0,0,0.4)" }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#8B0000]/60 to-transparent" />

        {/* Animated radial glow on hover */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          animate={{
            opacity: hovered ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, rgba(139,0,0,0.14) 0%, transparent 60%)",
          }}
        />

        {/* Ghost number */}
        <span
          className="absolute top-4 right-5 text-6xl font-black leading-none select-none pointer-events-none"
          style={{ color: "rgba(139,0,0,0.08)", fontVariantNumeric: "tabular-nums" }}
        >
          {feature.num}
        </span>

        {/* Icon */}
        <div className="relative z-10 flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(139,0,0,0.15)", border: "1px solid rgba(139,0,0,0.25)" }}
          >
            <feature.icon className="text-[#C41E3A] w-5 h-5" />
          </div>
        </div>

        {/* Text */}
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white mb-2 leading-snug">{feature.title}</h3>
          <p className="text-zinc-500 text-sm leading-relaxed">{feature.description}</p>
        </div>

        {/* Preview */}
        <div className="relative z-10 flex-1 flex flex-col">
          {feature.preview}
        </div>

        {/* Bottom glow bar */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-1/2 rounded-full"
          animate={{
            opacity: hovered ? 1 : 0.3,
            width: hovered ? "70%" : "40%",
          }}
          transition={{ duration: 0.3 }}
          style={{
            background: "linear-gradient(90deg, transparent, rgba(196,30,58,0.7), transparent)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function Features() {
  const titleRef = useRef(null);
  const isInView = useInView(titleRef, { once: true, margin: "-80px" });

  return (
    <section className="py-28 px-6 relative overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(139,0,0,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <motion.div
        ref={titleRef}
        className="max-w-3xl mx-auto text-center mb-16"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Label badge */}
        <motion.div
          className="inline-flex items-center gap-2 mb-5"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <span className="text-[10px] font-black tracking-[0.2em] text-[#C41E3A] border border-[#8B0000]/40 rounded-full px-3 py-1 uppercase">
            Platform
          </span>
        </motion.div>

        <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
          Everything your
          <br />
          <span
            className="relative"
            style={{
              WebkitTextStroke: "1px rgba(196,30,58,0.5)",
              color: "transparent",
              WebkitTextFillColor: "transparent",
              backgroundImage: "linear-gradient(135deg, #C41E3A 0%, #ff6b6b 50%, #C41E3A 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            community needs
          </span>
        </h2>

        <p className="text-zinc-500 text-base md:text-lg leading-relaxed">
          From casual hangout to serious project coordination —{" "}
          <span className="text-zinc-300">Spidr scales with you.</span>
        </p>
      </motion.div>

      {/* Bento Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <FeatureCard key={index} feature={feature} index={index} />
        ))}
      </div>
    </section>
  );
}
