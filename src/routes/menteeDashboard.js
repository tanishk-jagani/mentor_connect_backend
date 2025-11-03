// server/routes/menteeDashboard.js
import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import Session from "../models/Session.js";
import Request from "../models/Request.js";
import Mentorship from "../models/Mentorship.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * GET /api/mentee-dashboard/stats
 * Returns mentee’s dashboard data
 */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const mentee_id = req.user.id;

    const [sessions, requests, mentors] = await Promise.all([
      Session.count({ where: { mentee_id } }),
      Request.count({ where: { mentee_id, status: "pending" } }),
      Mentorship.count({ where: { mentee_id } }),
    ]);

    res.json({ sessions, requests, mentors });
  } catch (err) {
    console.error("Mentee dashboard error:", err);
    res.status(500).json({ message: "Failed to load mentee dashboard stats" });
  }
});

/**
 * GET /api/mentee-dashboard/recommendations
 * Pull recommended mentors (e.g. from matches table, or use your existing suggestion endpoint)
 */
router.get("/recommendations", requireAuth, async (req, res) => {
  try {
    const { data: mentors } = await fetch(
      `${process.env.VITE_API_BASE}/match/suggestions?for=mentors&limit=6`,
      { headers: { cookie: req.headers.cookie } }
    );
    res.json(mentors);
  } catch (e) {
    console.error("Recommendation fetch failed", e);
    res.json([]);
  }
});

export default router;
