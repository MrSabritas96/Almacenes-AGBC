import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      tls: { rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false" },
    });
  }
  return transporter;
}

/** Plantilla HTML responsiva base. */
export function emailTemplate(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#0f172a;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:linear-gradient(135deg,#4f46e5,#06b6d4);padding:24px;color:#fff;font-size:20px;font-weight:700">Almacenes AGBC</td></tr>
<tr><td style="padding:24px;color:#0f172a"><h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
<div style="font-size:14px;line-height:1.6;color:#334155">${bodyHtml}</div></td></tr>
<tr><td style="padding:16px 24px;background:#f1f5f9;color:#64748b;font-size:12px">Mensaje automático, no responder.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(opts: { to: string | string[]; subject: string; html: string }) {
  return getTransporter().sendMail({ from: process.env.SMTP_FROM, ...opts });
}

