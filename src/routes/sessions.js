import express from "express";
import { Op } from "sequelize";
import Session from "../models/Session.js";
import Availability from "../models/Availability.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendMail } from "../utils/mailer.js";

const router = express.Router();

/** Mentee: book a slot (creates pending Session & marks slot booked) */
router.post("/book", requireAuth, async (req, res) => {
  const mentee_id = req.user.id;
  const { mentor_id, start_time, end_time, notes } = req.body || {};

  if (!mentor_id || !start_time || !end_time)
    return res
      .status(400)
      .json({ message: "mentor_id, start_time, end_time required" });

  // sanity: ensure the exact slot exists & is free
  const slot = await Availability.findOne({
    where: {
      mentor_id,
      status: "available",
      start_time: new Date(start_time),
      end_time: new Date(end_time),
    },
  });
  if (!slot) return res.status(400).json({ message: "Slot not available" });

  const session = await Session.create({
    mentor_id,
    mentee_id,
    start_time,
    end_time,
    status: "pending",
    notes,
  });

  // mark slot as booked
  slot.status = "booked";
  await slot.save();

  const [mentee, mentor] = await Promise.all([
    User.findByPk(mentee_id, { attributes: ["name", "email"] }),
    User.findByPk(mentor_id, { attributes: ["name", "email"] }),
  ]);

  // Format times (IST for clarity in India)
  const fmt = (iso) =>
    new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const when = `${fmt(start_time)} → ${fmt(end_time)} (IST)`;

  const subject = "✅ Session Scheduled";
  const text = [
    `Your mentorship session is scheduled.`,
    ``,
    `Mentor: ${mentor?.name || "Mentor"}`,
    `Mentee: ${mentee?.name || "Mentee"}`,
    `When: ${when}`,
    ``,
    `You can chat inside MentorConnect to coordinate details.`,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
      <h2>✅ Session Scheduled</h2>
      <p><b>Mentor:</b> ${mentor?.name || "Mentor"}</p>
      <p><b>Mentee:</b> ${mentee?.name || "Mentee"}</p>
      <p><b>When:</b> ${when}</p>
      <p>Use in-platform chat to coordinate details.</p>
    </div>
  `;

  // Send to both (if both emails exist)
  const recipients = [mentor?.email, mentee?.email].filter(Boolean).join(",");
  if (recipients) {
    await sendMail({ to: recipients, subject, text, html });
    console.log("📧 Session confirmation email sent to:", recipients);
  } else {
    console.warn("⚠️ Missing recipient email(s), skipping mail");
  }
  res.status(201).json(session);
});

/** Mentor: accept */
router.patch("/:id/accept", requireAuth, async (req, res) => {
  const session = await Session.findByPk(req.params.id);
  if (!session || session.mentor_id !== req.user.id)
    return res.status(404).json({ message: "Session not found" });

  session.status = "accepted";
  await session.save();

  const mentee = await User.findByPk(session.mentee_id, { raw: true });
  await sendMail({
    to: mentee.email,
    subject: "Your mentoring session was accepted",
    html: `
      <p>Your session has been accepted 🎉</p>
      <p>Time: ${new Date(session.start_time).toLocaleString()}</p>
    `,
  });

  res.json(session);
});

/** Mentor: decline (also frees the slot) */
router.patch("/:id/decline", requireAuth, async (req, res) => {
  const session = await Session.findByPk(req.params.id);
  if (!session || session.mentor_id !== req.user.id)
    return res.status(404).json({ message: "Session not found" });

  session.status = "declined";
  await session.save();

  // free the matching slot
  await Availability.update(
    { status: "available" },
    {
      where: {
        mentor_id: session.mentor_id,
        start_time: session.start_time,
        end_time: session.end_time,
      },
    }
  );

  const mentee = await User.findByPk(session.mentee_id, { raw: true });
  await sendMail({
    to: mentee.email,
    subject: "Your mentoring session was declined",
    html: `<p>Unfortunately the mentor declined this slot. You can pick another.</p>`,
  });

  res.json(session);
});

/** Me: list my sessions (both sides) */
router.get("/mine", requireAuth, async (req, res) => {
  const me = req.user.id;
  const items = await Session.findAll({
    where: { [Op.or]: [{ mentor_id: me }, { mentee_id: me }] },
    order: [["start_time", "ASC"]],
    include: [
      {
        model: User,
        as: "mentor",
        attributes: ["id", "name", "email", "avatar"],
      },
      {
        model: User,
        as: "mentee",
        attributes: ["id", "name", "email", "avatar"],
      },
    ],
  });
  res.json(items);
});

export default router;
