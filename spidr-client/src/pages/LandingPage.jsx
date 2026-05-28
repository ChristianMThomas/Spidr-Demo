import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import BetaSignupSection from "@/components/landing/BetaSignupSection";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingCommunity from "@/components/landing/LandingCommunity";
import LandingDownload from "@/components/landing/LandingDownload";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] });
  const blobY = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const blobScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.5, 1]);

  return (
    <div ref={containerRef} className="relative bg-[#0a0a0a] overflow-hidden min-h-screen">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255, 51, 51, 0.3) 0%, rgba(255, 51, 51, 0.1) 40%, transparent 70%)",
            filter: "blur(100px)",
            left: "10%",
            y: blobY,
            scale: blobScale,
          }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255, 51, 51, 0.2) 0%, transparent 70%)",
            filter: "blur(80px)",
            right: "10%",
            top: "30%",
          }}
          animate={{ y: [0, 100, 0], x: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(139, 0, 0, 0.3) 0%, transparent 70%)",
            filter: "blur(90px)",
            left: "50%",
            bottom: "10%",
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <LandingNavbar />
        <LandingHero />
        <BetaSignupSection />
        <LandingFeatures />
        <LandingCommunity />
        <LandingDownload />
        <LandingFooter />
      </div>

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none z-[5]">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#FF3333] rounded-full"
            style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
            animate={{ y: [0, -30, 0], opacity: [0, 1, 0], scale: [0, 1, 0] }}
            transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 5, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}
