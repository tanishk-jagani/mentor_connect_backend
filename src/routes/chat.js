// /server/src/routes/chat.js
import express from "express";
import { Op, literal } from "sequelize";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * GET /api/chat/conversations
 * Returns unique counterpart users with last message preview (descending by last message time).
 */
router.get("/conversations", requireAuth, async (req, res) => {
  const me = req.user.id;

  // Get last message per counterpart (simple approach)
  const msgs = await Message.findAll({
    where: {
      [Op.or]: [{ sender_id: me }, { receiver_id: me }],
    },
    order: [["createdAt", "DESC"]],
    raw: true,
  });

  const byOther = new Map();
  for (const m of msgs) {
    const other = m.sender_id === me ? m.receiver_id : m.sender_id;
    if (!byOther.has(other)) byOther.set(other, m); // first (latest) wins
  }

  const otherIds = [...byOther.keys()];
  if (otherIds.length === 0) return res.json([]);

  const users = await User.findAll({
    where: { id: { [Op.in]: otherIds } },
    attributes: ["id", "name", "email", "avatar", "role"],
    raw: true,
  });

  const userMap = new Map(users.map((u) => [u.id, u]));
  const result = otherIds.map((oid) => {
    const last = byOther.get(oid);
    const u = userMap.get(oid);
    return {
      other_user_id: oid,
      name: u?.name || u?.email || "User",
      avatar: u?.avatar || null,
      role: u?.role || "mentee",
      last_message: last.text,
      last_at: last.createdAt,
    };
  });

  // newest first
  result.sort((a, b) => new Date(b.last_at) - new Date(a.last_at));
  res.json(result);
});

/**
 * GET /api/chat/history/:otherId
 * Returns ordered messages between me and other user.
 */
router.get("/history/:otherId", requireAuth, async (req, res) => {
  const me = req.user.id;
  const { otherId } = req.params;

  const messages = await Message.findAll({
    where: {
      [Op.or]: [
        { sender_id: me, receiver_id: otherId },
        { sender_id: otherId, receiver_id: me },
      ],
    },
    order: [["createdAt", "ASC"]],
  });

  res.json(messages);
});

/**
 * POST /api/chat/send
 * Body: { receiver_id, text }
 * Creates message and notifies via Socket.io.
 */
router.post("/send", requireAuth, async (req, res) => {
  const sender_id = req.user.id;
  const { receiver_id, text } = req.body || {};
  const clean = (text || "").toString().trim();

  if (!receiver_id || !clean) {
    return res
      .status(400)
      .json({ message: "receiver_id and text are required" });
  }

  const msg = await Message.create({ sender_id, receiver_id, text: clean });

  // Notify both parties via socket.io rooms (by user id)
  // const io = req.app.get("io");
  // io.to(receiver_id).emit("receive_message", msg);
  // io.to(sender_id).emit("message_sent", msg);

  const io = req.app.get("io");
  if (io) {
    io.to(receiver_id).emit("receive_message", msg);
    io.to(sender_id).emit("message_sent", msg);
  } else {
    console.warn("⚠️ io not attached; skipping emit");
  }

  res.status(201).json(msg);
});

export default router;
