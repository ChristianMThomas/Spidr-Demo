import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Mic, MicOff, VideoOff, Settings, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CallAVControls({ onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [activeFilter, setActiveFilter] = useState('normal');
  const [voiceEffect, setVoiceEffect] = useState('normal');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const streamRef = useRef(null);
  
  // Keep ref in sync
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Strict cleanup on unmount — kill all tracks
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
      }
    };
  }, []);

  useEffect(() => {
    let animationFrameId;

    const render = () => {
      if (!videoRef.current || !canvasRef.current || isVideoOff) return;
      const ctx = canvasRef.current.getContext('2d');
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      ctx.drawImage(videoRef.current, 0, 0, width, height);
      ctx.filter = 'none';

      if (activeFilter === 'hud') {
        ctx.strokeStyle = '#FF3333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 50); ctx.lineTo(20, 20); ctx.lineTo(50, 20);
        ctx.moveTo(width-50, 20); ctx.lineTo(width-20, 20); ctx.lineTo(width-20, 50);
        ctx.moveTo(20, height-50); ctx.lineTo(20, height-20); ctx.lineTo(50, height-20);
        ctx.moveTo(width-50, height-20); ctx.lineTo(width-20, height-20); ctx.lineTo(width-20, height-50);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 51, 51, 0.1)';
        for(let i=0; i<height; i+=4) {
          ctx.fillRect(0, i, width, 1);
        }
        
        ctx.font = '10px monospace';
        ctx.fillStyle = '#FF3333';
        ctx.fillText('REC // OPTIMAL', 25, 35);
      }

      if (activeFilter === 'symbiote') {
        const gradient = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, 150);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(1, 'black');
        ctx.fillStyle = gradient;
        ctx.fillRect(0,0,width,height);
      }

      if (activeFilter === 'glitch') {
        const sliceHeight = 8;
        const offset = Math.random() * 8 - 4;
        ctx.drawImage(videoRef.current, 0, 80, width, sliceHeight, offset, 80, width, sliceHeight);
        ctx.fillStyle = 'rgba(255, 51, 51, 0.15)';
        ctx.fillRect(0, 0, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [activeFilter, brightness, contrast, isVideoOff]);

  const toggleMute = () => {
    const s = streamRef.current;
    if (s) {
      s.getAudioTracks().forEach(track => track.enabled = isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    if (isVideoOff) {
      // Turn camera ON
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setIsVideoOff(false);
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    } else {
      // Turn camera OFF — kill all tracks explicitly
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.enabled = false;
          track.stop();
        });
      }
      streamRef.current = null;
      setStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsVideoOff(true);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      className="fixed top-20 right-6 z-50 w-96 bg-black/95 backdrop-blur-xl rounded-2xl border-2 border-red-600/40 shadow-[0_0_50px_rgba(220,38,38,0.3)] overflow-hidden"
    >
      {/* Hanging Spider Thread */}
      <motion.div 
        className="absolute -top-16 left-1/2 -translate-x-1/2 w-[3px] h-16 bg-gradient-to-b from-transparent via-red-600/40 to-red-600"
        animate={{ 
          scaleY: [1, 1.02, 1],
          opacity: [0.6, 0.8, 0.6]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Pulsing Connection Nodes */}
      <motion.div 
        className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full"
        animate={{ 
          scale: [1, 1.3, 1],
          boxShadow: [
            '0 0 10px rgba(220, 38, 38, 0.5)',
            '0 0 20px rgba(220, 38, 38, 0.8)',
            '0 0 10px rgba(220, 38, 38, 0.5)'
          ]
        }}
        transition={{ 
          duration: 1.5,
          repeat: Infinity 
        }}
      />
      {/* Top Web Attachment Indicator */}
      <div className="h-3 bg-gradient-to-b from-red-900/20 to-transparent flex items-start justify-center pt-1">
        <div className="w-8 h-[2px] bg-red-600/30 rounded-full" />
      </div>
      
      {/* Video Preview */}
      <div className="relative aspect-video bg-black border-t-2 border-red-600/20">
        <video ref={videoRef} autoPlay muted playsInline className="absolute opacity-0 pointer-events-none" />
        <canvas ref={canvasRef} width={320} height={180} className="w-full h-full object-cover" />
        
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <VideoOff className="w-12 h-12 text-zinc-600" />
          </div>
        )}

        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-red-600/30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-red-400 font-mono font-bold tracking-wider">
              {activeFilter.toUpperCase()} FILTER ACTIVE
            </span>
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 text-white hover:bg-red-600"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3 bg-gradient-to-b from-zinc-900 to-black border-t border-red-900/20">
        {/* Quick Filters */}
        <div>
          <div className="text-[10px] text-zinc-500 font-mono mb-2 uppercase tracking-wider">Video Filters</div>
          <div className="grid grid-cols-4 gap-2">
            {['normal', 'hud', 'symbiote', 'glitch'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase transition-all border ${
                  activeFilter === filter
                    ? 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border-zinc-700/50'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Effects */}
        <div>
          <div className="text-[10px] text-zinc-500 font-mono mb-2 uppercase tracking-wider">Voice Effects</div>
          <div className="grid grid-cols-3 gap-2">
            {['normal', 'deep', 'robot'].map((voice) => (
              <button
                key={voice}
                onClick={() => setVoiceEffect(voice)}
                className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase transition-all border ${
                  voiceEffect === voice
                    ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border-zinc-700/50'
                }`}
              >
                {voice}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2"
            >
              <div>
                <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                  <span>Brightness</span>
                  <span>{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={brightness}
                  onChange={(e) => setBrightness(e.target.value)}
                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none accent-[#FF3333]"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                  <span>Contrast</span>
                  <span>{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={contrast}
                  onChange={(e) => setContrast(e.target.value)}
                  className="w-full h-1 bg-zinc-700 rounded-lg appearance-none accent-[#FF3333]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={toggleMute}
            className={`flex-1 ${isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-800 hover:bg-zinc-700'}`}
          >
            {isMuted ? <MicOff className="w-4 h-4 mr-1" /> : <Mic className="w-4 h-4 mr-1" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button
            size="sm"
            onClick={toggleVideo}
            className={`flex-1 ${isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-800 hover:bg-zinc-700'}`}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4 mr-1" /> : <Camera className="w-4 h-4 mr-1" />}
            {isVideoOff ? 'Video On' : 'Video Off'}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowSettings(!showSettings)}
            className="text-zinc-400 hover:text-white"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}