import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Download as DownloadIcon, Globe, Smartphone, Monitor } from "lucide-react";

const platforms = [
  { name: "Windows", icon: Monitor, color: "#60A5FA" },
  { name: "macOS", icon: Monitor, color: "#A2AAAD" },
  { name: "Linux", icon: Monitor, color: "#FCD34D" },
  { name: "Web", icon: Globe, color: "#C41E3A" },
  { name: "iOS", icon: Smartphone, color: "#60A5FA" },
  { name: "Android", icon: Smartphone, color: "#4ADE80" },
];

export default function Download() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="download" className="py-28 px-6 relative overflow-hidden">
      {/* Ambient blob */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-15 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(139,0,0,0.4) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />

      <motion.div
        ref={ref}
        className="max-w-5xl mx-auto relative z-10"
        initial={{ opacity: 0, y: 60 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
      >
        <div className="bg-[#111111] rounded-3xl border border-[#8B0000]/25 overflow-hidden relative p-10 md:p-14">
          {/* Inner glow */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ boxShadow: "inset 0 0 60px rgba(139,0,0,0.1)" }}
          />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            {/* Text */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                Ready to build your community?
              </h2>
              <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                Download Spidr for free and connect with builders across all
                your devices.
              </p>
              <motion.button
                className="bg-[#8B0000] text-white px-10 py-4 rounded-full text-lg font-bold inline-flex items-center gap-3 min-h-[56px]"
                whileHover={{ scale: 1.04, backgroundColor: "#A00000" }}
                whileTap={{ scale: 0.96 }}
                onClick={() => alert("Download coming soon! Stay tuned.")}
              >
                <DownloadIcon size={24} />
                <span>Download Now — It's Free</span>
              </motion.button>
            </div>

            {/* Platform grid */}
            <div className="flex-1 w-full">
              <div className="grid grid-cols-3 gap-3">
                {platforms.map((platform, index) => (
                  <motion.button
                    key={platform.name}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ duration: 0.4, delay: index * 0.07 }}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-[#0f0f0f] rounded-xl p-5 border border-[#8B0000]/15 hover:border-[#8B0000]/40 flex flex-col items-center gap-2.5 transition-colors min-h-[44px]"
                    onClick={() =>
                      alert(`${platform.name} download coming soon!`)
                    }
                  >
                    <platform.icon
                      className="w-8 h-8"
                      style={{ color: platform.color }}
                    />
                    <span className="text-white text-xs font-semibold">
                      {platform.name}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
