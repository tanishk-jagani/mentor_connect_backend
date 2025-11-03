// /server/src/models/Availability.js
import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Availability = sequelize.define(
  "Availability",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    mentor_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    start_time: {
      type: DataTypes.DATE, // maps to timestamptz in PG
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("available", "booked", "blocked"),
      defaultValue: "available",
    },
  },
  {
    tableName: "Availabilities",
  }
);

export default Availability;
