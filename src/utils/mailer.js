// /server/src/utils/mailer.js
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM_NAME = "MentorConnect",
  MAIL_FROM_EMAIL,
} = process.env;

const fromAddress = MAIL_FROM_EMAIL || SMTP_USER;

let transporter;

if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  // Use the professional SMTP transport
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10), // Ensure port is an integer
    secure: SMTP_PORT == "465", // true for 465, false for other ports (like 587)
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  // Optional: verify once on boot
  transporter.verify().then(
    () => console.log("📧 Mailer ready (SendGrid)"),
    (err) =>
      console.warn("⚠️ Mailer not verified (will try on send):", err?.message)
  );
} else {
  console.warn("⚠️ Mailer config missing, emails will not be sent.");
  console.warn("Missing: SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASS");
}

export async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.error("⚠️ Error: Mailer not initialized.");
    throw new Error("Mailer not initialized");
  }

  console.log("Attempting to send email...");
  console.log({
    SMTP_USER,
    MAIL_FROM_NAME,
    MAIL_FROM_EMAIL,
  });

  try {
    const info = await transporter.sendMail({
      from: `"${MAIL_FROM_NAME}" <${fromAddress}>`,
      to: to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });

    console.log(`📬 Email sent successfully to: ${to}`);
    console.log("Message Info:", info);

    return info;
  } catch (err) {
    console.error("⚠️ Error sending email:", err.message);
    throw new Error(`Failed to send email: ${err.message}`);
  }
}
