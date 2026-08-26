import logo from "../../assets/Spidr.png";

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Footer() {
  return (
    <footer className="relative border-t border-[#8B0000]/20 bg-[#080808]">
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-3 mb-3">
              <img src={logo} alt="Spidr" className="w-8 h-8" />
              <span className="text-white text-lg font-black tracking-tight">SPIDR</span>
            </div>
            <p className="text-zinc-600 text-xs leading-relaxed">
              One app for your whole community. Built in public by a two-person team ,
              no ads, no data selling, weekly patches.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-14">
            <div>
              <p className="text-zinc-500 text-[10px] font-black tracking-[0.18em] uppercase mb-3">Product</p>
              <ul className="space-y-2">
                {[
                  { label: "See the app", id: "product" },
                  { label: "Features", id: "features" },
                  { label: "Platforms", id: "platforms" },
                  { label: "FAQ", id: "faq" },
                ].map((l) => (
                  <li key={l.id}>
                    <button
                      onClick={() => scrollTo(l.id)}
                      className="text-zinc-400 hover:text-white text-xs transition-colors cursor-pointer"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] font-black tracking-[0.18em] uppercase mb-3">Contact</p>
              <ul className="space-y-2">
                <li>
                  <a
                    href="mailto:hello@spidrapp.com"
                    className="text-zinc-400 hover:text-white text-xs transition-colors"
                  >
                    contact@spidrapp.com
                  </a>
                </li>
                <li>
                  <span className="text-zinc-600 text-xs">Data deletion: same address</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <p className="text-zinc-600 text-xs">© 2026 SpidrApp. All rights reserved.</p>
            <a
              href="#privacy"
              className="text-zinc-400 hover:text-white text-xs transition-colors"
            >
              Privacy Policy
            </a>
          </div>
          <p className="text-zinc-700 text-[10px] font-mono tracking-wide">
            We only collect what the signup form asks for. Nothing is sold. Ever.
          </p>
        </div>
      </div>
    </footer>
  );
}
