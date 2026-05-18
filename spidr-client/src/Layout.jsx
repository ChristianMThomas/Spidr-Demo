import React from 'react';
import { Toaster } from 'sonner';
import { MenuProvider } from '@/components/MenuContext';
import SpidrMenu from '@/components/ui/SpidrMenu';

export default function Layout({ children }) {
  return (
    <MenuProvider>
    <div className="bg-black w-full box-border" style={{ minWidth: '900px', minHeight: '550px', height: '100%', overflow: 'hidden' }}>
      <style>{`
        :root {
          --background: 0 0% 0%;
          --foreground: 0 0% 100%;
          --card: 240 10% 10%;
          --card-foreground: 0 0% 100%;
          --popover: 240 10% 10%;
          --popover-foreground: 0 0% 100%;
          --primary: 0 84% 60%;
          --primary-foreground: 0 0% 100%;
          --secondary: 240 10% 15%;
          --secondary-foreground: 0 0% 100%;
          --muted: 240 10% 15%;
          --muted-foreground: 240 5% 60%;
          --accent: 0 84% 60%;
          --accent-foreground: 0 0% 100%;
          --destructive: 0 84% 60%;
          --destructive-foreground: 0 0% 100%;
          --border: 0 50% 20%;
          --input: 240 10% 15%;
          --ring: 0 84% 60%;
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: #991b1b transparent;
        }

        *::-webkit-scrollbar {
          width: 6px;
          height: 0px;
        }

        *::-webkit-scrollbar-track {
          background: transparent;
        }

        *::-webkit-scrollbar-thumb {
          background: #991b1b;
          border-radius: 3px;
        }

        *::-webkit-scrollbar-thumb:hover {
          background: #dc2626;
        }

        body {
          background: #000;
          color: #fff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Glassmorphic styles */
        .glass {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        /* FORCE ALL TEXT TO BREAK */
        * {
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: break-word !important;
        }

        .glass-light {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
          }

          /* --- SILK & GLASS CHAT THEME --- */
          .glass-bubble {
            position: relative;
            padding: 12px 24px;
            border-radius: 24px;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            font-size: 0.95rem;
            line-height: 1.5;
            transition: all 0.2s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          }

          .bubble-in {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #f0f0f0;
            border-bottom-left-radius: 4px;
          }

          .bubble-out {
            background: linear-gradient(135deg, rgba(229, 62, 62, 0.15), rgba(229, 62, 62, 0.05));
            border: 1px solid rgba(229, 62, 62, 0.3);
            color: white;
            border-bottom-right-radius: 4px;
            text-align: right;
            box-shadow: 0 0 15px rgba(229, 62, 62, 0.05);
          }

          .thread-line {
            position: absolute;
            left: 20px;
            top: 40px;
            bottom: -20px;
            width: 2px;
            background: linear-gradient(to bottom, #333, transparent);
            z-index: 0;
          }

          .thread-line.active {
            background: linear-gradient(to bottom, #FF3333, rgba(255, 51, 51, 0.2));
            box-shadow: 0 0 8px rgba(255, 51, 51, 0.4);
          }

          /* Reply scroll-target highlight flash — fired when a reply card is clicked */
          .msg-flash {
            animation: msg-flash-anim 1.2s ease-out;
          }
          @keyframes msg-flash-anim {
            0%   { background-color: rgba(255, 51, 51, 0.18); box-shadow: inset 0 0 20px rgba(255,51,51,0.25); border-radius: 8px; }
            100% { background-color: transparent; box-shadow: none; }
          }

          /* Username effects — used by lib/usernameStyle.js */
          @keyframes username-rainbow {
            0%   { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
          @keyframes username-pulse {
            0%, 100% { opacity: 1;    filter: brightness(1);   }
            50%      { opacity: 0.55; filter: brightness(1.4); }
          }
          @keyframes username-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
      `}</style>
      {children}
      <SpidrMenu />
      <Toaster 
        position="top-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid rgba(220, 38, 38, 0.2)',
            color: '#fff'
          }
        }}
      />
      </div>
      </MenuProvider>
      );
      }