const nodemailer = require('nodemailer');

let _transporter = null;
let _devTransporterPromise = null;

function getProductionTransporter() {
  if (_transporter) return _transporter;
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    _transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    return _transporter;
  }
  return null;
}

async function getDevTransporter() {
  // Reuse the same Ethereal account per process lifetime
  if (!_devTransporterPromise) {
    _devTransporterPromise = nodemailer.createTestAccount()
      .then(account => nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: account.user, pass: account.pass },
      }))
      .catch(() => null); // Never throw - just return null
  }
  return _devTransporterPromise;
}

async function sendOTPEmail(toEmail, otp, type = 'verify') {
  const subject = type === 'login'
    ? '🔐 Spidr — Your Login Code'
    : type === 'reset'
      ? '🔑 Spidr — Password Reset Code'
      : '🕸 Spidr — Verify Your Account';

  const bodyLabel = type === 'login'
    ? 'Your 2FA login code:'
    : type === 'reset'
      ? 'Your password reset code:'
      : 'Your verification code:';

  const html = `
    <div style="background:#0a0a0a;color:#fff;padding:48px 40px;font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;border-radius:16px;border:1px solid #1a1a1a;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="font-size:36px;font-weight:900;letter-spacing:-2px;margin:0;">
          SPID<span style="color:#ef4444;">R</span>
        </h1>
        <p style="color:#666;font-size:11px;letter-spacing:4px;text-transform:uppercase;margin-top:4px;">Module Nexus</p>
      </div>
      <p style="color:#aaa;font-size:14px;margin-bottom:8px;">
        ${bodyLabel}
      </p>
      <div style="background:#111;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;margin:24px 0;">
        <div style="letter-spacing:12px;font-size:40px;font-weight:900;color:#ef4444;font-family:monospace;">
          ${otp}
        </div>
        <p style="color:#555;font-size:12px;margin-top:16px;margin-bottom:0;">
          ⏱ Expires in <strong style="color:#888;">10 minutes</strong>
        </p>
      </div>
      <p style="color:#444;font-size:12px;text-align:center;margin:0;">
        If you didn't request this, ignore this email.
      </p>
    </div>
  `;

  // Log the OTP in non-production so you can test without email config
  const isDevMode = process.env.NODE_ENV !== 'production' && !process.env.EMAIL_USER;
  if (isDevMode) {
    console.log(`\n🔑 OTP for ${toEmail}: ${otp}\n`);
  }

  const transporter = getProductionTransporter() || await getDevTransporter();

  // If no transporter available at all, just log and continue (never block auth)
  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`⚠️  No email transporter available. OTP for ${toEmail}: ${otp}`);
    }
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Spidr Network" <${process.env.EMAIL_USER || 'noreply@spidr.app'}>`,
      to: toEmail,
      subject,
      html,
    });

    if (isDevMode) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log(`📧 Email preview: ${previewUrl}`);
    }
  } catch (err) {
    // Never let email failure crash the auth flow
    console.warn(`⚠️  Email send failed (OTP still logged above): ${err.message}`);
  }
}

module.exports = { sendOTPEmail };
