import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Download as DownloadIcon, Apple, Chrome, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/spidr-download-logo.png";

const platforms = [
  { name: "Windows", icon: DownloadIcon, color: "#00A4EF" },
  { name: "Mac", icon: Apple, color: "#A2AAAD" },
  { name: "Linux", icon: Chrome, color: "#FCC624" },
  { name: "iOS", icon: Apple, color: "#147EFB" },
  { name: "Android", icon: Smartphone, color: "#3DDC84" },
  { name: "Web", icon: Chrome, color: "#FF3333" },
];

export default function LandingDownload() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const navigate = useNavigate();

  const handlePlatformClick = (platformName) => {
    if (platformName === "Web") {
      navigate("/login");
    } else {
      alert(`${platformName} download coming soon!`);
    }
  };

  return (
    <section id="download" className="py-32 px-6 relative overflow-hidden">
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(255, 51, 51, 0.4) 0%, transparent 70%)", filter: "blur(100px)" }}
        animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        ref={ref}
        className="max-w-6xl mx-auto relative z-10"
        initial={{ opacity: 0, y: 100 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 100 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="bg-[#111] rounded-[3rem] border-2 border-[#FF3333]/30 overflow-hidden relative"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ borderRadius: "3rem", boxShadow: "inset 0 0 40px rgba(255, 51, 51, 0.5)" }}
          />

          <div className="relative z-10 p-12 md:p-16">
            <div className="flex flex-col md:flex-row items-center gap-12">
              {/* Left */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Ready to spin your web?</h2>
                <p className="text-xl text-gray-400 mb-8">
                  Download Spidr for free and start connecting with friends across all your devices.
                </p>

                <motion.button
                  className="bg-[#FF3333] text-white px-10 py-5 rounded-full text-xl font-bold inline-flex items-center gap-3 relative overflow-hidden group"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => alert("Desktop download coming soon! Use the web app in the meantime.")}
                >
                  <motion.div
                    className="absolute inset-0 bg-white"
                    initial={{ scale: 0, opacity: 0.5 }}
                    whileHover={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                  <DownloadIcon size={28} className="relative z-10" />
                  <span className="relative z-10">Download Now</span>
                </motion.button>
              </div>

              {/* Right — Platform grid */}
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-4">
                  {platforms.map((platform, index) => (
                    <motion.div
                      key={platform.name}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="bg-[#0a0a0a] rounded-2xl p-6 border border-[#FF3333]/20 flex flex-col items-center justify-center gap-3 cursor-pointer group relative overflow-hidden"
                      onClick={() => handlePlatformClick(platform.name)}
                    >
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: `radial-gradient(circle at center, ${platform.color}20 0%, transparent 70%)` }}
                      />
                      <platform.icon className="w-10 h-10 relative z-10 transition-colors" style={{ color: platform.color }} />
                      <span className="text-white text-sm font-semibold relative z-10">{platform.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {[{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, right: 0 }, { bottom: 0, left: 0 }].map((pos, i) => (
            <div key={i} className="absolute w-24 h-24 animate-spin" style={{ ...pos, animationDuration: "20s" }}>
              <div className="w-full h-full border-t-2 border-l-2 border-[#FF3333]/30 rounded-tl-3xl" />
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
