import { Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/spidr-logo-transparent.png";

export default function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
      <div className="max-w-6xl mx-auto text-center relative z-10">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div
              className="absolute inset-0 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(255, 51, 51, 0.8) 0%, transparent 70%)" }}
            />
            <img src={logo} alt="Spidr" className="w-40 h-40 md:w-64 md:h-64 relative z-10" />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-6xl md:text-8xl font-black mb-6 text-white relative">
          <span className="absolute inset-0 text-[#FF3333] blur-lg opacity-40" aria-hidden="true">
            IMAGINE A PLACE
          </span>
          <span className="relative">IMAGINE A PLACE</span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
          ...where you can belong to a school club, a gaming group, or a worldwide art community.
          Where just you and a handful of friends can spend time together.
          <span className="text-[#FF3333] font-semibold"> A place that makes it easy to talk every day and hang out more often.</span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            className="bg-white text-black px-8 py-4 rounded-full text-lg font-bold flex items-center gap-3 hover:bg-[#FF3333] hover:text-white transition-colors"
            onClick={() => document.getElementById("download")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Download size={24} />
            <span>Download for Windows</span>
          </button>

          <button
            className="bg-[#111] text-white px-8 py-4 rounded-full text-lg font-bold border-2 border-[#FF3333]/30 hover:border-[#FF3333] transition-colors"
            onClick={() => navigate("/login")}
          >
            Open Spidr in your browser
          </button>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 border-2 border-[#FF3333]/50 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-1.5 bg-[#FF3333] rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
