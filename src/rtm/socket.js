// /server/src/rtm/socket.js
import { Server } from "socket.io";
import Message from "../models/Message.js";

export function initSocket(httpServer, sessionMiddleware) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
    },
  });

  // Bridge express-session to socket
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  io.on("connection", (socket) => {
    console.log("✅ socket connected:", socket.id);

    // Each user joins their own room by userId
    socket.on("join", (userId) => {
      if (userId) {
        socket.join(userId);
        // console.log(`📌 joined room: ${userId}`);
      }
    });

    // Real-time message creation (optional if you also POST /chat/send)
    socket.on("send_message", async ({ sender_id, receiver_id, text }) => {
      try {
        if (!sender_id || !receiver_id || !text) return;
        const msg = await Message.create({ sender_id, receiver_id, text });

        io.to(sender_id).emit("receive_message", msg);
        io.to(receiver_id).emit("receive_message", msg);
      } catch (err) {
        console.error("❌ send_message error:", err);
      }
    });

    // Typing indicators
    socket.on("typing:start", ({ sender_id, receiver_id }) => {
      if (receiver_id) io.to(receiver_id).emit("typing:start", sender_id);
    });

    socket.on("typing:stop", ({ sender_id, receiver_id }) => {
      if (receiver_id) io.to(receiver_id).emit("typing:stop", sender_id);
    });

    // Read receipts: mark other→me messages as read
    socket.on("message:seen", async ({ sender_id, receiver_id }) => {
      try {
        // mark messages FROM receiver_id TO sender_id as read
        const [count] = await Message.update(
          { read_at: new Date() },
          {
            where: {
              sender_id: receiver_id,
              receiver_id: sender_id,
              read_at: null,
            },
          }
        );
        if (count > 0) {
          // notify the sender that their messages to `sender_id` were seen
          io.to(receiver_id).emit("message:seen", { from: sender_id });
        }
      } catch (err) {
        console.error("❌ message:seen error:", err);
      }
    });

    socket.on("disconnect", () => {
      // console.log("❎ socket disconnected:", socket.id);
    });
  });

  return io;
}
