// routes/requests.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import Request from "../models/Request.js"; // adjust to your actual model name
import User from "../models/User.js";
import Session from "../models/Session.js";
import Mentorship from "../models/Mentorship.js";

const router = express.Router();

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const mentor_id = req.user.id;

    const [sessions, requests, mentees] = await Promise.all([
      Session.count({ where: { mentor_id } }),
      Request.count({ where: { mentor_id, status: "pending" } }),
      Mentorship.count({ where: { mentor_id } }),
    ]);

    res.json({ sessions, requests, mentees });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
});

/**
 * GET /api/requests/mine
 * Query: ?status=pending
 * Lists all requests sent to the logged-in mentor
 */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const where = { mentor_id: req.user.id };
    if (req.query.status) where.status = req.query.status;

    const list = await Request.findAll({
      where,
      include: [
        {
          model: User,
          as: "mentee",
          attributes: ["id", "name", "email", "avatar"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(list);
  } catch (err) {
    console.error("Error fetching requests:", err);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});

/**
 * PATCH /api/requests/:id/:action
 * Accept or decline a mentee request
 */
router.patch("/:id/:action", requireAuth, async (req, res) => {
  try {
    const { id, action } = req.params;
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Invalid action" });
    }

    const request = await Request.findOne({
      where: { id, mentor_id: req.user.id },
    });
    if (!request) return res.status(404).json({ message: "Request not found" });

    request.status = action === "accept" ? "accepted" : "declined";
    await request.save();

    res.json({ message: "Request updated", request });
  } catch (err) {
    console.error("Error updating request:", err);
    res.status(500).json({ message: "Failed to update request" });
  }
});

export default router;
