import { motion } from "framer-motion";
import { Twitter, Github, Youtube, Instagram } from "lucide-react";
import logo from "@/assets/spidr-logo.png";

const footerLinks = {
  Company: ["About", "Jobs", "Branding", "Newsroom"],
  Resources: ["Support", "Safety", "Blog", "Feedback"],
  Policies: ["Terms", "Privacy", "Guidelines", "Licenses"],
};

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Github, href: "#", label: "Github" },
  { icon: Youtube, href: "#", label: "Youtube" },
];

export default function LandingFooter() {
  return (
    <footer className="relative border-t border-[#FF3333]/20 bg-[#0a0a0a]">
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="web-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 0 50 Q 25 25 50 50 T 100 50 M 50 0 Q 50 25 50 50 T 50 100" stroke="#FF3333" strokeWidth="1" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#web-pattern)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <motion.div className="flex items-center gap-3 mb-6" whileHover={{ scale: 1.05 }}>
              <img src={logo} alt="Spidr" className="w-12 h-12" />
              <span className="text-white text-2xl font-black">SPIDR</span>
            </motion.div>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 bg-[#111] rounded-full flex items-center justify-center border border-[#FF3333]/20 hover:border-[#FF3333] transition-colors"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <social.icon className="w-5 h-5 text-gray-400 hover:text-[#FF3333] transition-colors" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-[#FF3333] font-bold mb-4 uppercase text-sm tracking-wider">{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <motion.a href="#" className="text-gray-400 hover:text-white transition-colors inline-block" whileHover={{ x: 5 }}>
                      {link}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-[#FF3333]/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">© 2026 Spidr Inc. All rights reserved.</p>
          <motion.button
            className="bg-[#FF3333] text-white px-6 py-2.5 rounded-full font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => document.getElementById("download")?.scrollIntoView({ behavior: "smooth" })}
          >
            Download Now
          </motion.button>
        </div>
      </div>

      <motion.div
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255, 51, 51, 0.5) 0%, transparent 70%)", filter: "blur(80px)" }}
        animate={{ scale: [1, 1.2, 1], x: [0, 50, 0], y: [0, -50, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
    </footer>
  );
}
