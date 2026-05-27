import React, { useRef, useState, useEffect } from 'react';
import { Camera, Mic, Activity, Ghost, Zap, Cpu, Sliders } from 'lucide-react';

export default function AVLab() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  
  // STATE: Active Effects
  const [activeFilter, setActiveFilter] = useState('normal'); // normal, hud, symbiote, glitch
  const [voiceEffect, setVoiceEffect] = useState('normal');   // normal, deep, robot
  
  // STATE: Manual Settings
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  // 1. INITIALIZE CAMERA
  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error("Camera denied:", err);
      }
    }
    startCamera();
    return () => {
      // Cleanup: Stop camera when component closes
      if(stream) stream.getTracks().forEach(track => track.stop());
    }
  }, []);

  // 2. THE "RENDER LOOP" (Applies Video Filters)
  useEffect(() => {
    let animationFrameId;

    const render = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      // Draw the raw video frame
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(videoRef.current, 0, 0, width, height);
      ctx.filter = 'none'; // Reset filter for overlays

      // --- APPLY "SNAPCHAT" STYLE OVERLAYS ---
      
      if (activeFilter === 'hud') {
        // CYBERPUNK HUD OVERLAY
        ctx.strokeStyle = '#FF3333';
        ctx.lineWidth = 2;
        // Corner brackets
        ctx.beginPath();
        ctx.moveTo(20, 50); ctx.lineTo(20, 20); ctx.lineTo(50, 20);
        ctx.moveTo(width-50, 20); ctx.lineTo(width-20, 20); ctx.lineTo(width-20, 50);
        ctx.moveTo(20, height-50); ctx.lineTo(20, height-20); ctx.lineTo(50, height-20);
        ctx.moveTo(width-50, height-20); ctx.lineTo(width-20, height-20); ctx.lineTo(width-20, height-50);
        ctx.stroke();
        
        // Scanlines
        ctx.fillStyle = 'rgba(255, 51, 51, 0.1)';
        for(let i=0; i<height; i+=4) {
            ctx.fillRect(0, i, width, 1);
        }
        
        // Text
        ctx.font = '12px monospace';
        ctx.fillStyle = '#FF3333';
        ctx.fillText('REC // SYS.OPTIMAL', 30, 40);
      }

      if (activeFilter === 'symbiote') {
        // VENOM/DARK MODE
        // We use "globalCompositeOperation" to darken the edges (Vignette)
        const gradient = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, 300);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'black');
        ctx.fillStyle = gradient;
        ctx.fillRect(0,0,width,height);
        
        // Add "Veins" (simulated by random black lines)
        if(Math.random() > 0.9) {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(Math.random()*width, 0);
            ctx.lineTo(width/2, height/2);
            ctx.stroke();
        }
      }

      if (activeFilter === 'glitch') {
        // COLOR SHIFT (RGB SPLIT)
        const sliceHeight = 10;
        const offset = Math.random() * 10 - 5;
        // Draw a slice of the video slightly offset
        ctx.drawImage(videoRef.current, 0, 100, width, sliceHeight, offset, 100, width, sliceHeight);
        
        ctx.fillStyle = 'rgba(255, 51, 51, 0.2)';
        ctx.fillRect(0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [activeFilter, brightness, contrast]);

  // 3. AUDIO PROCESSING (Voice Changer Logic)
  useEffect(() => {
    if(!stream) return;
    console.log(`Audio Processor: Switching to ${voiceEffect} mode.`);
  }, [voiceEffect, stream]);


  return (
    <div className="flex-1 h-screen bg-[#050505] p-8 flex flex-col items-center overflow-y-auto">
      <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-widest">A/V Modification Lab</h1>
      <p className="text-gray-500 mb-8 text-sm">Configure your digital persona.</p>

      <div className="flex gap-8 w-full max-w-5xl items-start">
        
        {/* --- PREVIEW WINDOW --- */}
        <div className="relative w-[640px] h-[480px] bg-black rounded-xl border-2 border-[#333] overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          {/* The Hidden Raw Video */}
          <video ref={videoRef} autoPlay muted playsInline className="absolute opacity-0 pointer-events-none" />
          
          {/* The Canvas (What users actually see) */}
          <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-cover" />
          
          <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded border border-white/10 text-xs text-[#FF3333] font-mono animate-pulse">
            LIVE FEED // {activeFilter.toUpperCase()}
          </div>
        </div>

        {/* --- CONTROLS PANEL --- */}
        <div className="flex-1 space-y-8">
          
          {/* 1. VISUAL FILTERS */}
          <div className="bg-[#111] border border-white/10 p-6 rounded-xl">
             <div className="flex items-center gap-2 mb-4 text-white">
               <Camera size={18} className="text-[#FF3333]" />
               <h3 className="font-bold text-sm">Visual Protocol</h3>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
               <FilterButton label="Standard" active={activeFilter === 'normal'} onClick={() => setActiveFilter('normal')} />
               <FilterButton label="Cyber HUD" active={activeFilter === 'hud'} onClick={() => setActiveFilter('hud')} icon={Cpu} />
               <FilterButton label="Symbiote" active={activeFilter === 'symbiote'} onClick={() => setActiveFilter('symbiote')} icon={Ghost} />
               <FilterButton label="Glitch" active={activeFilter === 'glitch'} onClick={() => setActiveFilter('glitch')} icon={Zap} />
             </div>

             {/* Sliders */}
             <div className="mt-6 space-y-4">
               <div className="space-y-1">
                 <div className="flex justify-between text-xs text-gray-400"><span>Brightness</span><span>{brightness}%</span></div>
                 <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(e.target.value)} className="w-full accent-[#FF3333] h-1 bg-gray-700 rounded-lg appearance-none" />
               </div>
               <div className="space-y-1">
                 <div className="flex justify-between text-xs text-gray-400"><span>Contrast</span><span>{contrast}%</span></div>
                 <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(e.target.value)} className="w-full accent-[#FF3333] h-1 bg-gray-700 rounded-lg appearance-none" />
               </div>
             </div>
          </div>

          {/* 2. VOICE MODULATORS */}
          <div className="bg-[#111] border border-white/10 p-6 rounded-xl">
             <div className="flex items-center gap-2 mb-4 text-white">
               <Mic size={18} className="text-[#FF3333]" />
               <h3 className="font-bold text-sm">Voice Modulation</h3>
             </div>
             
             <div className="grid grid-cols-3 gap-3">
               <FilterButton label="Natural" active={voiceEffect === 'normal'} onClick={() => setVoiceEffect('normal')} />
               <FilterButton label="Venom" active={voiceEffect === 'deep'} onClick={() => setVoiceEffect('deep')} icon={Activity} />
               <FilterButton label="Droid" active={voiceEffect === 'robot'} onClick={() => setVoiceEffect('robot')} icon={Cpu} />
             </div>
             
             {voiceEffect !== 'normal' && (
                <div className="mt-4 p-3 bg-[#FF3333]/10 border border-[#FF3333]/30 rounded text-xs text-[#FF3333] flex items-center gap-2">
                  <Activity size={14} className="animate-pulse" />
                  Voice Processor Active
                </div>
             )}
          </div>

          <button className="w-full py-4 bg-[#FF3333] text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(255,51,51,0.4)]">
            SAVE CONFIGURATION
          </button>

        </div>
      </div>
    </div>
  );
}

// Sub-component for buttons
const FilterButton = ({ label, active, onClick, icon: Icon }) => (
  <button 
    onClick={onClick}
    className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
      active 
        ? 'bg-[#FF3333] border-[#FF3333] text-white shadow-lg' 
        : 'bg-[#0a0a0a] border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
    }`}
  >
    {Icon && <Icon size={14} />}
    <span className="text-xs font-bold">{label}</span>
  </button>
);