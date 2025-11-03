import express from "express";
import { Op } from "sequelize";
import { requireAuth } from "../middleware/requireAuth.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

const router = express.Router();

/**
 * POST /api/reports
 * Body: { target_id, reason, details?, message_id? }
 */
router.post("/", requireAuth, async (req, res) => {
  const reporter_id = req.user.id;
  const { target_id, reason, details, message_id } = req.body || {};

  if (!target_id || !reason) {
    return res
      .status(400)
      .json({ message: "target_id and reason are required" });
  }

  // Optional: sanity check that target exists
  // Optional: if message_id supplied, verify it belongs to either reporter or target
  if (message_id) {
    const msg = await Message.findByPk(message_id);
    if (!msg) return res.status(400).json({ message: "Invalid message_id" });
    const inThread =
      (msg.sender_id === reporter_id && msg.receiver_id === target_id) ||
      (msg.sender_id === target_id && msg.receiver_id === reporter_id);
    if (!inThread)
      return res
        .status(400)
        .json({ message: "message_id not in this conversation" });
  }

  const report = await Report.create({
    reporter_id,
    target_id,
    reason,
    details,
    message_id,
  });
  res.status(201).json(report);
});

/**
 * GET /api/reports/mine
 * List reports created by me
 */
router.get("/mine", requireAuth, async (req, res) => {
  const reporter_id = req.user.id;
  const list = await Report.findAll({
    where: { reporter_id },
    order: [["createdAt", "DESC"]],
  });
  res.json(list);
});

export default router;
