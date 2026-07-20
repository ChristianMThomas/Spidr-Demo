import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";
import logo from "../../assets/Spidr.png";

const navLinks = ["Features", "Community"];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

interface NavbarProps {
  onOpenBeta: () => void;
}

export default function Navbar({ onOpenBeta }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <motion.nav
        className="absolute top-0 left-0 right-0 z-50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          backgroundColor: "transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <motion.div
            className="flex items-center gap-3 cursor-pointer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <img src={logo} alt="Spidr" className="w-10 h-10" />
            <span className="text-white text-xl font-black tracking-tight">SPIDR</span>
          </motion.div>

          {/* Nav Links — Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((item) => (
              <motion.a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-zinc-400 hover:text-white transition-colors text-sm font-medium relative group"
                whileHover={{ y: -1 }}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(item.toLowerCase());
                }}
              >
                {item}
                <motion.div
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#8B0000]"
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.25 }}
                />
              </motion.a>
            ))}
          </div>

          {/* Editorial status tag — Desktop large */}
          <span className="hidden lg:flex items-center font-mono text-[0.6rem] text-[#C41E3A] tracking-widest border border-[#8B0000]/30 px-2 py-1 opacity-60">
            [ BETA / v0.1 ]
          </span>

          {/* CTA — Desktop */}
          <div className="hidden md:flex items-center">
            <motion.button
              className="bg-[#8B0000] text-white px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 relative overflow-hidden"
              whileHover={{ scale: 1.04, backgroundColor: "#A00000" }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenBeta}
            >
              <Sparkles size={15} />
              <span>Join the Beta</span>
            </motion.button>
          </div>

          {/* Mobile hamburger */}
          <motion.button
            className="md:hidden text-white p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            whileTap={{ scale: 0.9 }}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </motion.button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="md:hidden bg-[#080808]/98 backdrop-blur-lg border-t border-[#8B0000]/20"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="px-6 py-5 flex flex-col gap-4">
                {navLinks.map((item) => (
                  <motion.a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="text-zinc-400 hover:text-white transition-colors text-base py-1"
                    whileHover={{ x: 6 }}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(item.toLowerCase());
                      setMobileMenuOpen(false);
                    }}
                  >
                    {item}
                  </motion.a>
                ))}
                <div className="pt-2 border-t border-zinc-800/60">
                  <button
                    className="w-full bg-[#8B0000] text-white px-6 py-3 rounded-full font-semibold flex items-center justify-center gap-2 min-h-[44px]"
                    onClick={() => {
                      onOpenBeta();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Sparkles size={17} />
                    Join the Beta
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </>
  );
}
