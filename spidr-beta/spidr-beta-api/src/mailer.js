const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'noreply@spidrapp.com';

async function sendBetaConfirmEmail(toEmail, fullName) {
  const firstName = fullName.trim().split(' ')[0] || 'there';

  const html = `
    <div style="background:#0a0a0a;color:#fff;padding:48px 40px;font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;border-radius:16px;border:1px solid #1a1a1a;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="font-size:36px;font-weight:900;letter-spacing:-2px;margin:0;">
          SPID<span style="color:#C41E3A;">R</span>
        </h1>
        <p style="color:#666;font-size:11px;letter-spacing:4px;text-transform:uppercase;margin-top:4px;">Beta Access</p>
      </div>

      <p style="color:#fff;font-size:20px;font-weight:700;margin-bottom:8px;">
        You're on the list, ${firstName}.
      </p>
      <p style="color:#999;font-size:14px;line-height:1.6;margin-bottom:32px;">
        We've saved your spot. When Spidr opens beta access, you'll be among the first to get in.
        We'll reach out to <strong style="color:#C41E3A;">${toEmail}</strong> when it's your turn.
      </p>

      <div style="background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:20px;margin-bottom:32px;">
        <p style="color:#666;font-size:12px;margin:0 0 6px;">What to expect</p>
        <ul style="color:#aaa;font-size:13px;line-height:1.8;margin:0;padding-left:18px;">
          <li>Early access before public launch</li>
          <li>Direct line to share feedback with the team</li>
          <li>First look at every new feature</li>
        </ul>
      </div>

      <p style="color:#333;font-size:12px;text-align:center;margin:0;">
        You're receiving this because you signed up at spidrapp.com.<br/>
        No spam. Unsubscribe any time.
      </p>
    </div>
  `;

  if (process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY) {
    console.log(`\n📧 [DEV] Beta confirm email → ${toEmail} (${fullName})\n`);
    return;
  }

  await resend.emails.send({
    from: `Spidr <${FROM}>`,
    to: toEmail,
    subject: "You're on the Spidr beta list.",
    html,
  });
}

module.exports = { sendBetaConfirmEmail };
