import express from "express";
import Profile from "../models/Profile.js";
import User from "../models/User.js";

const router = express.Router();

// Normalizers
const toStr = (v) => {
  if (!v) return "";
  if (Array.isArray(v))
    return v
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v).trim();
};

const toIntOrNull = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const validRole = (r) => (r === "mentor" || r === "mentee" ? r : null);

// ✅ Update profile by user_id (role-aware)
router.put("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const user = await User.findByPk(user_id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const {
      role, // optional role switch
      name,
      headline,
      bio,
      background,
      expertise,
      skills,
      interests,
      help_areas,
      categories,
      goals,
      timezone,
      preferred_times,
      experience_years,
      hourly_rate,
    } = req.body || {};

    // If role is provided and valid, sync both User.role and Profile.type
    const newRole = validRole(role);
    if (newRole && newRole !== user.role) {
      user.role = newRole;
      await user.save();
    }
    const effectiveRole = newRole || user.role || "mentee";

    const payload = {
      user_id,
      type: effectiveRole,
      hourly_rate: toIntOrNull(hourly_rate),
      full_name: toStr(name || req.body.full_name),
      headline: toStr(headline),
      bio: toStr(bio),
      background: toStr(background),
      expertise: toStr(expertise),
      skills: toStr(skills),
      interests: toStr(interests),
      help_areas: toStr(help_areas),
      categories: toStr(categories),
      goals: toStr(goals),
      timezone: toStr(timezone),
      preferred_times: toStr(preferred_times),
      experience_years: toIntOrNull(experience_years),
    };

    const [profile] = await Profile.upsert(payload, { returning: true });
    return res.json(profile);
  } catch (err) {
    console.error("❌ Error updating profile:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* --- GET mentors first (specific) --- */
router.get("/mentors/all", async (req, res) => {
  try {
    const mentors = await Profile.findAll({
      where: { type: "mentor" },
      attributes: [
        "user_id",
        "type",
        "full_name",
        "bio",
        "expertise",
        "skills",
        "interests",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "avatar", "role"],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    if (!mentors?.length) {
      return res.status(404).json({ message: "No mentors found" });
    }
    res.json(mentors);
  } catch (err) {
    console.error("❌ Error fetching mentors:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ POST: Onboarding route (fixed and production-ready)
// ✅ Create/replace profile for the logged-in user (role-aware)
router.post("/onboarding", async (req, res) => {
  try {
    // require session/login
    const user_id = req.user?.id || req.session?.user_id;
    if (!user_id)
      return res.status(401).json({ message: "User not authenticated." });

    const user = await User.findByPk(user_id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // incoming body (both roles may send overlapping fields)
    const {
      role, // "mentor" | "mentee"
      name, // full name
      headline,
      bio,
      background, // mentor-specific
      expertise,
      skills, // comma or array
      interests, // mentee-specific (comma or array)
      help_areas, // mentee-specific (comma or array)
      categories, // shared taxonomy/tags
      goals, // mentee-specific
      timezone, // both
      preferred_times, // mentee-specific ("mornings,evenings" or array)
      experience_years, // mentor-specific (number)
    } = req.body || {};

    // final role (prefer explicit, else keep existing, else default mentee)
    const desiredRole = validRole(role) || validRole(user.role) || "mentee";

    // keep user.role in sync
    if (user.role !== desiredRole) {
      user.role = desiredRole;
      await user.save();
    }

    // Build profile payload (store strings; arrays become CSV)
    const payload = {
      user_id,
      type: desiredRole, // ENUM("mentor","mentee")
      full_name: toStr(name || req.body.full_name),
      headline: toStr(headline),
      bio: toStr(bio),
      background: toStr(background),
      expertise: toStr(expertise),
      skills: toStr(skills),
      interests: toStr(interests),
      help_areas: toStr(help_areas),
      categories: toStr(categories),
      goals: toStr(goals),
      timezone: toStr(timezone),
      preferred_times: toStr(preferred_times),
      experience_years: toIntOrNull(experience_years),
    };

    // upsert the profile (create if not exists)
    const [profile] = await Profile.upsert(payload, { returning: true });

    return res.status(201).json(profile);
  } catch (err) {
    console.error("❌ Error during onboarding:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/mentees/all", async (req, res) => {
  try {
    const mentees = await Profile.findAll({
      where: { type: "mentee" },
      attributes: [
        "user_id",
        "type",
        "full_name",
        "bio",
        "expertise",
        "skills",
        "interests",
      ],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "avatar", "role"],
        },
      ],
      order: [["updatedAt", "DESC"]],
    });

    if (!mentees?.length) {
      return res.status(404).json({ message: "No mentees found" });
    }

    res.json(mentees);
  } catch (err) {
    console.error("❌ Error fetching mentees:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * ✅ GET: Fetch user profile by ID
 */
router.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    console.log("GET /profile/:user_id", user_id);

    const profile = await Profile.findByPk(user_id, {
      include: [
        { model: User, as: "user", attributes: ["id", "email", "avatar"] },
      ],
    });

    if (!profile?.user?.avatar) {
      profile.user.avatar =
        "https://static.vecteezy.com/system/resources/previews/025/379/504/non_2x/default-employee-avatar-profile-icon-businessman-photo-vector.jpg";
    }
    if (!profile) {
      console.warn(`⚠️ Profile not found for user_id: ${user_id}`);
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
