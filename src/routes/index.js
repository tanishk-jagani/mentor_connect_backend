import { Router } from "express";

// ✅ Import all your route modules
import authRoutes from "./auth.js";
import profileRoutes from "./profile.js";
import matchRoutes from "./match.js";
import chatRoutes from "./chat.js";
import chatListRoutes from "./chatList.js";

const api = Router();

// ✅ Register all routes under /api/*
api.use("/auth", authRoutes);
api.use("/profile", profileRoutes);
api.use("/match", matchRoutes);
api.use("/chat", chatRoutes);
api.use("/chat-list", chatListRoutes);

// ✅ Health check route
api.get("/health", (req, res) => res.json({ ok: true }));

export default api;
