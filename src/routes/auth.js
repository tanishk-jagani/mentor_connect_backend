// /server/src/routes/auth.js
import express from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Profile from "../models/Profile.js";

const router = express.Router();

const normalizeEmail = (e) => (e || "").trim().toLowerCase();

// Decide if the user must go through onboarding
async function computeNeedsOnboarding(user) {
  if (!user) return true;
  if (!user.role || user.role === "unset" || user.role === "user") return true;
  const prof = await Profile.findByPk(user.id);
  return !prof; // no profile yet => onboarding
}

/* -------------------- GOOGLE OAUTH (UNCHANGED) -------------------- */
const toSafeUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatar:
    u.avatar ||
    "https://static.vecteezy.com/system/resources/previews/025/379/504/non_2x/default-employee-avatar-profile-icon-businessman-photo-vector.jpg",
  role: u.role,
  provider: u.provider,
});

// ✅ Start Google login with role
router.get("/google", (req, res, next) => {
  const role = req.query.role || "unset";
  console.log("🔹 Starting Google login for role:", role);

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: JSON.stringify({ role }),
    prompt: "select_account",
  })(req, res, next);
});
// ✅ Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.CLIENT_URL}/login`,
    session: true,
  }),
  async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.redirect(`${process.env.CLIENT_URL}/login`);

      // Try to upgrade role from state if unset
      if ((user.role === "unset" || user.role === "user") && req.query.state) {
        try {
          const st = JSON.parse(req.query.state);
          if (st.role === "mentor" || st.role === "mentee") {
            user.role = st.role;
            await user.save();
          }
        } catch (e) {
          console.error("Failed to parse state:", e);
        }
      }

      const needsOnboarding = await computeNeedsOnboarding(user);
      if (needsOnboarding)
        return res.redirect(`${process.env.CLIENT_URL}/onboarding`);

      return res.redirect(
        user.role === "mentor"
          ? `${process.env.CLIENT_URL}/dashboard/mentor`
          : user.role === "mentee"
          ? `${process.env.CLIENT_URL}/dashboard/mentee`
          : `${process.env.CLIENT_URL}/dashboard`
      );
    } catch (err) {
      console.error("❌ Google callback error:", err);
      return res.redirect(`${process.env.CLIENT_URL}/login`);
    }
  }
);

/* -------------------- EMAIL/PASSWORD AUTH -------------------- */

// Helpers
const validRole = (r) => (r === "mentor" || r === "mentee" ? r : "mentee");

// ✅ Signup (email/password)
router.post("/signup", async (req, res) => {
  try {
    let { name, email, password, role } = req.body;
    email = normalizeEmail(email);

    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);

    // Force onboarding once; we'll set the final role on the onboarding form
    const effectiveRole =
      role === "mentor" || role === "mentee" ? role : "unset";

    const user = await User.create({
      name: name || "",
      email,
      password: hash,
      role: effectiveRole,
      provider: "local",
    });

    req.login(user, async (err) => {
      if (err) {
        console.error("❌ req.login error:", err);
        return res.status(500).json({ message: "Login failed after signup" });
      }
      const needsOnboarding = await computeNeedsOnboarding(user);
      const redirect = needsOnboarding ? "/onboarding" : "/dashboard";
      return res
        .status(201)
        .json({ user: toSafeUser(user), needsOnboarding, redirect });
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Email already registered" });
    }
    console.error("❌ Signup error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});
// ✅ Login (email/password)
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    email = normalizeEmail(email);

    if (!email || !password)
      return res
        .status(400)
        .json({ message: "Email and password are required" });

    const user = await User.findOne({ where: { email } });
    if (!user || !user.password)
      return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    req.login(user, async (err) => {
      if (err) {
        console.error("❌ req.login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
      const needsOnboarding = await computeNeedsOnboarding(user);
      const redirect = needsOnboarding
        ? "/onboarding"
        : user.role === "mentor"
        ? "/dashboard/mentor"
        : "/dashboard/mentee";
      return res.json({ user: toSafeUser(user), needsOnboarding, redirect });
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Logout
router.post("/logout", (req, res) => {
  req.logout(() => {
    req.session?.destroy?.(() => {});
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// ✅ Session check
router.get("/me", async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "Not logged in" });
  const needsOnboarding = await computeNeedsOnboarding(req.user);
  console.log(req.user, "<<<<<<<req.user");
  return res.json({ ...toSafeUser(req.user), needsOnboarding });
});

export default router;
