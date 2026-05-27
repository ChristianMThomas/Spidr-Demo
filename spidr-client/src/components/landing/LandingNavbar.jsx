import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Download, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/spidr-logo.png";

const navLinks = ["Features", "Community", "Download"];

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        style={{
          backgroundColor: scrolled ? "rgba(10, 10, 10, 0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(10px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255, 51, 51, 0.2)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <motion.div
            className="flex items-center gap-3 cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.img
              src={logo}
              alt="Spidr Logo"
              className="w-12 h-12"
              whileHover={{ rotate: [0, 5, -5, 0], transition: { duration: 0.6 } }}
            />
            <span className="text-white text-2xl font-black tracking-tight">SPIDR</span>
          </motion.div>

          {/* Nav Links — Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((item) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-gray-400 hover:text-white transition-colors relative group"
                whileHover={{ y: -2 }}
                onClick={(e) => { e.preventDefault(); scrollToSection(item.toLowerCase()); }}
              >
                {item}
                <motion.div
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#FF3333]"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            {/* Login — Desktop */}
            <motion.button
              className="hidden md:flex text-white/70 hover:text-white items-center gap-2 px-4 py-2.5 rounded-full border border-white/10 hover:border-[#FF3333]/50 transition-colors text-sm font-semibold"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/login")}
            >
              Login
            </motion.button>

            {/* Download CTA */}
            <motion.button
              className="bg-[#FF3333] text-white px-6 py-2.5 rounded-full font-semibold flex items-center gap-2 relative overflow-hidden"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scrollToSection("download")}
            >
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ scale: 0, opacity: 0.5 }}
                whileHover={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.6 }}
              />
              <Download size={18} className="relative z-10" />
              <span className="relative z-10">Download</span>
            </motion.button>

            {/* Mobile hamburger */}
            <motion.button
              className="md:hidden text-white p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              whileTap={{ scale: 0.9 }}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="md:hidden bg-[#0a0a0a]/95 backdrop-blur-lg border-t border-[#FF3333]/20"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                {navLinks.map((item) => (
                  <motion.a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="text-gray-400 hover:text-white transition-colors text-lg py-2"
                    whileHover={{ x: 8 }}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(item.toLowerCase());
                      setMobileMenuOpen(false);
                    }}
                  >
                    {item}
                  </motion.a>
                ))}
                <motion.button
                  className="text-white/70 hover:text-white text-left text-lg py-2 transition-colors"
                  whileHover={{ x: 8 }}
                  onClick={() => { navigate("/login"); setMobileMenuOpen(false); }}
                >
                  Login / Sign Up
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </>
  );
}
