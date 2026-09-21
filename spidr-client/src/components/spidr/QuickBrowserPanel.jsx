import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Globe, Loader2, RefreshCw, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import './QuickBrowserPanel.css';

const initial = { url: '', title: 'New page', loading: false, muted: true, canGoBack: false, canGoForward: false, error: '' };

export default function QuickBrowserPanel({ onClose, rightInset = 0, topInset = 40, bottomInset = 96 }) {
  const api = window.electronAPI?.quickBrowser;
  const [state, setState] = useState(initial);
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const slot = useRef(null);

  useEffect(() => {
    if (!api) return;
    let alive = true;
    const off = api.onState(next => { if (alive) setState(next); });
    api.open().then(next => { if (alive) { setState(next); setReady(true); } }).catch(() => { if (alive) setError('Could not open the desktop browser.'); });
    return () => { alive = false; off(); api.close().catch(() => {}); };
  }, [api]);

  useEffect(() => { setInput(state.url); }, [state.url]);

  // A native view sits above HTML. Hide it whenever a Spidr overlay covers
  // its slot, and measure in CSS pixels (the main process handles zoom).
  useEffect(() => {
    if (!ready || !slot.current) return;
    const element = slot.current;
    let frame = 0, previous = '';
    const measure = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      let visible = !!state.url && !document.hidden && rect.width > 0 && rect.height > 0;
      if (document.querySelector('[aria-modal="true"][data-state="open"], dialog[open]')) visible = false;
      for (const x of [0.05, 0.5, 0.95]) for (const y of [0.05, 0.5, 0.95]) {
        const top = document.elementFromPoint(rect.x + rect.width * x, rect.y + rect.height * y);
        if (top !== element && !element.contains(top)) visible = false;
      }
      const payload = { bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, visible };
      const key = JSON.stringify(payload);
      if (key !== previous) {
        previous = key;
        api.layout(payload).catch(() => {});
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    resize.observe(element);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-state', 'aria-hidden'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    document.addEventListener('visibilitychange', schedule);
    const timer = setInterval(schedule, 250);
    schedule();
    return () => {
      cancelAnimationFrame(frame); clearInterval(timer); resize.disconnect(); mutations.disconnect();
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true);
      document.removeEventListener('visibilitychange', schedule);
      api.layout({ visible: false }).catch(() => {});
    };
  }, [api, ready, !!state.url]);

  const run = async operation => {
    setError('');
    try { await operation(); } catch { setError('Browser action failed. Please try again.'); }
  };
  const navigate = event => { event.preventDefault(); if (input.trim()) run(() => api.navigate(input)); };
  const action = name => run(() => api.action(name));

  return (
    <aside className="quick-browser-panel" aria-label="Quick browser" style={{ right: rightInset, top: topInset, bottom: bottomInset }}>
      <header className="quick-browser-heading">
        <Globe size={16} style={{ color: 'var(--spidr-accent, #ff3333)' }} />
        <span className="truncate flex-1 text-sm font-semibold" title={state.title}>{state.title || 'Quick browser'}</span>
        <IconButton label={state.muted ? 'Unmute browser' : 'Mute browser'} onClick={() => action('mute')} disabled={!ready}>
          {state.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </IconButton>
        <IconButton label="Open in default browser" onClick={() => action('external')} disabled={!state.url}><ExternalLink size={16} /></IconButton>
        <IconButton label="Close quick browser" onClick={onClose}><X size={16} /></IconButton>
      </header>
      <form onSubmit={navigate} className="quick-browser-navigation">
        <IconButton label="Back" disabled={!state.canGoBack} onClick={() => action('back')}><ArrowLeft size={15} /></IconButton>
        <IconButton label="Forward" disabled={!state.canGoForward} onClick={() => action('forward')}><ArrowRight size={15} /></IconButton>
        <IconButton label={state.loading ? 'Stop loading' : 'Reload page'} disabled={!state.url} onClick={() => action(state.loading ? 'stop' : 'reload')}>
          {state.loading ? <X size={15} /> : <RefreshCw size={15} />}
        </IconButton>
        <input value={input} onChange={event => setInput(event.target.value)} onFocus={event => event.target.select()}
          aria-label="Browser address" placeholder="Search or enter address" spellCheck={false} autoComplete="off" disabled={!ready} />
        <button type="submit" title="Go" aria-label="Go" disabled={!ready || !input.trim()} className="quick-browser-icon"><ArrowRight size={15} /></button>
      </form>
      {(error || state.error) && <div role="alert" className="quick-browser-error">{error || state.error}</div>}
      <div ref={slot} className="quick-browser-content" data-quick-browser-slot>
        {!state.url && <img src="/brand/spidr-symbol.png" alt="Spidr" className="w-16 h-16 object-contain opacity-50" />}
      </div>
      <footer className="quick-browser-status">
        {state.loading ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
        <span>{state.loading ? 'Loading' : state.url ? new URL(state.url).hostname : 'Quick browser'}</span>
        <span className="ml-auto">{state.muted ? 'Muted' : 'Sound on'}</span>
      </footer>
    </aside>
  );
}

function IconButton({ label, children, ...props }) {
  return <button type="button" className="quick-browser-icon" title={label} aria-label={label} {...props}>{children}</button>;
}
