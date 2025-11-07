// /server/src/utils/mailer.js
import nodemailer from "nodemailer";

const {
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM_NAME = "MentorConnect",
  MAIL_FROM_EMAIL,
  NODE_ENV,
} = process.env;

const fromAddress = MAIL_FROM_EMAIL || SMTP_USER;

let transporter;
// Gmail quick setup (best for quick finish)
transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  secure: false, // Use `false` for port 587, `true` for port 465
  port: 587,
});

// Optional: verify once on boot (doesn’t crash if fails)
transporter.verify().then(
  () => console.log("📧 Mailer ready"),
  (err) =>
    console.warn("⚠️ Mailer not verified (will try on send):", err?.message)
);

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) throw new Error("Mailer not initialized");

  console.log({
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM_NAME,
    MAIL_FROM_EMAIL,
  });

  const info = await transporter.sendMail({
    from: `"${MAIL_FROM_NAME}" <${fromAddress}>`,
    to: to,
    subject,
    text: text || undefined,
    html: html || undefined,
  });
  return info;
}
