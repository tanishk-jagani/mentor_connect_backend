import { Router } from "express";
import Message from "../models/Message.js";
import User from "../models/User.js"; // stays same if we fixed above


const router = Router();

router.get("/list/:user_id", async (req, res) => {
  const { user_id } = req.params;

  const messages = await Message.findAll({
    where: { },
    raw: true
  });

  const users = await User.findAll({ raw: true });

  const chats = {};

  for (const msg of messages) {
    if (msg.sender_id === user_id) chats[msg.receiver_id] = msg;
    if (msg.receiver_id === user_id) chats[msg.sender_id] = msg;
  }

  const response = Object.entries(chats).map(([otherId, msg]) => {
    const user = users.find((u) => u.id === otherId);
    return {
      other_user_id: otherId,
      full_name: user?.full_name || user?.email || "User",
      last_message: msg.message
    };
  });

  res.json(response);
});

export default router;
