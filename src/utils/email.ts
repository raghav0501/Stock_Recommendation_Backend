import nodemailer from 'nodemailer';
import { config } from '../config';
import { createServiceLogger } from '../infrastructure/logger';

const log = createServiceLogger('email');

function createTransporter() {
  if (!config.SMTP_USER || !config.SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured to send emails');
  }
  return nodemailer.createTransport({
    host:   config.SMTP_HOST,
    port:   config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth:   { user: config.SMTP_USER, pass: config.SMTP_PASS },
  });
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const transporter = createTransporter();
  const ttlMinutes  = Math.floor(config.OTP_TTL_SECONDS / 60);

  await transporter.sendMail({
    from:    config.EMAIL_FROM,
    to,
    subject: 'Your Alumnus Login OTP',
    text:    `Your one-time password is: ${otp}\n\nThis OTP expires in ${ttlMinutes} minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a2e">Your Login OTP</h2>
        <p>Use the following one-time password to log in:</p>
        <div style="font-size:2rem;font-weight:bold;letter-spacing:0.3em;padding:16px 24px;background:#f4f4f8;border-radius:8px;display:inline-block">
          ${otp}
        </div>
        <p style="color:#666;font-size:0.875rem">This OTP expires in <strong>${ttlMinutes} minutes</strong>. Do not share it with anyone.</p>
      </div>
    `,
  });

  log.info('OTP email sent', { meta: { to } });
}
