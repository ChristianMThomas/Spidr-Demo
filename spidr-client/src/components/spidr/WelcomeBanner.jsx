import React from 'react';
import spidrMascot from '@/assets/spidr-mascot.png';

// Three-phase state machine per message: type in (~55ms/char) → hold (holdMs)
// → backspace out (~35ms/char) → advance. Ported from
// spidr-client/mobile/app/(tabs)/index.tsx so web/desktop match mobile.
function useTypewriter(messages, holdMs = 40000) {
  const [idx, setIdx] = React.useState(0);
  const [typed, setTyped] = React.useState('');
  const [phase, setPhase] = React.useState('type');
  const [caret, setCaret] = React.useState(true);
  const msg = messages[idx] || '';

  React.useEffect(() => {
    setIdx(0);
    setTyped('');
    setPhase('type');
  }, [messages]);

  React.useEffect(() => {
    if (phase === 'type') {
      if (typed.length < msg.length) {
        const t = setTimeout(() => setTyped(msg.slice(0, typed.length + 1)), 55);
        return () => clearTimeout(t);
      }
      setPhase('hold');
      return;
    }
    if (phase === 'hold') {
      const t = setTimeout(() => setPhase('delete'), holdMs);
      return () => clearTimeout(t);
    }
    if (typed.length > 0) {
      const t = setTimeout(() => setTyped(typed.slice(0, -1)), 35);
      return () => clearTimeout(t);
    }
    setIdx((i) => (i + 1) % messages.length);
    setPhase('type');
  }, [phase, typed, msg, messages.length, holdMs]);

  React.useEffect(() => {
    const int = setInterval(() => setCaret((c) => !c), 500);
    return () => clearInterval(int);
  }, []);

  return { typed, caret };
}

export default function WelcomeBanner({ name = 'spider' }) {
  const daysUntilBeta = React.useMemo(() => {
    // Month index 9 = October.
    const beta = new Date(2026, 9, 1, 0, 0, 0).getTime();
    const diff = beta - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }, []);

  const messages = React.useMemo(() => {
    const betaLine =
      daysUntilBeta > 0
        ? `${daysUntilBeta} day${daysUntilBeta === 1 ? '' : 's'} until beta release`
        : 'Beta is live';
    return [`Welcome back, ${name}`, betaLine];
  }, [name, daysUntilBeta]);

  const { typed, caret } = useTypewriter(messages, 40000);

  return (
    <div
      className="relative flex items-center overflow-hidden rounded-[18px]"
      style={{
        backgroundColor: 'rgba(10,10,10,0.72)',
        border: '1px solid rgba(255,255,255,0.05)',
        padding: 18,
      }}
    >
      {/* Hairline top accent */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ backgroundColor: 'rgba(239,68,68,0.35)' }}
      />

      {/* Mascot — floats over an ambient red bloom, no container ring */}
      <div
        className="relative mr-3.5 flex items-center justify-center shrink-0"
        style={{ width: 76, height: 76 }}
      >
        <div
          className="pointer-events-none absolute rounded-full blur-[18px]"
          style={{
            top: 8,
            left: 8,
            right: 8,
            bottom: 8,
            backgroundColor: 'rgba(239,68,68,0.22)',
            opacity: 0.9,
          }}
        />
        <img
          src={spidrMascot}
          alt="Spidr"
          draggable={false}
          className="relative z-10"
          style={{ width: 76, height: 76, objectFit: 'contain' }}
        />
      </div>

      {/* Copy */}
      <div className="min-w-0 flex-1">
        <h1
          className="text-white"
          style={{
            fontSize: 19,
            fontWeight: 800,
            lineHeight: '24px',
            letterSpacing: 0.2,
          }}
        >
          {typed}
          <span
            style={{
              color: '#ef4444',
              opacity: caret ? 1 : 0,
              transition: 'opacity 60ms linear',
            }}
          >
            ▎
          </span>
        </h1>
      </div>
    </div>
  );
}
