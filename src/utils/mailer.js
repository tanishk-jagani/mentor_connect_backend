// /server/src/utils/mailer.js
import sgMail from "@sendgrid/mail";

// Your SendGrid API key is in the SMTP_PASS variable
const {
  SMTP_PASS, // This is your SendGrid API Key
  MAIL_FROM_NAME = "MentorConnect",
  MAIL_FROM_EMAIL, // This is your verified Sender Identity email
} = process.env;

let isMailerReady = false;

if (SMTP_PASS && MAIL_FROM_EMAIL) {
  // Set the API key for the SendGrid library
  sgMail.setApiKey(SMTP_PASS);
  isMailerReady = true;
  console.log("📧 Mailer (SendGrid API) ready.");
  console.log(`> Sending from: "${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`);
} else {
  console.warn("⚠️ Mailer (SendGrid) not configured!");
  if (!SMTP_PASS) console.warn("> SMTP_PASS (SendGrid API Key) is missing.");
  if (!MAIL_FROM_EMAIL)
    console.warn("> MAIL_FROM_EMAIL (Verified Sender) is missing.");
}

export async function sendMail({ to, subject, text, html }) {
  if (!isMailerReady) {
    console.error("⚠️ Error: Mailer not initialized.");
    throw new Error("Mailer not initialized, check logs for missing env vars.");
  }

  // This is the SendGrid API format
  const msg = {
    to: to,
    from: {
      email: MAIL_FROM_EMAIL,
      name: MAIL_FROM_NAME,
    },
    subject: subject,
    text: text, // Optional, for plain-text
    html: html, // The HTML content
  };

  console.log(`Attempting to send email to: ${to}`);
  try {
    // This sends the email via HTTP, not SMTP
    const response = await sgMail.send(msg);
    console.log(`📬 Email sent successfully to: ${to}`);
    console.log("Message Info:", response[0].statusCode);
    return response;
  } catch (err) {
    console.error("⚠️ Error sending email (SendGrid API):", err);
    // Log more specific SendGrid errors if available
    if (err.response) {
      console.error(err.response.body);
    }
    throw new Error(`Failed to send email: ${err.message}`);
  }
}
