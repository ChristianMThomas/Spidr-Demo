import React from 'react';
import { Disc3, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import './DJVoiceLayout.css';

export default function DJVoiceLayout({ participants, count, open, onToggle, children, shares }) {
  return <section className="dj-voice-room" aria-label="Voice channel and DJ booth" data-deck-open={open}>
    <header className="dj-voice-header">
      <span>In voice <strong>{count}</strong></span>
      <button type="button" onClick={onToggle} aria-expanded={open} title={open ? 'Hide DJ deck' : 'Open DJ deck'}>
        <Disc3 size={15} />{open ? 'Hide DJ deck' : 'Open DJ deck'}{open ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </button>
    </header>
    <div className="dj-voice-split">
      <aside className="dj-voice-participants" aria-label="Voice participants">{participants}</aside>
      <div className="dj-voice-stage">
        <div className="dj-voice-scroll">
        <div className="dj-voice-deck" hidden={!open}>{children}</div>
        {!!shares && <div className="dj-voice-shares">{shares}</div>}
        </div>
      </div>
    </div>
  </section>;
}
