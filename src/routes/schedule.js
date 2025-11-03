import express from "express";
import Booking from "../models/Booking.js";
import Availability from "../models/Availability.js";

const router = express.Router();

// Mentee books slot
router.post("/book", async (req, res) => {
  try {
    const { mentor_id, mentee_id, availability_id } = req.body;

    await Availability.update({ status: "booked" }, { where: { id: availability_id } });

    const booking = await Booking.create({ mentor_id, mentee_id, availability_id });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get scheduled sessions (both mentor & mentee)
router.get("/:user_id", async (req, res) => {
  try {
    const sessions = await Booking.findAll({
      where: {
        [sequelize.Op.or]: [
          { mentor_id: req.params.user_id },
          { mentee_id: req.params.user_id }
        ]
      }
    });

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
