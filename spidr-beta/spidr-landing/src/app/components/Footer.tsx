import logo from "../../assets/Spidr.png";

export default function Footer() {
  return (
    <footer className="relative border-t border-[#8B0000]/20 bg-[#080808]">
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Spidr" className="w-8 h-8" />
            <span className="text-white text-lg font-black tracking-tight">SPIDR</span>
          </div>
          <p className="text-zinc-600 text-xs text-center sm:text-right">
            © 2026 SpidrApp. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
