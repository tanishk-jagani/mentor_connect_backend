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

// ✅ Unified routes (handles /auth, /profile, /match, /chat)
import api from "./routes/index.js";
import Message from "./models/Message.js";
import { initSocket } from "./rtm/socket.js";
import Request from "./models/Request.js";
import Mentorship from "./models/Mentorship.js";
const app = express();

// ======================================
// 🧩 MIDDLEWARE
// ======================================
app.use(helmet());
app.use(
  cors({
    origin: "*", // Allow all origins
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// ✅ define session middleware ONCE so sockets can share it
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "defaultsecret",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    secure: false,
    httpOnly: true,
  },
});
// ✅ Fix: Add secure + sameSite cookie config for Google session
app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

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

(async () => {
  try {
    await sequelize.sync({ alter: true });
    server.listen(PORT, () =>
      console.log(`🚀 SERVER RUNNING → http://localhost:${PORT}`)
    );
  } catch (error) {
    console.error("❌ Server failed to start:", error);
  }
})();
