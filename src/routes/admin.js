// /server/src/routes/admin.js
import express from "express";
import { Op, fn, col, literal, Sequelize } from "sequelize";
import User from "../models/User.js";
import Review from "../models/Review.js";
import Message from "../models/Message.js";
import Session from "../models/Session.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import Report from "../models/Report.js";
import { sequelize } from "../config/db.js";

const router = express.Router();

/**
 * GET /api/admin/stats
 * KPIs: totalUsers, mentors, mentees, activePairs (msgs in last 30d), avgPlatformRating, topMentors
 */
// GET /api/admin/stats
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    // Basic KPIs
    const totalUsers = await User.count({ where: { deleted: false } });
    const mentors = await User.count({ where: { role: "mentor" } });
    const mentees = await User.count({ where: { role: "mentee" } });
    const activePairs = await Session.count({ where: { status: "accepted" } });

    // User growth by week
    const userGrowth = await User.findAll({
      attributes: [
        [
          sequelize.fn("date_trunc", "week", sequelize.col("createdAt")),
          "week",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN role='mentor' THEN 1 ELSE 0 END`)
          ),
          "mentors",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN role='mentee' THEN 1 ELSE 0 END`)
          ),
          "mentees",
        ],
      ],
      group: ["week"],
      order: [[sequelize.literal("week"), "ASC"]],
      raw: true,
    });

    // Active pairs by day (last 7 days)
    const activeMentorships = await Session.findAll({
      attributes: [
        [sequelize.fn("date_trunc", "day", sequelize.col("createdAt")), "day"],
        [sequelize.fn("COUNT", sequelize.col("id")), "pairs"],
      ],
      where: {
        status: "accepted",
        createdAt: {
          [Op.gte]: sequelize.literal("NOW() - INTERVAL '7 days'"),
        },
      },
      group: ["day"],
      order: [[sequelize.literal("day"), "ASC"]],
      raw: true,
    });

    // Top mentors by rating
    const topMentors = await Review.findAll({
      attributes: [
        "mentor_id",
        [sequelize.fn("AVG", sequelize.col("rating")), "avg"],
      ],
      include: [{ model: User, as: "mentor", attributes: ["id", "name"] }],
      group: ["mentor_id", "mentor.id", "mentor.name"],
      order: [[sequelize.literal("avg"), "DESC"]],
      limit: 5,
    });

    res.json({
      totals: { totalUsers, mentors, mentees, activePairs },
      userGrowth,
      activeMentorships,
      topMentors,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.query;
    const where = {
      deleted: false,
    };

    if (role && role !== "all") {
      where.role = role; // Only apply filter for specific role
    }

    const users = await User.findAll({
      where,
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "email", "role", "createdAt"],
    });

    res.json(users);
  } catch (err) {
    console.error("❌ Admin users fetch failed:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

/* === NEW: Block / Unblock user === */
router.put("/user/:id/block", requireAuth, requireAdmin, async (req, res) => {
  const { blocked } = req.body;
  const { id } = req.params;
  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.blocked = blocked;
  await user.save();
  res.json({
    message: `User ${blocked ? "blocked" : "unblocked"} successfully`,
  });
});

/* === NEW: List all sessions === */
router.get("/sessions", requireAuth, requireAdmin, async (req, res) => {
  const sessions = await Session.findAll({
    include: [
      { model: User, as: "mentor", attributes: ["id", "name", "email"] },
      { model: User, as: "mentee", attributes: ["id", "name", "email"] },
    ],
    order: [["createdAt", "DESC"]],
  });
  res.json(sessions);
});

/* === NEW: Manage reviews === */
router.get("/reviews", requireAuth, requireAdmin, async (req, res) => {
  const reviews = await Review.findAll({
    include: [
      { model: User, as: "mentor", attributes: ["id", "name", "email"] },
      { model: User, as: "mentee", attributes: ["id", "name", "email"] },
    ],
    order: [["createdAt", "DESC"]],
  });
  res.json(reviews);
});

router.delete("/reviews/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const review = await Review.findByPk(id);
  if (!review) return res.status(404).json({ error: "Review not found" });
  await review.destroy();
  res.json({ message: "Review deleted successfully" });
});

// GET /api/admin/reports?status=open|reviewing|resolved|dismissed|all
router.get("/reports", requireAuth, requireAdmin, async (req, res) => {
  const { status = "open" } = req.query;
  const where = status === "all" ? {} : { status };

  const reports = await Report.findAll({
    where,
    include: [
      {
        model: User,
        as: "reporter",
        attributes: ["id", "name", "email", "avatar", "role"],
      },
      {
        model: User,
        as: "target",
        attributes: ["id", "name", "email", "avatar", "role"],
      },
      {
        model: Message,
        as: "message",
        attributes: ["id", "text", "sender_id", "receiver_id", "createdAt"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  res.json(reports);
});

// PATCH /api/admin/reports/:id
// Body: { status: "reviewing"|"resolved"|"dismissed" }
router.patch("/reports/:id", requireAuth, requireAdmin, async (req, res) => {
  const adminId = req.user.id;
  const { id } = req.params;
  const { status } = req.body || {};
  const allowed = ["open", "reviewing", "resolved", "dismissed"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const report = await Report.findByPk(id);
  if (!report) return res.status(404).json({ message: "Report not found" });

  report.status = status;
  report.handled_by = adminId;
  report.handled_at = new Date();
  await report.save();

  res.json(report);
});
router.delete("/user/:id", requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.update({ deleted: true });
    res.json({ message: "User soft-deleted" });
  } catch (err) {
    console.error("Delete user failed:", err);
    res.status(500).json({ message: "Server error deleting user" });
  }
});

export default router;
