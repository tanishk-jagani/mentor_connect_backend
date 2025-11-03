// /server/src/routes/availability.js
import express from "express";
import { Op } from "sequelize";
import Availability from "../models/Availability.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

/* ----------------------- helpers ----------------------- */
const isISODate = (v) => {
  try {
    const d = new Date(v);
    return !isNaN(d.getTime());
  } catch {
    return false;
  }
};

const validateSlot = (slot) => {
  const start = slot?.start_time;
  const end = slot?.end_time;
  if (!isISODate(start) || !isISODate(end))
    return "start_time/end_time must be ISO date strings";
  if (new Date(end) <= new Date(start))
    return "end_time must be after start_time";
  return null;
};

const emitIfPossible = (req, event, payload, room) => {
  const io = req.app.get("io");
  if (!io) return; // ok if socket.io not wired
  if (room) io.to(room).emit(event, payload);
  else io.emit(event, payload);
};

/* 
  SECURITY NOTE:
  - We never trust mentor_id from the client on write operations.
  - We always take mentor_id from the logged-in user (req.user.id).
*/

// GET /api/availability/me  -> same as /me/list
router.get("/me", requireAuth, async (req, res) => {
  if (req.user.role !== "mentor")
    return res.status(403).json({ message: "Mentor only" });
  const rows = await Availability.findAll({
    where: {
      mentor_id: req.user.id,
      status: "available",
      start_time: { [Op.gte]: new Date() },
    },
    order: [["start_time", "ASC"]],
  });
  res.json(rows);
});

/* ----------------------- PUBLIC: GET mentor availability ----------------------- */
// mentee can view a mentor's available slots
router.get("/:mentor_id", async (req, res) => {
  try {
    let { mentor_id } = req.params;

    if (mentor_id === "me") {
      if (!req.user)
        return res.status(401).json({ error: "Not authenticated" });
      mentor_id = req.user.id;
    }

    const slots = await Availability.findAll({
      where: { mentor_id, status: "available" }, // ✅ correct column
      order: [["start_time", "ASC"]],
    });

    res.json(slots);
  } catch (err) {
    console.error("GET /availability/:mentor_id error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ----------------------- MENTOR: list own slots ----------------------- */
router.get("/me/list", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Mentor only" });
    }
    const slots = await Availability.findAll({
      where: { mentor_id: req.user.id },
      order: [["start_time", "ASC"]],
    });
    return res.json(slots);
  } catch (err) {
    console.error("GET /availability/me/list error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ----------------------- MENTOR: create single slot (compat with your /create) ----------------------- */
// Body: { start_time, end_time, status? }
router.post("/create", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Mentor only" });
    }
    const { start_time, end_time, status } = req.body || {};
    const errMsg = validateSlot({ start_time, end_time });
    if (errMsg) return res.status(400).json({ message: errMsg });

    const slot = await Availability.create({
      mentor_id: req.user.id,
      start_time,
      end_time,
      status: status || "available",
    });

    // Optional real-time updates
    emitIfPossible(req, "availability:created", slot, req.user.id);

    return res.status(201).json(slot);
  } catch (err) {
    console.error("POST /availability/create error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ----------------------- MENTOR: bulk replace my availability ----------------------- */
/**
 * PUT /api/availability/bulk
 * Body: { slots: [{ start_time, end_time, status? }, ...] }
 * Replaces all future slots (>= now) for the mentor with the new set.
 */
router.put("/bulk", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Mentor only" });
    }

    const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
    if (!slots.length) {
      return res.status(400).json({ message: "slots[] is required" });
    }

    for (const s of slots) {
      const msg = validateSlot(s);
      if (msg) return res.status(400).json({ message: msg });
    }

    // delete all future slots by this mentor (you can adjust policy)
    await Availability.destroy({
      where: {
        mentor_id: req.user.id,
        start_time: { [Op.gte]: new Date() },
      },
    });

    const created = await Availability.bulkCreate(
      slots.map((s) => ({
        mentor_id: req.user.id,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status || "available",
      }))
    );

    emitIfPossible(
      req,
      "availability:replaced",
      { mentor_id: req.user.id, count: created.length },
      req.user.id
    );

    return res.json(created);
  } catch (err) {
    console.error("PUT /availability/bulk error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ----------------------- MENTOR: update a slot ----------------------- */
// PATCH /api/availability/:id  Body can include { start_time, end_time, status }
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Mentor only" });
    }
    const { id } = req.params;
    const slot = await Availability.findByPk(id);
    if (!slot || slot.mentor_id !== req.user.id) {
      return res.status(404).json({ message: "Slot not found" });
    }

    const { start_time, end_time, status } = req.body || {};
    if (start_time || end_time) {
      const msg = validateSlot({
        start_time: start_time ?? slot.start_time,
        end_time: end_time ?? slot.end_time,
      });
      if (msg) return res.status(400).json({ message: msg });
    }

    if (start_time) slot.start_time = start_time;
    if (end_time) slot.end_time = end_time;
    if (status) slot.status = status;

    await slot.save();

    emitIfPossible(req, "availability:updated", slot, req.user.id);

    return res.json(slot);
  } catch (err) {
    console.error("PATCH /availability/:id error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ----------------------- MENTOR: delete a slot ----------------------- */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Mentor only" });
    }
    const { id } = req.params;
    const slot = await Availability.findByPk(id);
    if (!slot || slot.mentor_id !== req.user.id) {
      return res.status(404).json({ message: "Slot not found" });
    }

    await slot.destroy();

    emitIfPossible(req, "availability:deleted", { id }, req.user.id);

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /availability/:id error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** Mentor: create one or many slots */
router.post("/slots", requireAuth, async (req, res) => {
  // body: [{ start_time, end_time }, ...] OR single { start_time, end_time }
  const me = req.user;
  const items = Array.isArray(req.body) ? req.body : [req.body];

  const rows = await Availability.bulkCreate(
    items.map((s) => ({
      mentor_id: me.id,
      start_time: s.start_time,
      end_time: s.end_time,
      status: "available",
    })),
    { returning: true }
  );

  res.status(201).json(rows);
});

/** Mentor: my slots (future only by default) */
router.get("/slots/me", requireAuth, async (req, res) => {
  const futureOnly = String(req.query.future || "1") === "1";
  const where = { mentor_id: req.user.id };
  if (futureOnly) where.start_time = { [Op.gte]: new Date() };

  const slots = await Availability.findAll({
    where,
    order: [["start_time", "ASC"]],
  });
  res.json(slots);
});

/** Public: list available slots for a mentor */
router.get("/slots/of/:mentor_id", async (req, res) => {
  const slots = await Availability.findAll({
    where: {
      mentor_id: req.params.mentor_id,
      status: "available",
      start_time: { [Op.gte]: new Date() },
    },
    order: [["start_time", "ASC"]],
  });
  res.json(slots);
});

/** Mentor: delete a slot (only if not booked) */
router.delete("/slots/:id", requireAuth, async (req, res) => {
  const slot = await Availability.findByPk(req.params.id);
  if (!slot || slot.mentor_id !== req.user.id)
    return res.status(404).json({ message: "Slot not found" });

  if (slot.status !== "available")
    return res.status(400).json({ message: "Cannot delete a booked slot" });

  await slot.destroy();
  res.json({ ok: true });
});
// POST /api/availability  -> same as /create (single slot)
// POST /api/availability  -> create one slot (same as /create)
router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({ message: "Mentor only" });
    }
    const { start_time, end_time, status } = req.body || {};

    // basic validation
    const start = new Date(start_time);
    const end = new Date(end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid start/end time" });
    }
    if (end <= start) {
      return res
        .status(400)
        .json({ message: "end_time must be after start_time" });
    }

    const slot = await Availability.create({
      mentor_id: req.user.id, // 👈 take from session
      start_time: start,
      end_time: end,
      status: status || "available",
    });

    // optional: notify own room
    req.app.get("io")?.to(req.user.id).emit("availability:created", slot);

    res.status(201).json(slot);
  } catch (err) {
    console.error("POST /availability error:", err?.parent?.detail || err);
    res.status(500).json({ error: "Internal server error" });
  }
});
export default router;
