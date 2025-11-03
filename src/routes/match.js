// /server/src/routes/match.js
import express from "express";
import { Op, fn, col } from "sequelize";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import Availability from "../models/Availability.js"; // if you have it
import { requireAuth } from "../middleware/requireAuth.js";
import Review from "../models/Review.js";
const router = express.Router();

const W = {
  overlap_help_vs_skills: 4,
  overlap_interests_vs_skills: 2,
  overlap_categories: 3,
  expertise_exact_hit: 3,
  experience_years: 0.5, // 2 extra points per +4 yrs
  availability_any_future: 2, // bonus if has any future slot
  timezone_hint: 1,
  preferred_time_hint: 1,
};
// ADD under W (or next to it)
const RATING_WEIGHT = 15; // how much average rating (out of 5) should boost score

const toSet = (csv) =>
  new Set(
    String(csv || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

const intersectCount = (a, b) => {
  if (!a.size || !b.size) return 0;
  let c = 0;
  for (const v of a) if (b.has(v)) c++;
  return c;
};

const containsAnyWord = (hay, needles) => {
  const h = (hay || "").toLowerCase();
  for (const n of needles) {
    if (!n) continue;
    if (h.includes(String(n).toLowerCase())) return true;
  }
  return false;
};

// Build a light feature vector from a profile row
const features = (p, role) => {
  const f = {
    role,
    name: p.full_name,
    headline: p.headline,
    expertise: toSet(p.expertise),
    skills: toSet(p.skills),
    interests: toSet(p.interests),
    help: toSet(p.help_areas),
    categories: toSet(p.categories),
    tz: (p.timezone || "").toLowerCase(),
    prefTimes: toSet(p.preferred_times),
    expYears: Number.parseInt(p.experience_years || 0, 10) || 0,
  };
  return f;
};

async function hasAnyFutureAvailability(mentor_id) {
  try {
    if (!Availability) return false;
    const cnt = await Availability.count({
      where: {
        mentor_id,
        start_time: { [Op.gte]: new Date() },
        status: "available",
      },
    });
    return cnt > 0;
  } catch {
    return false;
  }
}

// Main scoring function
async function scorePair(menteeF, mentorF, options = {}) {
  const { requireAvailability = false, checkAvailability = true } = options;

  let score = 0;
  const reasons = [];

  // Tags overlap
  const help_vs_skills =
    intersectCount(menteeF.help, mentorF.skills) +
    intersectCount(menteeF.help, mentorF.expertise);
  if (help_vs_skills > 0) {
    score += help_vs_skills * W.overlap_help_vs_skills;
    reasons.push({
      k: "help_vs_skills",
      v: help_vs_skills,
      w: W.overlap_help_vs_skills,
    });
  }

  const interests_vs_skills = intersectCount(menteeF.interests, mentorF.skills);
  if (interests_vs_skills > 0) {
    score += interests_vs_skills * W.overlap_interests_vs_skills;
    reasons.push({
      k: "interests_vs_skills",
      v: interests_vs_skills,
      w: W.overlap_interests_vs_skills,
    });
  }

  const cat_overlap = intersectCount(menteeF.categories, mentorF.categories);
  if (cat_overlap > 0) {
    score += cat_overlap * W.overlap_categories;
    reasons.push({
      k: "categories_overlap",
      v: cat_overlap,
      w: W.overlap_categories,
    });
  }

  // "Expertise exact hit" heuristic: if mentor.expertise string contains any mentee help area token
  const expertiseText = Array.from(mentorF.expertise).join(" ");
  if (containsAnyWord(expertiseText, Array.from(menteeF.help))) {
    score += W.expertise_exact_hit;
    reasons.push({ k: "expertise_exact_hit", v: 1, w: W.expertise_exact_hit });
  }

  // Experience
  if (mentorF.expYears > 0) {
    const bonus =
      Math.round((mentorF.expYears / 4) * (W.experience_years * 2)) / 2; // gentle scale
    score += bonus;
    reasons.push({ k: "experience_years", v: mentorF.expYears, w: bonus });
  }

  // Timezone / preferred time tiny nudges
  if (menteeF.tz && mentorF.tz && menteeF.tz === mentorF.tz) {
    score += W.timezone_hint;
    reasons.push({ k: "timezone_match", v: 1, w: W.timezone_hint });
  }
  if (
    menteeF.prefTimes.size &&
    mentorF.prefTimes.size &&
    intersectCount(menteeF.prefTimes, mentorF.prefTimes) > 0
  ) {
    score += W.preferred_time_hint;
    reasons.push({
      k: "preferred_time_overlap",
      v: 1,
      w: W.preferred_time_hint,
    });
  }

  // Availability check
  let hasAvail = false;
  if (checkAvailability) {
    hasAvail = await hasAnyFutureAvailability(mentorF.id);
    if (hasAvail) {
      score += W.availability_any_future;
      reasons.push({
        k: "availability_any_future",
        v: 1,
        w: W.availability_any_future,
      });
    } else if (requireAvailability) {
      // hard filter if required
      return { score: -Infinity, reasons, hasAvail: false };
    }
  }

  return { score, reasons, hasAvail };
}

/**
 * GET /api/match/suggestions?limit=12&requireAvailability=0
 * Returns ranked mentors for the logged-in mentee.
 */
router.get("/suggestions", requireAuth, async (req, res) => {
  try {
    const me = await User.findByPk(req.user.id, { raw: true });
    if (!me) return res.status(404).json({ message: "User not found" });

    // perspective: who is requesting recommendations?
    // for=mentors -> mentee wants mentors  (default)
    // for=mentees -> mentor wants mentees
    const forWhom = (req.query.for || "mentors").toLowerCase(); // "mentors" | "mentees"
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 12));
    const requireAvailability =
      String(req.query.requireAvailability || "0") === "1";

    // load requester profile
    const myProfile = await Profile.findByPk(me.id, { raw: true });
    if (!myProfile)
      return res
        .status(400)
        .json({ message: "Complete onboarding/profile first" });

    const meF = features(myProfile, me.role);
    meF.id = me.id;

    let candidates = [];
    if (forWhom === "mentors") {
      // mentee wants mentors (old behavior)
      if (me.role !== "mentee") {
        return res
          .status(403)
          .json({ message: "Only mentees can fetch mentor suggestions" });
      }

      candidates = await Profile.findAll({
        where: { type: "mentor" },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "avatar", "role"],
          },
        ],
        order: [["updatedAt", "DESC"]],
      });

      const mentorIds = candidates
        .map((m) => m.user_id || m.user?.id)
        .filter(Boolean);

      let ratingMap = new Map();
      if (mentorIds.length) {
        const ratingAgg = await Review.findAll({
          attributes: [
            "mentor_id",
            [fn("AVG", col("rating")), "avg"],
            [fn("COUNT", col("id")), "count"],
          ],
          where: { mentor_id: { [Op.in]: mentorIds } },
          group: ["mentor_id"],
          raw: true,
        });
        ratingMap = new Map(
          ratingAgg.map((r) => [
            r.mentor_id,
            { avg: Number(r.avg), count: Number(r.count) },
          ])
        );
      }

      const scored = [];
      for (const m of candidates) {
        const mf = features(m, "mentor");
        mf.id = m.user_id;
        const { score, reasons, hasAvail } = await scorePair(meF, mf, {
          requireAvailability,
          checkAvailability: true,
        });
        if (score === -Infinity) continue;

        const r = ratingMap.get(m.user_id);
        const ratingBoost = r ? (r.avg / 5) * RATING_WEIGHT : 0;
        const finalScore = score + ratingBoost;

        scored.push({
          id: m.user_id,
          type: "mentor",
          full_name: m.full_name || m.user?.name || m.user?.email,
          headline: m.headline,
          bio: m.bio,
          expertise: m.expertise,
          skills: m.skills,
          categories: m.categories,
          experience_years: m.experience_years,
          timezone: m.timezone,
          preferred_times: m.preferred_times,
          avatar: m.user?.avatar || null,
          has_availability: hasAvail,
          score: Math.round(finalScore * 10) / 10,
          reasons,
          rating: r?.avg ?? null,
          review_count: r?.count ?? 0,
        });
      }
      scored.sort((a, b) => b.score - a.score);
      return res.json(scored.slice(0, limit));
    }

    // mentor wants mentees (NEW)
    if (forWhom === "mentees") {
      if (me.role !== "mentor") {
        return res
          .status(403)
          .json({ message: "Only mentors can fetch mentee suggestions" });
      }

      candidates = await Profile.findAll({
        where: { type: "mentee" },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "name", "email", "avatar", "role"],
          },
        ],
        order: [["updatedAt", "DESC"]],
      });

      const scored = [];
      for (const m of candidates) {
        const menteeF = features(m, "mentee");
        menteeF.id = m.user_id;

        // We reuse the same scoring but swap roles:
        // scorePair(menteeF, mentorF) — we are the mentor; candidate is mentee.
        const mentorF = meF; // requester
        const { score, reasons } = await scorePair(menteeF, mentorF, {
          // availability isn’t required from mentee; can extend later for scheduling prefs
          requireAvailability: false,
          checkAvailability: false,
        });

        scored.push({
          id: m.user_id,
          type: "mentee",
          full_name: m.full_name || m.user?.name || m.user?.email,
          headline: m.headline,
          bio: m.bio,
          interests: m.interests,
          help_areas: m.help_areas,
          categories: m.categories,
          timezone: m.timezone,
          preferred_times: m.preferred_times,
          avatar: m.user?.avatar || null,
          score: Math.round(score * 10) / 10,
          reasons,
        });
      }
      scored.sort((a, b) => b.score - a.score);
      return res.json(scored.slice(0, limit));
    }

    return res.status(400).json({ message: "Invalid 'for' parameter" });
  } catch (err) {
    console.error("❌ /match/suggestions error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/match/explain/:mentor_id
 * Detailed score breakdown for a specific mentor.
 */
router.get("/explain/:mentor_id", requireAuth, async (req, res) => {
  try {
    const me = await User.findByPk(req.user.id, { raw: true });
    const myProfile = await Profile.findByPk(req.user.id, { raw: true });
    if (!me || !myProfile)
      return res.status(400).json({ message: "Missing user/profile" });

    const mentor = await Profile.findByPk(req.params.mentor_id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "avatar", "role"],
        },
      ],
    });
    if (!mentor || mentor.type !== "mentor") {
      return res.status(404).json({ message: "Mentor not found" });
    }
    const rAgg = await Review.findAll({
      attributes: [
        [fn("AVG", col("rating")), "avg"],
        [fn("COUNT", col("id")), "count"],
      ],
      where: { mentor_id: mentor.user_id },
      raw: true,
    });
    const r = rAgg?.[0]
      ? { avg: Number(rAgg[0].avg), count: Number(rAgg[0].count) }
      : null;

    const menteeF = features(myProfile, "mentee");
    menteeF.id = me.id;

    const mf = features(mentor, "mentor");
    mf.id = mentor.user_id;

    const result = await scorePair(menteeF, mf, { checkAvailability: true });
    return res.json({
      mentor_id: mentor.user_id,
      mentor_name: mentor.full_name || mentor.user?.name || mentor.user?.email,
      score: Math.round(result.score * 10) / 10,
      reasons: result.reasons,
      has_availability: result.hasAvail,
      weights: W,

      rating: r?.avg ?? null, // ⬅️ ADD
      review_count: r?.count ?? 0, // ⬅️ ADD
      rating_weight: RATING_WEIGHT, // ⬅️ (for transparency)
    });
  } catch (err) {
    console.error("❌ /match/explain error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
