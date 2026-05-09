import nodemailer from "nodemailer";
import { env } from "./env";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  code?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    console.error("Gmail SMTP credentials are missing in environment variables.");
    throw new Error("Internal server error: Email service unavailable");
  }

  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
}

export const sendEmail = async ({ to, subject, html }: EmailOptions) => {
  const mailTransport = getTransporter();

  const mailOptions = {
    from: `"Scientia Prep" <${env.GMAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    await mailTransport.sendMail(mailOptions);
    return "OK";
  } catch (error) {
    console.error("Nodemailer Error:", error);
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared compact mobile-first email layout.
// Root-cause fix for "compact email templates so they fit mobile screens":
// all eight templates shared the same oversized 40px padding / 24px rounded
// desktop layout with 48px hero banners. On a 360-pixel-wide phone the card
// was getting squeezed past readability.
//
// The new `baseLayout(...)` helper:
//   * 100% fluid, max-width 480px on large screens
//   * 16–20px padding that collapses gracefully on small screens
//   * Single system font stack (no web-fonts — better deliverability)
//   * Inline styles only (every major mail client strips <style> tags)
//   * No gradients in headers (many Outlook builds render them opaque black)
//   * A single `accent` color per template for the header + primary CTA
// ─────────────────────────────────────────────────────────────────────────────

type LayoutOpts = {
  preheader?: string;
  accent?: string; // hex, e.g. "#00c2b2"
  eyebrow: string; // small label above the H1 in the header
  heading: string;
  body: string; // plain HTML for the body
  footer?: string; // small gray copy at the bottom of the card
};

function baseLayout({
  preheader = "",
  accent = "#00c2b2",
  eyebrow,
  heading,
  body,
  footer = "",
}: LayoutOpts) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0a0a0b;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;">
      <tr>
        <td align="center" style="padding:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#161618;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:20px 20px 16px 20px;background:${accent};text-align:left;">
                <div style="color:#ffffff;font-weight:800;font-size:18px;letter-spacing:-0.01em;">Scientia Prep</div>
                <div style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-top:3px;">${escapeHtml(eyebrow)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 20px 16px 20px;">
                <h1 style="margin:0 0 10px 0;color:#ffffff;font-size:18px;font-weight:700;line-height:1.3;">${escapeHtml(heading)}</h1>
                <div style="color:#a1a1aa;font-size:14px;line-height:1.55;">${body}</div>
              </td>
            </tr>
            ${
              footer
                ? `<tr><td style="padding:0 20px 18px 20px;"><p style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">${footer}</p></td></tr>`
                : ""
            }
            <tr>
              <td style="padding:12px 20px;background:rgba(0,0,0,0.25);border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
                <p style="margin:0;color:#52525b;font-size:11px;letter-spacing:0.02em;">&copy; ${year} Scientia Prep</p>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0 0;color:#3f3f46;font-size:10px;">You are receiving this because of an action on your Scientia account.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

function otpBlock(code: string, accent: string) {
  const safe = escapeHtml(code);
  return `
    <div style="margin:14px 0 6px 0;padding:14px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;text-align:center;">
      <div style="font-family:ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace;font-size:30px;font-weight:800;color:${accent};letter-spacing:8px;">${safe}</div>
    </div>`;
}

function cta(href: string, label: string, accent: string) {
  return `
    <div style="margin:14px 0 4px 0;">
      <a href="${href}" style="display:inline-block;padding:12px 20px;background:${accent};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:0.02em;">${escapeHtml(label)}</a>
    </div>`;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://prep.scientianet.com";

export const emailTemplates = {
  registrationOtp: (code: string) =>
    baseLayout({
      preheader: `Your Scientia verification code: ${code}`,
      accent: "#006b63",
      eyebrow: "Verification required",
      heading: "Complete your registration",
      body: `
        <p style="margin:0 0 4px 0;">Use the code below to activate your account. It expires in <strong>10 minutes</strong>.</p>
        ${otpBlock(code, "#00c2b2")}
      `,
      footer: "If you didn't start a registration, you can safely ignore this email.",
    }),

  mfaOtp: (code: string) =>
    baseLayout({
      preheader: `Your Scientia sign-in code: ${code}`,
      accent: "#4f46e5",
      eyebrow: "Secure sign-in",
      heading: "Two-factor authentication",
      body: `
        <p style="margin:0 0 4px 0;">Enter the code below to finish signing in. Valid for <strong>5 minutes</strong>.</p>
        ${otpBlock(code, "#818cf8")}
      `,
      footer: "If you didn't try to sign in, change your password immediately.",
    }),

  userApproved: (name: string) =>
    baseLayout({
      preheader: "Your Scientia Prep account has been approved.",
      accent: "#059669",
      eyebrow: "Welcome aboard",
      heading: `Approved, ${escapeHtml(name)}.`,
      body: `
        <p style="margin:0 0 8px 0;">Your registration has been verified. You now have full access to prep materials, mock tests, and the proctored exam environment.</p>
        ${cta(`${SITE}/dashboard`, "Open dashboard", "#10b981")}
      `,
    }),

  customAdminMessage: (subject: string, message: string) =>
    baseLayout({
      preheader: subject,
      accent: "#404040",
      eyebrow: "Admin message",
      heading: subject,
      body: `<div style="white-space:pre-wrap;">${escapeHtml(message)}</div>`,
      footer: "Official communication from Scientia Prep administration.",
    }),

  passwordReset: (code: string) =>
    baseLayout({
      preheader: `Your password reset code: ${code}`,
      accent: "#e11d48",
      eyebrow: "Security request",
      heading: "Reset your password",
      body: `
        <p style="margin:0 0 4px 0;">Enter the code below to set a new password. Expires in <strong>15 minutes</strong>.</p>
        ${otpBlock(code, "#fb7185")}
      `,
      footer: "If you didn't request a reset, you can safely ignore this email.",
    }),

  accountDeletion: (name: string) =>
    baseLayout({
      preheader: "Your Scientia Prep account has been scheduled for deletion.",
      accent: "#7f1d1d",
      eyebrow: "Deletion scheduled",
      heading: `Goodbye, ${escapeHtml(name)}`,
      body: `
        <p style="margin:0 0 8px 0;">Your account and associated data are scheduled for permanent deletion. You have a <strong>7-day grace window</strong> to revoke this if it was a mistake.</p>
        ${cta(`${SITE}/dashboard/settings`, "Open settings to revoke", "#ef4444")}
      `,
      footer: "After the grace window expires your records are purged permanently.",
    }),

  welcome: (name: string) =>
    baseLayout({
      preheader: "Welcome to Scientia Prep.",
      accent: "#006b63",
      eyebrow: "Welcome aboard",
      heading: `Welcome, ${escapeHtml(name)}!`,
      body: `
        <p style="margin:0 0 8px 0;">Your Scientia Prep account is live. Once an admin reviews and approves your registration you'll unlock prep materials, mock tests, and your personal analytics dashboard.</p>
        ${cta(`${SITE}/login`, "Go to portal", "#00c2b2")}
      `,
    }),

  accountDeletionRevoked: (name: string) =>
    baseLayout({
      preheader: "Your deletion request has been cancelled.",
      accent: "#059669",
      eyebrow: "Request cancelled",
      heading: "Deletion revoked",
      body: `
        <p style="margin:0 0 8px 0;">Hello ${escapeHtml(name)}, your account deletion request has been cancelled. Your account is fully active and all your data — test scores, enrollments, notes — has been preserved.</p>
        ${cta(`${SITE}/dashboard`, "Continue learning", "#10b981")}
      `,
    }),
};
