import { motion } from "motion/react";
import { Twitter, Github, Youtube, Instagram } from "lucide-react";
import logo from "../../assets/Spidr.png";

const footerLinks = {
  Company: ["About", "Branding", "Spidr System"],
  Resources: ["Support", "Safety", "Feedback"],
  Policies: ["Terms", "Privacy", "Guidelines", "Licenses"],
};

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Github, href: "#", label: "Github" },
  { icon: Youtube, href: "#", label: "Youtube" },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-[#8B0000]/20 bg-[#080808]">
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          {/* Brand column */}
          <div className="md:col-span-1">
            <motion.div className="flex items-center gap-3 mb-3" whileHover={{ scale: 1.03 }}>
              <img src={logo} alt="Spidr" className="w-9 h-9" />
              <span className="text-white text-xl font-black tracking-tight">SPIDR</span>
            </motion.div>
            <p className="text-zinc-600 text-sm mb-5 max-w-[190px] leading-relaxed">
              The platform built for technical communities. Launching soon.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="w-9 h-9 bg-[#111111] rounded-full flex items-center justify-center border border-zinc-800 hover:border-[#8B0000]/60 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <social.icon className="w-4 h-4 text-zinc-500 hover:text-[#C41E3A] transition-colors" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-[#8B0000] font-bold mb-4 text-xs uppercase tracking-widest">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <motion.a
                      href="#"
                      className="text-zinc-500 hover:text-zinc-200 transition-colors text-sm inline-block"
                      whileHover={{ x: 4 }}
                    >
                      {link}
                    </motion.a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-zinc-900 flex justify-center">
          <p className="text-zinc-700 text-sm">© 2026 SpidrApp</p>
        </div>
      </div>
    </footer>
  );
}
