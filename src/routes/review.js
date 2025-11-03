// /server/src/routes/reviews.js
import express from "express";
import { Op, fn, col, literal } from "sequelize";
import Review from "../models/Review.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/**
 * POST /api/reviews
 * Body: { mentor_id, rating (1-5), comment?, session_id? }
 * Only mentees create; you can relax if needed.
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const mentee_id = req.user.id;
    const { mentor_id, rating, comment, session_id } = req.body || {};

    if (!mentor_id || !rating) {
      return res
        .status(400)
        .json({ message: "mentor_id and rating are required" });
    }
    if (mentor_id === mentee_id) {
      return res.status(400).json({ message: "You cannot review yourself" });
    }

    const rev = await Review.create({
      mentor_id,
      mentee_id,
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment,
      session_id,
    });

    res.status(201).json(rev);
  } catch (e) {
    console.error("Review create error:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/reviews/mentor/:mentor_id
 * Returns { avg, count, items[] }
 */
router.get("/mentor/:mentor_id", async (req, res) => {
  try {
    const { mentor_id } = req.params;

    const items = await Review.findAll({
      where: { mentor_id },
      include: [
        {
          model: User,
          as: "mentee",
          attributes: ["id", "name", "email", "avatar"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const [agg] = await Review.findAll({
      attributes: [
        [fn("AVG", col("rating")), "avg"],
        [fn("COUNT", col("id")), "count"],
      ],
      where: { mentor_id },
      raw: true,
    });

    res.json({
      avg: Number(agg?.avg || 0),
      count: Number(agg?.count || 0),
      items,
    });
  } catch (e) {
    console.error("Reviews fetch error:", e);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/reviews/me (as mentor)
 */
router.get("/me", requireAuth, async (req, res) => {
  const mentor_id = req.user.id;
  const items = await Review.findAll({
    where: { mentor_id },
    include: [
      {
        model: User,
        as: "mentee",
        attributes: ["id", "name", "email", "avatar"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
  res.json(items);
});

export default router;
