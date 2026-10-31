// src/services/mailer.service.ts
import type { FastifyInstance } from 'fastify';
import nodemailer from 'nodemailer';

/** Sends the password-reset link. Without SMTP_HOST the link is written to the server log instead. */
export async function sendResetEmail(app: FastifyInstance, to: string, link: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    app.log.warn(`SMTP is not configured. Password reset link for ${to}: ${link}`);
    return;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
      : undefined
  });

  await transport.sendMail({
    from: process.env.MAIL_FROM ?? 'Brightloop <no-reply@brightloop.local>',
    to,
    subject: 'Reset your Brightloop password',
    text: `Use this link to reset your password (valid for 1 hour):\n${link}\n\nIf you did not ask for this, ignore this email.`,
    html: `<p>Use this link to reset your password (valid for 1 hour):</p><p><a href="${link}">${link}</a></p><p>If you did not ask for this, ignore this email.</p>`
  });
}
