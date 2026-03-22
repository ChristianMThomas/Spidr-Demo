css
/* The Container */
.kinetic-scroll {
  overflow-y: auto;
  scroll-behavior: smooth;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Base Message Card */
.tech-card {
  position: relative;
  max-width: 70%;
  padding: 12px 18px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #eee;
  /* The "Tech Cut" - angled corners */
  clip-path: polygon(
    10px 0, 100% 0, 
    100% calc(100% - 10px), calc(100% - 10px) 100%, 
    0 100%, 0 10px
  );
  transition: all 0.2s ease;
}

/* Incoming Message (Left) */
.msg-incoming {
  align-self: flex-start;
  background: rgba(30, 30, 30, 0.9);
  border-left: 2px solid #555;
}

/* Outgoing Message (Right - You) */
.msg-outgoing {
  align-self: flex-end;
  background: linear-gradient(135deg, #FF3333 0%, #990000 100%);
  border-right: 2px solid #ff8888;
  color: white;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* The "Hype/Combo" Message (Glowing) */
.msg-combo {
  align-self: center;
  text-align: center;
  background: rgba(255, 51, 51, 0.1);
  border: 1px solid #FF3333;
  color: #FF3333;
  font-weight: bold;
  letter-spacing: 2px;
  text-transform: uppercase;
  width: 100%;
  clip-path: polygon(0 0, 100% 0, 95% 100%, 5% 100%); /* Trapezoid shape */
  animation: pulse-red 1s infinite;
}

@keyframes pulse-red {
  0% { box-shadow: 0 0 5px rgba(255,51,51,0.2); }
  50% { box-shadow: 0 0 20px rgba(255,51,51,0.6); }
  100% { box-shadow: 0 0 5px rgba(255,51,51,0.2); }
}

/* --- THE SPIDR "WEB SENSE" INDICATOR --- */

/* The Container */
.web-sense-container {
  position: relative;
  width: 100%;
  height: 20px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

/* The Thread (The Line) */
.web-thread {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  background: #333; /* Dark grey when idle */
  transition: all 0.3s ease;
}

/* The Thread when Active (Typing) */
.web-thread.active {
  background: #FF3333; /* Neon Red */
  box-shadow: 0 0 10px rgba(255, 51, 51, 0.5); /* Glow */
  animation: thread-shiver 0.1s infinite; /* The Vibration */
}

/* The "Spider Node" (The Skittering Dot) */
.spider-node {
  position: absolute;
  top: 50%;
  left: -10px; /* Start off-screen */
  width: 8px;
  height: 8px;
  background: #FF3333;
  border-radius: 50%; /* Circle shape */
  transform: translateY(-50%);
  opacity: 0;
  box-shadow: 0 0 15px #FF3333;
  transition: opacity 0.2s;
}

/* When active, the node runs across the screen */
.spider-node.active {
  opacity: 1;
  animation: skitter 2s infinite linear alternate;
}

/* --- ANIMATIONS --- */

/* 1. The Vibration (Fast Jiggle) */
@keyframes thread-shiver {
  0% { transform: translateY(0); }
  25% { transform: translateY(-1px); }
  50% { transform: translateY(0); }
  75% { transform: translateY(1px); }
  100% { transform: translateY(0); }
}

/* 2. The Movement (Running back and forth) */
@keyframes skitter {
  0% { left: 10%; transform: translateY(-50%) scale(1); }
  20% { left: 30%; transform: translateY(-50%) scale(1.2); } /* Pause/Jump */
  40% { left: 50%; transform: translateY(-50%) scale(1); }
  60% { left: 70%; transform: translateY(-50%) scale(0.9); }
  80% { left: 90%; transform: translateY(-50%) scale(1.1); }
  100% { left: 95%; transform: translateY(-50%) scale(1); }
}
