import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { MessageCircle, Users, Video, Shield } from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "Create an invite-only place",
    description: "Spidr servers are organized into topic-based channels where you can collaborate, share, and just talk about your day without clogging up a group chat.",
  },
  {
    icon: Video,
    title: "Where hanging out is easy",
    description: "Grab a seat in a voice channel when you're free. Friends in your server can see you're around and instantly pop in to talk without having to call.",
  },
  {
    icon: Users,
    title: "From few to a fandom",
    description: "Get any community running with moderation tools and custom member access. Give members special powers, set up private channels, and more.",
  },
  {
    icon: Shield,
    title: "Reliable tech for staying close",
    description: "Low-latency voice and video feels like you're in the same room. Wave hello over video, watch friends stream their games, or gather up and have a drawing session with screen share.",
  },
];

function FeatureCard({ feature, index }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 100 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 100 }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
      className="relative group"
    >
      <motion.div
        className="bg-[#111] rounded-3xl p-8 border border-[#FF3333]/20 relative overflow-hidden"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: "radial-gradient(circle at center, rgba(255, 51, 51, 0.1) 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"
          style={{ boxShadow: "0 0 30px rgba(255, 51, 51, 0.5)" }}
        />

        <div className="relative z-10">
          <motion.div
            className="w-16 h-16 bg-[#FF3333]/20 rounded-2xl flex items-center justify-center mb-6 relative"
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <feature.icon className="text-[#FF3333] w-8 h-8 relative z-10" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
          <p className="text-gray-400 leading-relaxed">{feature.description}</p>
        </div>

        <div className="absolute top-0 right-0 w-32 h-32 opacity-20 animate-spin" style={{ animationDuration: "20s" }}>
          <div className="w-full h-full border-t-2 border-r-2 border-[#FF3333] rounded-tr-3xl" />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function LandingFeatures() {
  const titleRef = useRef(null);
  const isInView = useInView(titleRef, { once: true });

  return (
    <section id="features" className="py-32 px-6 relative">
      <motion.div
        ref={titleRef}
        className="max-w-4xl mx-auto text-center mb-20"
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
      >
        <h2 className="text-5xl md:text-6xl font-black text-white mb-6 relative">
          <motion.span
            className="absolute inset-0 text-[#FF3333] blur-lg"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            aria-hidden="true"
          >
            Spin your web of connections
          </motion.span>
          <span className="relative">Spin your web of connections</span>
        </h2>
        <p className="text-xl text-gray-400">Everything you need to build amazing communities</p>
      </motion.div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
        {features.map((feature, index) => (
          <FeatureCard key={index} feature={feature} index={index} />
        ))}
      </div>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <motion.path
            d="M 0 100 Q 200 50 400 100 T 800 100"
            stroke="#FF3333"
            strokeWidth="1"
            fill="none"
            opacity="0.3"
            animate={{ d: ["M 0 100 Q 200 50 400 100 T 800 100", "M 0 100 Q 200 150 400 100 T 800 100", "M 0 100 Q 200 50 400 100 T 800 100"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>
    </section>
  );
}
