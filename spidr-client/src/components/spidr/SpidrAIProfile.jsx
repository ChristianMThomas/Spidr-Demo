import React, { useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import SpiderLogo from './SpiderLogo';

const SPIDR_AI_AVATAR = '/logo-bg.png';

export { SPIDR_AI_AVATAR };

export default function SpidrAIProfile({ open, onClose }) {
  const cardRef = useRef(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRotation({
      x: ((y - rect.height / 2) / 20) * -1,
      y: (x - rect.width / 2) / 20
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-transparent border-0 shadow-none max-w-md p-0">
        <div style={{ perspective: '1000px', padding: '50px' }}>
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setRotation({ x: 0, y: 0 })}
            style={{
              transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              transition: 'transform 0.1s ease-out',
              background: 'rgba(20, 20, 20, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '3px solid #FF3333',
              borderRadius: '20px',
              width: '350px',
              minHeight: '500px',
              position: 'relative',
              boxShadow: '0 0 30px rgba(255, 51, 51, 0.4), 0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden'
            }}
          >
            {/* Banner */}
            <div style={{
              height: '120px',
              background: 'linear-gradient(135deg, #FF3333 0%, #990000 40%, #1a0000 100%)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Animated web pattern */}
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.15,
                backgroundImage: 'radial-gradient(circle at 50% 50%, transparent 30%, rgba(255,51,51,0.3) 31%, transparent 32%), radial-gradient(circle at 50% 50%, transparent 60%, rgba(255,51,51,0.2) 61%, transparent 62%)',
                backgroundSize: '100px 100px'
              }} />
              <div className="absolute bottom-2 right-3 flex items-center gap-1">
                <SpiderLogo size={14} />
                <span className="text-[10px] text-white/50 font-mono tracking-widest">SYSTEM AI</span>
              </div>
            </div>

            {/* Avatar */}
            <div style={{ marginTop: '-40px', marginLeft: '20px', position: 'relative' }}>
              <img
                src="/logo.png"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: '3px solid #FF3333',
                  objectFit: 'cover',
                  boxShadow: '0 0 20px rgba(255, 51, 51, 0.6)'
                }}
                alt="Spidr AI"
              />
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: '20px', height: '20px', borderRadius: '50%',
                background: '#22c55e', border: '2px solid #141414'
              }} />
            </div>

            {/* Info */}
            <div style={{ padding: '20px', color: 'white' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '22px' }}>
                SPIDR_AI
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: 'linear-gradient(135deg, #FF3333, #990000)',
                  padding: '3px 8px', borderRadius: '12px',
                  fontSize: '10px', fontWeight: 'bold', color: 'white',
                  boxShadow: '0 0 15px rgba(255, 51, 51, 0.5)'
                }}>
                  <SpiderLogo size={12} />
                  AI
                </span>
                <Badge className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px]">
                  VERIFIED BOT
                </Badge>
              </h2>
              <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px', lineHeight: '1.6' }}>
                Hey, I'm Spidr AI — your chill AI buddy built right into Spidr. I hang out in voice channels, play music, stream videos, answer questions, and keep the vibes going. Just summon me anytime! 🕷️
              </p>
            </div>

            {/* Widgets */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0 20px 20px' }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,51,51,0.2)' }}>
                <div style={{ fontSize: '10px', color: '#FF3333', textTransform: 'uppercase' }}>Role</div>
                <div style={{ fontSize: '12px', color: 'white', fontWeight: 'bold' }}>🤖 System AI</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,51,51,0.2)' }}>
                <div style={{ fontSize: '10px', color: '#FF3333', textTransform: 'uppercase' }}>Status</div>
                <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 'bold' }}>🟢 Always Online</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,51,51,0.2)' }}>
                <div style={{ fontSize: '10px', color: '#FF3333', textTransform: 'uppercase' }}>Powers</div>
                <div style={{ fontSize: '11px', color: 'white' }}>🎵 Music · 📺 Streams · 💬 Chat</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,51,51,0.2)' }}>
                <div style={{ fontSize: '10px', color: '#FF3333', textTransform: 'uppercase' }}>Neon Sign</div>
                <div style={{
                  fontSize: '12px', color: '#ec4899', fontWeight: 'bold',
                  textShadow: '0 0 10px rgba(236, 72, 153, 0.8)'
                }}>
                  🕸️ it/its
                </div>
              </div>
            </div>

            {/* Fun fact */}
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{
                background: 'rgba(255, 51, 51, 0.08)',
                border: '1px solid rgba(255, 51, 51, 0.2)',
                borderRadius: '10px', padding: '12px'
              }}>
                <div style={{ fontSize: '10px', color: '#FF3333', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Fun Fact
                </div>
                <div style={{ fontSize: '11px', color: '#ccc', lineHeight: '1.5' }}>
                  I was woven into Spidr's neural web from day one. I can DJ your sessions, answer random trivia, 
                  and even roast your friends (lovingly). Try <span style={{ color: '#FF3333', fontFamily: 'monospace' }}>/ask</span> in any channel!
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}