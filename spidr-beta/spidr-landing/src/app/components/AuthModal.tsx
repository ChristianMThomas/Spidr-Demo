import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { X, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import logo from "../../assets/9b09e8f82b8b68416b063e6bcab7ae0d32d631fe.png";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    username: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Handle authentication logic here
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="relative w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Liquid blob background */}
              <motion.div
                className="absolute inset-0 rounded-3xl opacity-30"
                style={{
                  background: "radial-gradient(circle at center, rgba(255, 51, 51, 0.4) 0%, transparent 70%)",
                  filter: "blur(60px)",
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Card */}
              <div className="relative bg-[#111] rounded-3xl border-2 border-[#8B0000]/30 overflow-hidden">
                {/* Animated border glow */}
                <motion.div
                  className="absolute inset-0 opacity-50 pointer-events-none"
                  animate={{
                    boxShadow: [
                      "inset 0 0 20px rgba(255, 51, 51, 0.3)",
                      "inset 0 0 40px rgba(255, 51, 51, 0.6)",
                      "inset 0 0 20px rgba(255, 51, 51, 0.3)",
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  style={{ borderRadius: "1.5rem" }}
                />

                <div className="relative z-10 p-8">
                  {/* Close Button */}
                  <motion.button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-10 h-10 bg-[#0a0a0a] rounded-full flex items-center justify-center border border-[#8B0000]/20 hover:border-[#8B0000] transition-colors"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </motion.button>

                  {/* Logo */}
                  <motion.div
                    className="flex flex-col items-center mb-8"
                    animate={{
                      y: [0, -5, 0],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <img src={logo} alt="Spidr" className="w-20 h-20 mb-4" />
                    <h2 className="text-3xl font-black text-white">
                      {isSignUp ? "Join Spidr" : "Welcome Back"}
                    </h2>
                    <p className="text-gray-400 mt-2">
                      {isSignUp
                        ? "Create your account to start spinning your web"
                        : "We're so excited to see you again!"}
                    </p>
                  </motion.div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Username (Sign Up Only) */}
                    <AnimatePresence mode="wait">
                      {isSignUp && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                            Username
                          </label>
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-[#8B0000] transition-colors" />
                            <input
                              type="text"
                              value={formData.username}
                              onChange={(e) =>
                                setFormData({ ...formData, username: e.target.value })
                              }
                              className="w-full bg-[#0a0a0a] border border-[#8B0000]/20 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-600 focus:border-[#8B0000] focus:outline-none transition-colors"
                              placeholder="Enter your username"
                              required
                              autoComplete="username"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                        Email
                      </label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-[#8B0000] transition-colors" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="w-full bg-[#0a0a0a] border border-[#8B0000]/20 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-600 focus:border-[#8B0000] focus:outline-none transition-colors"
                          placeholder="Enter your email"
                          required
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                        Password
                      </label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-hover:text-[#8B0000] transition-colors" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                          }
                          className="w-full bg-[#0a0a0a] border border-[#8B0000]/20 rounded-xl pl-12 pr-12 py-3 text-white placeholder-gray-600 focus:border-[#8B0000] focus:outline-none transition-colors"
                          placeholder="Enter your password"
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#8B0000] transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Forgot Password (Sign In Only) */}
                    {!isSignUp && (
                      <div className="text-right">
                        <a
                          href="#"
                          className="text-sm text-[#8B0000] hover:underline"
                        >
                          Forgot your password?
                        </a>
                      </div>
                    )}

                    {/* Submit Button */}
                    <motion.button
                      type="submit"
                      className="w-full bg-[#8B0000] text-white py-3 rounded-xl font-bold text-lg relative overflow-hidden"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-white"
                        initial={{ scale: 0, opacity: 0.5 }}
                        whileHover={{ scale: 2, opacity: 0 }}
                        transition={{ duration: 0.6 }}
                      />
                      <span className="relative z-10">
                        {isSignUp ? "Sign Up" : "Sign In"}
                      </span>
                    </motion.button>

                    {/* Toggle Sign In/Sign Up */}
                    <div className="text-center pt-4">
                      <span className="text-gray-400 text-sm">
                        {isSignUp
                          ? "Already have an account?"
                          : "Need an account?"}
                      </span>{" "}
                      <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-[#8B0000] font-semibold hover:underline"
                      >
                        {isSignUp ? "Sign In" : "Sign Up"}
                      </button>
                    </div>
                  </form>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#8B0000]/20" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-[#111] text-gray-500">OR</span>
                    </div>
                  </div>

                  {/* Social Login (Optional) */}
                  <div className="space-y-3">
                    <motion.button
                      type="button"
                      className="w-full bg-[#0a0a0a] border border-[#8B0000]/20 text-white py-3 rounded-xl font-semibold hover:border-[#8B0000] transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => alert("Google login coming soon!")}
                    >
                      Continue with Google
                    </motion.button>
                    <motion.button
                      type="button"
                      className="w-full bg-[#0a0a0a] border border-[#8B0000]/20 text-white py-3 rounded-xl font-semibold hover:border-[#8B0000] transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => alert("Discord login coming soon!")}
                    >
                      Continue with Discord
                    </motion.button>
                  </div>
                </div>

                {/* Corner decorations */}
                {[
                  { top: 0, left: 0, rotate: 0 },
                  { top: 0, right: 0, rotate: 90 },
                  { bottom: 0, right: 0, rotate: 180 },
                  { bottom: 0, left: 0, rotate: 270 },
                ].map((pos, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-16 h-16 pointer-events-none"
                    style={pos}
                    animate={{ rotate: pos.rotate + 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="w-full h-full border-t-2 border-l-2 border-[#8B0000]/20 rounded-tl-2xl" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
