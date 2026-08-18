import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useBetaStatus } from "./useBetaStatus";
import Hero from "./components/Hero";
import ProductShowcase from "./components/ProductShowcase";
import WhySpidr from "./components/WhySpidr";
import Features from "./components/Features";
import Community from "./components/Community";
import Platforms from "./components/Platforms";
import FAQ from "./components/FAQ";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import BetaSignupModal from "./components/BetaSignupModal";
import PrivacyPolicy from "./components/PrivacyPolicy";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [betaOpen, setBetaOpen] = useState(false);
  const openBeta = () => setBetaOpen(true);
  const closeBeta = () => setBetaOpen(false);
  const betaStatus = useBetaStatus();

  const [route, setRoute] = useState<string>(() => window.location.hash);
  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const blobY = useTransform(scrollYProgress, [0, 1], ["0%", "80%"]);
  const blobScale = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1.4, 1]);

  // Must stay below every hook call — an early return here changes the hook
  // count between routes and crashes React.
  if (route === "#privacy") {
    return (
      <PrivacyPolicy
        onBack={() => {
          window.location.hash = "";
        }}
      />
    );
  }

  return (
    <div ref={containerRef} className="relative bg-[#080808] overflow-hidden min-h-screen">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          className="absolute w-[900px] h-[900px] rounded-full will-change-transform"
          style={{
            background:
              "radial-gradient(circle, rgba(139,0,0,0.22) 0%, rgba(139,0,0,0.07) 45%, transparent 70%)",
            filter: "blur(120px)",
            left: "5%",
            top: "-10%",
            y: blobY,
            scale: blobScale,
          }}
        />
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full will-change-transform"
          style={{
            background: "radial-gradient(circle, rgba(90,0,16,0.18) 0%, transparent 70%)",
            filter: "blur(100px)",
            right: "5%",
            top: "25%",
          }}
          animate={{ y: [0, 120, 0], x: [0, -60, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full will-change-transform"
          style={{
            background: "radial-gradient(circle, rgba(139,0,32,0.18) 0%, transparent 70%)",
            filter: "blur(100px)",
            left: "45%",
            bottom: "5%",
          }}
          animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Navbar onOpenBeta={openBeta} />
        <Hero onOpenBeta={openBeta} betaStatus={betaStatus} />
        <ProductShowcase />
        <WhySpidr />
        <Features />
        <Community betaStatus={betaStatus} />
        <Platforms onOpenBeta={openBeta} />
        <FAQ onOpenBeta={openBeta} />
        <Footer />
      </div>

      <BetaSignupModal isOpen={betaOpen} onClose={closeBeta} betaStatus={betaStatus} />
    </div>
  );
}
