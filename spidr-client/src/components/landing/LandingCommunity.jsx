import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Sparkles } from "lucide-react";

export default function LandingCommunity() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="community" className="py-32 px-6 relative overflow-hidden">
      <motion.div
        className="absolute inset-0 opacity-20"
        style={{ background: "radial-gradient(ellipse at center, rgba(255, 51, 51, 0.3) 0%, transparent 70%)" }}
        animate={{ opacity: [0.2, 0.3, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        ref={ref}
        className="max-w-5xl mx-auto text-center relative z-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.8 }}
      >
        <div className="relative inline-block mb-8">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                left: `${Math.cos((i * Math.PI) / 2) * 100 + 50}%`,
                top: `${Math.sin((i * Math.PI) / 2) * 100 + 50}%`,
              }}
              animate={{ scale: [0, 1, 0], rotate: [0, 180, 360], opacity: [0, 1, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.75, ease: "easeInOut" }}
            >
              <Sparkles className="text-[#FF3333] w-6 h-6" />
            </motion.div>
          ))}
        </div>

        <h2 className="text-5xl md:text-7xl font-black text-white mb-8 leading-tight relative">
          <motion.span
            className="absolute inset-0 text-[#FF3333] blur-lg"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            aria-hidden="true"
          >
            An invite is all you need
          </motion.span>
          <span className="relative">An invite is all you need</span>
        </h2>

        <p className="text-xl md:text-2xl text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
          Join us in our goal to reach <span className="text-[#FF3333] font-bold">100,000 people</span> to
          use Spidr to talk, hangout and stay together with their communities and friends.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {[
            { value: "100K", label: "User Goal" },
            { value: "10K", label: "Server Goal" },
            { value: "10", label: "Countries Goal" },
            { value: "98%", label: "Uptime Goal" },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-[#FF3333]/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-[#111]/50 backdrop-blur-lg border border-[#FF3333]/30 rounded-2xl p-6">
                <div className="text-4xl md:text-5xl font-black text-[#FF3333] mb-2">{stat.value}</div>
                <div className="text-gray-400 text-sm uppercase tracking-wider">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mx-auto w-64 h-2 bg-gradient-to-r from-transparent via-[#FF3333] to-transparent rounded-full"
          animate={{ scaleX: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-[#FF3333]/50 to-transparent"
            style={{ top: `${25 + i * 25}%`, left: 0, right: 0 }}
            animate={{ scaleX: [0.5, 1, 0.5], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 5 + i * 2, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </section>
  );
}
