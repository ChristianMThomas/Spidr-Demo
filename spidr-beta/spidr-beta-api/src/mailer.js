const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'noreply@spidrapp.com';

const SIGNATURE = `
  <div style="margin-top:32px;">
    <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;background:#0a0a0a;background-image:linear-gradient(135deg,#0a0a0a 0%,#1a0a14 55%,#2a0d18 100%);border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;">
          <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
            <tr>
              <td style="vertical-align:middle;padding-right:18px;border-right:3px solid #dc2626;">
                <img src="data:image/png;base64,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TAb4VFjpX0FGdEFMvSENHvYIhBNBiABiqlMDkokUKNkC5RuFqiCEmqBJCpMVFq0s3Q2lYBaSotNGFSmaCiWVoFLbmaTKuKpCoGaAnAGiQaFoBhBikIaGJsYbHKSiA1IjNhFLDpniqG+GFpSDEWzKg6WpRqWJJZrSkAiRNNDpQI7GnV2CUEJGbhYSiMYbCZBKiqpBCkQqFYNVQoUSKJJiBhCJJqkiFnlbJBNJFUqogWWqhpNkVGkJAJlCQJoqEqgmFFjKQAKhIKaFGpYKqHJEEEfYlkqKFCDImU1gY+PaQOI0GQKCKWSVLCJ0KTiuFkZ4SKiYmJpTNkGkRKkqsUSNoGGmjEBUpUqaJKJBBSiTi5VRBFMCuFAmIJGDdNzFEGqJmDEzVpN6MEBbqQqEhCiGVIlEpVBKQ6pGIoEVJBoCqApqoiMkVaRGjpKBUAQJBoVQbIqBEiaRZmpACiQpCJgTEJsEL4mGWi6MrZqIlJiJCqwJgioVSmSLKcBRpFXSZ2CKWKJaBgm6TJiJCZCilIaRVSGxGZRpqYmIqhBKiRCFjIJnFGjJhAVhqpBIrAiShhCMiKJpFCIIkiCUOqJJqhEoJoJgKCRqCFAiClJCoIaESIKmYCIIhhSCKFpoBCKaIRiqJBqCkiKBkiZIkiYihpMlkEXZqEiQBkxYaZRMiVZKBklJCqZBJqKJBpimaCiSCoiLACJkCJCKCiJJRiiqRiRFqJCqgJCiaqimJqIUJREqJiOimplKiEhJRliJiRaSKQkRRCKiSBSqIRSFSqJqBRJiJJqEKJqNShBiIpIigVIqRCSkICgSCIaGQiaCkiSJClmRiSmqBEKpCKJIBqIqiCkqIFIJqCFkioJKSiCiIJaSmhJiiIJqiqQIkokIIQKAmkJQJAmKBkiooiaqICBqiRKJJECAJiiqkmpiIIoiqamRIqiIJJiKiKiJJqCqJqQACiRCJpiRSAqqKiRRJioCIiRqJKiaqiRIaICCqJiqCMkRipCiSqJmSKqIqiqJJKqIIRIqiKJJiiqiCqJimMpJJSJkiJSqCCimRJioiipaSSmiqRKiIqJiSJAiKqiqJIiKJhKSpiImJCaaCiACSaJiCqiJKqCISKKqJQRhRSmCqoRJAqiIqJiSIiIKCKiaqIqiqIiJJJiikJSChASKKkJJIiaqjiqiqiqqKkikSSkIKakRioJiQqiCIqAmCKaJiiqiaqiqIqqKJSmiqKoqSSaQiJSSKKiqiJiiikRqiQqiqaJiqiRiqIiiqIiQqCaJiSkiJJoKiJqaKiRiJiqKqioqCiqqKqJSoJSkISiqSSJiqqiiqIiiqSiqiJKRkaSKqjqiJiqiqKISSKqiqASiqQiqJioiiqQISqqCIqJKiSJKiqiaSJJKiSiqiaqIKSoJSiKKqiiqIiqqiiqqSqiJiqoiqiiqCSaJJqSqiIiqqqiIqjiqCSIiaSIqqqiiqiSJqKiqiqiaqoiqiqiiJSqqKiqiKiqiiqiqiqiiqiiqiqiiqiiqiqiiqiiqiiqiqiiqiiq" alt="Spidr" width="64" height="64" style="display:block;width:64px;height:64px;" />
              </td>
              <td style="vertical-align:middle;padding-left:18px;">
                <div style="font-size:24px;font-weight:bold;letter-spacing:1px;line-height:1;"><span style="color:#ffffff;">SPID</span><span style="color:#dc2626;">R</span></div>
                <div style="font-size:12px;color:#a78bfa;font-weight:bold;letter-spacing:2px;text-transform:uppercase;padding-top:4px;">Enter The Chrysalis</div>
                <div style="font-size:12px;color:#c4c4cc;padding-top:9px;line-height:1.5;">
                  Spidr Beta Team<br/>
                  <a href="mailto:noreply@spidrapp.com" style="color:#f87171;text-decoration:none;">noreply@spidrapp.com</a> &nbsp;|&nbsp;
                  <a href="https://spidrapp.com" style="color:#f87171;text-decoration:none;">spidrapp.com</a>
                </div>
                <div style="font-size:10px;color:#71717a;padding-top:10px;line-height:1.4;">
                  This is an automated message from an unmonitored mailbox. Please do not reply.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;

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
    ${SIGNATURE}
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
