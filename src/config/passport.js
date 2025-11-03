// /server/src/config/passport.js
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    done(null, await User.findByPk(id));
  } catch (e) {
    done(e);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL, // MUST match console
      passReqToCallback: true, // to read ?state
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // read role from state if present
        let desiredRole = "mentee";
        try {
          const st = JSON.parse(req.query?.state || "{}");
          if (st.role === "mentor" || st.role === "mentee")
            desiredRole = st.role;
        } catch {}

        const email =
          profile.emails?.[0]?.value?.trim().toLowerCase() ||
          `${profile.id}@google.local`;

        // find by google_id first; fallback to email
        let user =
          (await User.findOne({ where: { google_id: profile.id } })) ||
          (await User.findOne({ where: { email } }));

        if (!user) {
          user = await User.create({
            email,
            google_id: profile.id,
            name: profile.displayName,
            avatar: profile.photos?.[0]?.value,
            provider: "google",
            role: desiredRole, // set immediately
          });
        } else {
          // attach google_id if missing, and upgrade role if unset
          if (!user.google_id) user.google_id = profile.id;
          if (user.role === "unset") user.role = desiredRole;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

export default passport;
