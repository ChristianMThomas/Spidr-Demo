import { motion, useInView } from "motion/react";
import { useRef } from "react";

const stats = [
  { value: "100K", label: "User Target" },
  { value: "10K", label: "Communities" },
  { value: "10+", label: "Countries" },
  { value: "99.9%", label: "Uptime SLA" },
];

export default function Community() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

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
            OPEN BETA
          </span>
        </div>

        <h2 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
          Join us at the start of something
        </h2>

        <p className="text-lg md:text-xl text-zinc-400 mb-14 leading-relaxed max-w-2xl mx-auto">
          Spidr is growing fast. Be part of the early community — help shape the
          platform before it scales to{" "}
          <span className="text-[#C41E3A] font-bold">100,000 members</span>.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-12">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 25 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
              className="bg-[#111111]/70 backdrop-blur-sm border border-[#8B0000]/20 rounded-2xl p-6"
            >
              <div className="text-3xl md:text-4xl font-black text-[#C41E3A] mb-1">
                {stat.value}
              </div>
              <div className="text-zinc-500 text-xs uppercase tracking-wider font-medium">
                {stat.label}
              </div>
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
