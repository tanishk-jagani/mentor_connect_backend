import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Booking = sequelize.define("Booking", {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  mentor_id: { type: DataTypes.UUID, allowNull: false },
  mentee_id: { type: DataTypes.UUID, allowNull: false },
  availability_id: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: "scheduled" }
});

export default Booking;
