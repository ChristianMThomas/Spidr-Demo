import FlowArt, { FlowSection } from './ui/story-scroll';

// Divider helper — respects light vs dark bg
const HrLight = () => (
  <hr className="my-[2vw] border-none border-t border-white/25" />
);
const HrDark = () => (
  <hr className="my-[2vw] border-none border-t border-black/15" />
);

export default function WhySpidr() {
  return (
    <FlowArt id="features" aria-label="Why Spidr">

      {/* ── 01  BUILT DIFFERENT ── Maroon ───────────────────────────── */}
      <FlowSection
        aria-label="Built Different"
        style={{
          backgroundColor: '#8B0000',
          color: '#ffffff',
          paddingTop: 'clamp(5rem,10vw,7rem)',
        }}
      >
        <p className="text-xs font-bold font-mono uppercase tracking-[0.2em]">
          01 — BUILT DIFFERENT
        </p>
        <HrLight />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-black leading-[0.85] uppercase tracking-tight">
            BUILT<br />DIFFERENT
          </h2>
        </div>
        <HrLight />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Spidr isn't just another chat app. It's built for gaming clans, dev teams, creator
          collectives — every kind of community that demands more than a basic group chat.
        </p>
        <HrLight />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: 'Real Community', desc: 'Deep roots, not surface-level followers. Built for the people who actually show up.' },
            { label: 'Every Platform', desc: 'Windows, Mac, iOS, Android, and web — your crew can join from anywhere.' },
            { label: 'Zero Compromise', desc: 'Performance, privacy, and power — you shouldn\'t have to choose just two.' },
            { label: 'Launching Soon', desc: 'Join the beta and help shape the platform from day one.' },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">{label}</p>
              <p
                className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.72)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </FlowSection>

      {/* ── 02  KINETIC CHAT ── Black ────────────────────────────────── */}
      <FlowSection
        aria-label="KineticChat"
        style={{
          backgroundColor: '#000000',
          color: '#ffffff',
          paddingTop: 'clamp(5rem,10vw,7rem)',
        }}
      >
        <p className="text-xs font-bold font-mono uppercase tracking-[0.2em]">
          02 — KINETIC CHAT
        </p>
        <HrLight />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-black leading-[0.85] uppercase tracking-tight">
            TALK.<br />YOUR<br />WAY.
          </h2>
        </div>
        <HrLight />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Real-time messaging channels with rich embeds, reactions, threads, and unlimited
          history. KineticChat is built for speed — zero lag, every message, every time.
        </p>
        <HrLight />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: 'Threaded Conversations', desc: 'Keep discussions organised. Reply in threads without disrupting the main channel flow.' },
            { label: 'Rich Media Embeds', desc: 'Links, images, videos, code snippets — everything previews inline, natively.' },
            { label: 'Real-Time Sync', desc: 'Messages land instantly across all your devices. No refresh, no delay.' },
            { label: 'Unlimited History', desc: 'Search and scroll back to any message, forever. Nothing gets lost.' },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">{label}</p>
              <p
                className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
        <HrLight />
        <p
          className="mt-auto ml-auto max-w-[50ch] text-right text-[clamp(0.9rem,2vw,1.5rem)] font-normal leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          Every channel is a live, breathing space — not a static thread.
        </p>
      </FlowSection>

      {/* ── 03  VOICE & VIDEO ── Light Gray ─────────────────────────── */}
      <FlowSection
        aria-label="Voice and Video"
        style={{
          backgroundColor: '#f0f0f0',
          color: '#000000',
          paddingTop: 'clamp(5rem,10vw,7rem)',
        }}
      >
        <p className="text-xs font-bold font-mono uppercase tracking-[0.2em]">
          03 — VOICE &amp; VIDEO
        </p>
        <HrDark />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-black leading-[0.85] uppercase tracking-tight">
            HEAR<br />EVERY<br />VOICE
          </h2>
        </div>
        <HrDark />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Crystal-clear voice channels and HD video calls. No external app, no setup — just
          click in and start talking with your whole crew, anywhere in the world.
        </p>
        <HrDark />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: 'HD Video Calls', desc: 'Group video with up to your entire server — crisp, low-latency, and stable.' },
            { label: 'Spatial Voice Channels', desc: 'Always-on voice rooms. Drop in, hang out, leave whenever — just like a real room.' },
            { label: 'Screen Sharing', desc: 'Share your screen with one click. Co-work, watch, or just show off what you built.' },
            { label: 'Cross-Platform', desc: 'Voice from desktop, mobile, or web. Everyone connects, regardless of device.' },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">{label}</p>
              <p
                className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed"
                style={{ color: '#555555' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </FlowSection>

      {/* ── 04  THE WEB FEED ── White ────────────────────────────────── */}
      <FlowSection
        aria-label="THE WEB Feed"
        style={{
          backgroundColor: '#ffffff',
          color: '#000000',
          paddingTop: 'clamp(5rem,10vw,7rem)',
        }}
      >
        <p className="text-xs font-bold font-mono uppercase tracking-[0.2em]">
          04 — THE WEB
        </p>
        <HrDark />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-black leading-[0.85] uppercase tracking-tight">
            YOUR<br />FEED.<br />YOUR<br />WORLD.
          </h2>
        </div>
        <HrDark />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Scroll through a curated feed of clips, projects, tutorials, and drops from the
          communities you're part of. Your world, your content — no algorithm deciding what you see.
        </p>
        <HrDark />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: 'Algorithm-Free Discovery', desc: 'No black-box ranking. Your feed is shaped by your communities, not engagement bait.' },
            { label: 'Community Curated', desc: 'Content posted by real people in your servers rises to the top organically.' },
            { label: 'Short-Form Video', desc: 'Post and watch clips, highlights, tutorials, and builds — all native to the platform.' },
            { label: 'Drop Culture', desc: 'Announce releases, share launches, and celebrate moments with your whole community.' },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">{label}</p>
              <p
                className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed"
                style={{ color: '#555555' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
        <HrDark />
        <p
          className="mt-auto ml-auto max-w-[50ch] text-right text-[clamp(0.9rem,2vw,1.5rem)] font-normal leading-relaxed"
          style={{ color: '#777777' }}
        >
          The web, filtered for your world only.
        </p>
      </FlowSection>

      {/* ── 05  SPIDR AI ── Dark Gray ────────────────────────────────── */}
      <FlowSection
        aria-label="Spidr AI Tools"
        style={{
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
          paddingTop: 'clamp(5rem,10vw,7rem)',
        }}
      >
        <p className="text-xs font-bold font-mono uppercase tracking-[0.2em]">
          05 — SPIDR AI
        </p>
        <HrLight />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-black leading-[0.85] uppercase tracking-tight">
            THINK<br />SMARTER<br />TOGETHER
          </h2>
        </div>
        <HrLight />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Chat with Spidr AI directly inside your channels. Summarize long threads, generate
          code, answer questions — intelligence built natively into the platform.
        </p>
        <HrLight />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: 'Thread Summaries', desc: 'Missed 500 messages? Get a clean summary in seconds. No FOMO, ever.' },
            { label: 'Code Generation', desc: 'Ask, paste, ship. Spidr AI writes, explains, and debugs code right in the channel.' },
            { label: 'Instant Q&A', desc: 'Ask anything — about your community, your files, your pinned docs — and get answers.' },
            { label: 'Channel-Native', desc: 'AI lives inside every channel by default. No tab-switching, no separate app.' },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">{label}</p>
              <p
                className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
      </FlowSection>

      {/* ── 06  BOT LABORATORY ── Maroon ────────────────────────────── */}
      <FlowSection
        aria-label="Bot Laboratory"
        style={{
          backgroundColor: '#8B0000',
          color: '#ffffff',
          paddingTop: 'clamp(5rem,10vw,7rem)',
        }}
      >
        <p className="text-xs font-bold font-mono uppercase tracking-[0.2em]">
          06 — BOT LABORATORY
        </p>
        <HrLight />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-black leading-[0.85] uppercase tracking-tight">
            BUILD.<br />DEPLOY.<br />AUTOMATE.
          </h2>
        </div>
        <HrLight />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          Spidr's Bot Laboratory lets you create, configure, and run custom bots inside your
          community. No external hosting required — spin them up straight from the app.
        </p>
        <HrLight />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: 'No-Code Builder', desc: 'Create bots with a visual builder — no programming experience needed to get started.' },
            { label: 'Custom Commands', desc: 'Define slash commands, reactions, scheduled posts — tailor bots to your community.' },
            { label: 'Event Triggers', desc: 'Fire actions on joins, messages, reactions, or any server event automatically.' },
            { label: 'Zero Hosting Fees', desc: 'Bots run on Spidr infrastructure. No servers, no bills, no maintenance.' },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">{label}</p>
              <p
                className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.72)' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
        <HrLight />
        <p
          className="mt-auto ml-auto max-w-[50ch] text-right text-[clamp(0.9rem,2vw,1.5rem)] font-normal leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          Your community. Your rules. Automated.
        </p>
      </FlowSection>

      {/* ── 07  YOUR WAY (Privacy) ── Light Gray ────────────────────── */}
      <FlowSection
        aria-label="Your Way — Privacy and Safety"
        style={{
          backgroundColor: '#f5f5f5',
          color: '#000000',
          paddingTop: 'clamp(5rem,10vw,7rem)',
        }}
      >
        <p className="text-xs font-bold font-mono uppercase tracking-[0.2em]">
          07 — YOUR WAY
        </p>
        <HrDark />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-black leading-[0.85] uppercase tracking-tight">
            YOUR<br />DATA.<br />YOUR<br />RULES.
          </h2>
        </div>
        <HrDark />
        <p className="max-w-[50ch] text-[clamp(1rem,2.5vw,2rem)] font-normal leading-relaxed">
          We never sell your data. Period. Spidr is built with privacy at its core — because
          your conversations, communities, and moments belong to you alone.
        </p>
        <HrDark />
        <div className="flex flex-wrap gap-[3vw]">
          {[
            { label: 'End-to-End Encryption', desc: 'Direct messages and sensitive data are encrypted end-to-end. Not even we can read them.' },
            { label: 'Zero Data Selling', desc: 'We will never sell, rent, or trade your personal information to third parties. Full stop.' },
            { label: 'No Third-Party Brokers', desc: 'No ad networks. No data brokers. No hidden pipelines feeding your activity elsewhere.' },
            { label: 'Full Transparency', desc: 'Plain-language privacy policy. Know exactly what we collect, why, and how to delete it.' },
          ].map(({ label, desc }) => (
            <div key={label} className="min-w-[180px] flex-1">
              <p className="mb-2 text-sm font-bold uppercase tracking-wider">{label}</p>
              <p
                className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed"
                style={{ color: '#555555' }}
              >
                {desc}
              </p>
            </div>
          ))}
        </div>
        <HrDark />
        <p
          className="mt-auto ml-auto max-w-[50ch] text-right text-[clamp(0.9rem,2vw,1.5rem)] font-normal leading-relaxed"
          style={{ color: '#777777' }}
        >
          Privacy isn't a feature. It's the foundation.
        </p>
      </FlowSection>

    </FlowArt>
  );
}
