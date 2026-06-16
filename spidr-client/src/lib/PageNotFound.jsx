import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, LogIn } from 'lucide-react';
import { auth } from '@/api/apiClient';
import spiderImage from '@/assets/error404_Spidr.png';
import backgroundImage from '@/assets/error404_background.png';

/**
 * 404 page. Cave/web background is the canvas; the spider mascot sits on the
 * web, with the 404 headline + message floating above it.
 */
export default function PageNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const attemptedPath = location.pathname + (location.search || '');

  const { data: authData } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const user = await auth.me();
        return { user, isAuthenticated: true };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const isAuthenticated = !!authData?.isAuthenticated;
  const goHome = () => navigate(isAuthenticated ? '/home' : '/');
  const goBack = () => (window.history.length > 1 ? navigate(-1) : goHome());

  return (
    <div
      role="alert"
      aria-live="polite"
      className="min-h-screen w-full relative overflow-hidden bg-black"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Subtle dark vignette so the text reads cleanly against the cave. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 min-h-screen w-full flex flex-col items-center text-center px-4 sm:px-6 pt-[clamp(5rem,12vh,8rem)] pb-10"
      >
        {/* 404 headline */}
        <h1 className="font-extrabold tracking-tight leading-none select-none drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)]">
          <span style={{ fontSize: 'clamp(4rem,16vw,11rem)' }} className="text-red-600">4</span>
          <span style={{ fontSize: 'clamp(4rem,16vw,11rem)' }} className="text-zinc-300">04</span>
        </h1>

        {/* Subtitle */}
        <h2
          className="mt-1 text-zinc-300 font-semibold drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
          style={{
            fontSize: 'clamp(0.9rem,2.4vw,1.75rem)',
            letterSpacing: '0.35em',
          }}
        >
          PAGE NOT FOUND
        </h2>

        {/* Message */}
        <p
          className="mt-5 text-zinc-300/90 max-w-2xl leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] px-2"
          style={{ fontSize: 'clamp(1.1rem,2.8vw,2.25rem)' }}
        >
          Oops! Looks like you got lost in the web.
          <br />
          Let's find your way back.
        </p>

        {authData?.user?.role === 'admin' && (
          <p className="mt-4 text-xs text-zinc-500">
            <span className="text-red-500/80">admin note:</span> {attemptedPath} isn't wired up yet.
          </p>
        )}
      </motion.div>

      {/* Spider — pinned to the web zone of the cave artwork via viewport-relative
          bottom offset, so it lands on the web at every aspect ratio. */}
      <img
        src={spiderImage}
        alt="A confused spider holding a treasure map."
        className="absolute left-1/2 -translate-x-1/2 z-10 select-none drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)] pointer-events-none bottom-[23vh] sm:bottom-[19vh] md:bottom-[15vh] lg:bottom-[10vh] w-[82vw] sm:w-[80vw] md:w-[78vw] lg:w-[min(75vw,800px)]"
        style={{ maxWidth: '95vw' }}
        draggable={false}
      />

      {/* Floating action bar — anchored top-right, out of the artwork's way.
          On narrow screens shrinks and wraps so it never collides with the headline. */}
      <div className="fixed top-3 right-3 sm:top-6 sm:right-6 z-20 flex flex-wrap items-center justify-end gap-2 sm:gap-3 max-w-[calc(100vw-1.5rem)]">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 sm:gap-2.5 px-3.5 sm:px-7 py-2 sm:py-3.5 rounded-lg sm:rounded-xl text-xs sm:text-base font-semibold text-zinc-100 bg-black/70 backdrop-blur-md border border-zinc-700/70 hover:bg-zinc-800/90 hover:text-white transition-colors shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          Go Back
        </button>

        <button
          onClick={goHome}
          className="inline-flex items-center gap-1.5 sm:gap-2.5 px-3.5 sm:px-7 py-2 sm:py-3.5 rounded-lg sm:rounded-xl text-xs sm:text-base font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-[0_12px_32px_-8px_rgba(220,38,38,0.75)] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <Home className="w-4 h-4 sm:w-5 sm:h-5" />
          {isAuthenticated ? 'Return Home' : 'Back to Landing'}
        </button>

        {!isAuthenticated && (
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 sm:gap-2.5 px-3.5 sm:px-7 py-2 sm:py-3.5 rounded-lg sm:rounded-xl text-xs sm:text-base font-semibold text-red-200 bg-black/60 backdrop-blur-md border border-red-900/60 hover:bg-red-950/50 hover:text-red-100 transition-colors shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}
