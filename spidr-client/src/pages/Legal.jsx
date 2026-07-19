import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Public legal pages — /privacy and /terms. No auth required: both app stores
 * require these URLs to work logged-out, and Play's Data safety form needs a
 * public deletion-request path (covered in the privacy policy §6).
 */

export const SUPPORT_EMAIL = 'christhomas0634@gmail.com';
const EFFECTIVE_DATE = 'July 13, 2026';

const S = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="text-white text-lg font-bold mb-2">{title}</h2>
    <div className="text-zinc-400 text-sm leading-relaxed space-y-2">{children}</div>
  </section>
);

function Shell({ title, children }) {
  return (
    <div className="min-h-screen bg-[#050505] px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-red-500 text-xs font-bold tracking-widest hover:underline">
          ← SPIDR
        </Link>
        <h1 className="text-white text-3xl font-black mt-4 mb-1">{title}</h1>
        <p className="text-zinc-600 text-xs mb-10">Effective {EFFECTIVE_DATE}</p>
        {children}
        <p className="text-zinc-600 text-xs mt-12">
          Questions? Contact <a className="text-red-500 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <Shell title="Privacy Policy">
      <S title="1. What we collect">
        <p>
          Account data (email address, username, display name, password stored as a hash),
          profile content you add (bio, avatar, banner, social links), messages and group/server
          chat content, clips and media you upload, watch-time and engagement telemetry used to
          rank your feed, and — only if you connect them — Spotify tokens and a Steam ID you provide.
        </p>
      </S>
      <S title="2. How we use it">
        <p>
          To run the service: deliver messages, render profiles, personalize THE WEB feed, and show
          integration data you opted into. We do not sell your data and we do not run third-party
          advertising or tracking SDKs.
        </p>
      </S>
      <S title="3. Sharing">
        <p>
          Content you post is visible to its audience (DM recipients, server members, feed viewers).
          Infrastructure providers (MongoDB Atlas, Railway, Cloudflare R2, Hostinger) process data on
          our behalf. We disclose data only if legally required.
        </p>
      </S>
      <S title="4. Retention">
        <p>
          Data is retained while your account exists. Deactivated accounts keep their data but go
          offline and hidden. Deleted accounts are removed as described in §6.
        </p>
      </S>
      <S title="5. Children">
        <p>Spidr is not directed at children under 13 (or the minimum age in your jurisdiction) and may not be used by them.</p>
      </S>
      <S title="6. Deleting your account and data">
        <p>
          In-app: Settings → Security → Delete Account Permanently (mobile), or Settings → Security on the web.
          Deletion removes your account, profile, friends, clips, and wallet; your past messages are
          anonymized so other participants keep their conversation history.
        </p>
        <p>
          You can also request deletion without the app by emailing{' '}
          <a className="text-red-500 hover:underline" href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}>{SUPPORT_EMAIL}</a>{' '}
          from your account email with the subject "Account deletion request".
        </p>
      </S>
      <S title="7. Changes">
        <p>We'll update the effective date above and announce material changes in-app via Spidr System.</p>
      </S>
    </Shell>
  );
}

export function TermsOfService() {
  return (
    <Shell title="Terms of Service">
      <S title="1. The service">
        <p>
          Spidr is a chat and media platform (servers, DMs, voice, and the clip feed "THE WEB").
          By creating an account you agree to these terms and the Privacy Policy.
        </p>
      </S>
      <S title="2. Your account">
        <p>
          You must provide accurate information, keep your credentials secure, and be at least 13
          years old (or the minimum digital-consent age in your jurisdiction).
        </p>
      </S>
      <S title="3. Your content">
        <p>
          You own what you post and grant Spidr a license to host and display it to its intended
          audience. You're responsible for what you upload.
        </p>
      </S>
      <S title="4. Acceptable use">
        <p>
          No harassment, threats, doxxing, impersonation, spam, sexual content involving minors,
          illegal content, or attempts to exploit the service.
        </p>
      </S>
      <S title="5. Moderation, reports, and takedown SLA">
        <p>
          Every user can report a message, clip, profile, or server from the in-app "Report" action,
          and can block any other user to sever direct contact. Reports go to a moderation queue
          reviewed by Spidr staff.
        </p>
        <p>
          Our response targets: reports of objectionable content (harassment, threats, sexual content
          involving minors, illegal content) are acknowledged within <strong>24 hours</strong> and
          acted on within <strong>72 hours</strong>. Actions include removing the content,
          restricting the offending account's features, or banning the account. Users whose content
          is removed are notified in-app. Repeat or severe violations may result in a permanent ban
          without prior warning.
        </p>
        <p>
          To escalate a report, email <a className="text-red-500 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with the report ID shown in the confirmation dialog.
        </p>
      </S>
      <S title="6. Termination">
        <p>
          You can deactivate or permanently delete your account at any time in Settings → Security.
          We may suspend or terminate accounts that violate these terms.
        </p>
      </S>
      <S title="7. Disclaimers">
        <p>
          The service is provided "as is" during beta. To the maximum extent permitted by law we
          disclaim warranties and limit liability to the amount you paid us (currently nothing).
        </p>
      </S>
      <S title="8. Changes">
        <p>We may update these terms; continued use after an update is acceptance. Material changes are announced in-app.</p>
      </S>
    </Shell>
  );
}

export default PrivacyPolicy;
