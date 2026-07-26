import { motion, useInView } from "motion/react";
import { useRef } from "react";

interface BetaStatus {
  count: number;
  spotsLeft: number;
  isFull: boolean;
  cap: number;
}

interface CommunityProps {
  betaStatus?: BetaStatus | null;
}

/**
 * Trust section. The previous version showed "10K COMMUNITIES / 99.9% UPTIME
 * SLA / 100K USER TARGET", pre-launch vanity numbers a skeptical visitor
 * immediately reads as fabricated. Replaced with things that are verifiably
 * true (live beta counter from the API, real platform list, real shipping
 * cadence) plus a build-in-public note about who's making it.
 */
export default function Community({ betaStatus }: CommunityProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const facts = [
    {
      value: betaStatus ? `${betaStatus.count}` : "...",
      label: "Beta testers signed up",
      sub: betaStatus && !betaStatus.isFull ? `${betaStatus.spotsLeft} spots left of ${betaStatus.cap}` : "live count",
    },
    { value: "5", label: "Platforms in beta", sub: "Web · Windows · MacOS · iOS/Android" },
    { value: "Weekly", label: "Patch cadence", sub: "notes ship in-app via SPIDR_SYS" },
    { value: "2", label: "People building it", sub: "no ad model" },
  ];

  return (
    <section id="community" className="py-28 px-6 relative overflow-hidden">
      {/* Ambient gradient */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(139,0,0,0.3) 0%, transparent 65%)",
        }}
      />

      <motion.div
        ref={ref}
        className="max-w-4xl mx-auto text-center relative z-10"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-[#8B0000]/15 border border-[#8B0000]/40 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-[#C41E3A] rounded-full animate-pulse" />
          <span className="text-[#C41E3A] text-xs font-black tracking-[0.15em]">
            BUILT IN PUBLIC
          </span>
        </div>

        <h2 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
          No fake numbers. Here's where we actually are.
        </h2>

        <p className="text-lg md:text-xl text-zinc-400 mb-14 leading-relaxed max-w-2xl mx-auto">
          Spidr is early, that's the point. Join now and the features you ask for
          are the features that ship. Every patch note is public, in-app, every week.
        </p>

        {/* Honest facts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-12">
          {facts.map((fact, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 25 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
              className="bg-[#111111]/70 backdrop-blur-sm border border-[#8B0000]/20 rounded-2xl p-6"
            >
              <div className="text-3xl md:text-4xl font-black text-[#C41E3A] mb-1">
                {fact.value}
              </div>
              <div className="text-zinc-400 text-xs uppercase tracking-wider font-semibold">
                {fact.label}
              </div>
              <div className="text-zinc-600 text-[10px] mt-1 font-mono">{fact.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Decorative divider */}
        <motion.div
          className="mx-auto h-px bg-gradient-to-r from-transparent via-[#8B0000] to-transparent"
          animate={{
            scaleX: [0.5, 1.3, 0.5],
            opacity: [0.25, 0.65, 0.25],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ maxWidth: "280px" }}
        />
      </motion.div>
    </section>
  );
}
