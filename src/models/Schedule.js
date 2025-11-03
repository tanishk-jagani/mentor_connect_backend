import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";
import User from "./User.js";

const Schedule = sequelize.define("Schedule", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mentor_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  mentee_id: {
    type: DataTypes.UUID,
    allowNull: true, // null means available slot
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("available", "booked"),
    defaultValue: "available",
  },
});

// Relations
Schedule.belongsTo(User, { foreignKey: "mentor_id", as: "mentor" });
Schedule.belongsTo(User, { foreignKey: "mentee_id", as: "mentee" });

export default Schedule;
