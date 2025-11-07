import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import { Server } from "socket.io";
import profileRoutes from "./routes/profile.js";
import matchRoutes from "./routes/match.js";
import "./models/associations.js";
import reviewRoutes from "./routes/review.js";
import adminRoutes from "./routes/admin.js";
import availabilityRoutes from "./routes/availability.js";
import sessionRoutes from "./routes/sessions.js";
// ✅ Configs
import "./config/env.js";
import { sequelize } from "./config/db.js";
import "./config/passport.js";
import "./models/associations.js";
import reportRoutes from "./routes/reports.js";
import requestRoutes from "./routes/requests.js";
import dashboardRoutes from "./routes/dashboard.js";
import menteeDashboardRoutes from "./routes/menteeDashboard.js";
import bcrypt from "bcryptjs";

// ✅ Unified routes (handles /auth, /profile, /match, /chat)
import api from "./routes/index.js";
import Message from "./models/Message.js";
import { initSocket } from "./rtm/socket.js";
import Request from "./models/Request.js";
import Mentorship from "./models/Mentorship.js";
import User from "./models/User.js";
const app = express();

// ======================================
// 🧩 MIDDLEWARE
// ======================================
// ⬇️ 1. Initialize Passport and connect it to the session
app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // Reflect the request origin so credentials work
      callback(null, true);
    },
    credentials: true, // allow cookies/sessions
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(cookieParser());
// ⬅️ add this BEFORE session middleware
app.set("trust proxy", 1);

// On your Node.js backend
const isProduction = process.env.NODE_ENV === "production";

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "defaultsecret",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProduction, // HTTPS only in prod
    sameSite: isProduction ? "none" : "lax", // cross-site requires 'none'
  },
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// ⬇️ 2. This is the missing piece
// Tells Passport WHAT to save in the session (just the user ID)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// ⬇️ 3. You will need this for all future requests
// Tells Passport HOW to get the full user object from the session ID
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id); // Or User.findById(id)
    done(null, user); // Attaches the full user object to req.user
  } catch (err) {
    done(err);
  }
});

// ======================================
// 🛠 ROUTES
// ======================================
app.use("/api", api);
app.use("/api/profile", profileRoutes);
app.use("/api/match", matchRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/mentee-dashboard", menteeDashboardRoutes);
app.get("/", (req, res) => {
  res.send("✅ Mentorship Platform API is running...");
});

// A lightweight endpoint for uptime monitoring
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ======================================
// ⚡ SOCKET.IO SETUP
// ======================================
// ---------- server + socket ----------
const server = http.createServer(app);

// ✅ Single socket initialization (no duplicate listeners)
const io = initSocket(server, sessionMiddleware);

// Share io with routes that emit (e.g., /chat/send)
app.set("io", io);

const PORT = process.env.PORT || 4000;

const updateAdminRole = async () => {
  try {
    // Alter the enum to add the 'admin' role if it doesn't exist
    await sequelize.query(`DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_enum 
    WHERE enumlabel = 'admin' AND enumtypid = (
      SELECT oid FROM pg_type WHERE typname = 'enum_Users_role'
    )
  ) THEN
    ALTER TYPE "enum_Users_role" ADD VALUE 'admin';
  END IF;
END $$;`);

    const adminEmail = "admin@gmail.com";

    // Find the user with this email
    const user = await User.findOne({ where: { email: adminEmail } });

    if (user) {
      // If the user exists and the role is not already "admin", update it
      if (user.role !== "admin") {
        console.log(`Updating role for ${adminEmail} to admin...`);
        await user.update({ role: "admin" });
        console.log(`Role updated to admin for ${adminEmail}`);
      } else {
        console.log(`${adminEmail} already has the admin role.`);
      }
    } else {
      console.log(`${adminEmail} does not exist.`);
    }
  } catch (error) {
    console.error("Error updating admin role:", error);
  }
};

(async () => {
  try {
    // Sync the models with the database
    await sequelize.sync({ alter: true });
    await updateAdminRole();

    // Check if the admin user exists
    // const adminEmail = "admin@gmail.com";
    // const adminUser = await User.findOne({ where: { email: adminEmail } });

    // if (!adminUser) {
    //   console.log("Admin user not found. Creating admin user...");
    //   const hashedPassword = await bcrypt.hash("test", 10); // Hash the default password

    //   // Create the admin user
    //   await User.create({
    //     email: adminEmail,
    //     password: hashedPassword,
    //     role: "admin", // Set the role to admin
    //     name: "Admin",
    //     provider: "local",
    //   });

    //   console.log("Admin user created successfully!");
    // } else {
    //   console.log("Admin user already exists.");
    // }

    // Start the server
    server.listen(PORT, () =>
      console.log(`🚀 SERVER RUNNING → http://localhost:${PORT}`)
    );
  } catch (error) {
    console.error("❌ Server failed to start:", error);
  }
})();
