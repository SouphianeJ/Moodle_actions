import nodemailer from 'nodemailer';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is incomplete. Check environment variables.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

export async function sendMail(options: MailOptions): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const subject = 'Votre code de connexion - Moodle Actions';
  const text = `Votre code de connexion est : ${otp}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez cet email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a; margin-bottom: 24px;">Connexion à Moodle Actions</h2>
      <p style="color: #4a4a4a; margin-bottom: 16px;">Votre code de connexion est :</p>
      <div style="background-color: #f5f5f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${otp}</span>
      </div>
      <p style="color: #6a6a6a; font-size: 14px; margin-bottom: 8px;">Ce code expire dans 10 minutes.</p>
      <p style="color: #6a6a6a; font-size: 14px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
    </div>
  `;

  await sendMail({ to: email, subject, text, html });
}
