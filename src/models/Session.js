// /server/src/models/Session.js
import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";
import User from "./User.js";

const Session = sequelize.define("Session", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mentor_id: { type: DataTypes.UUID, allowNull: false },
  mentee_id: { type: DataTypes.UUID, allowNull: false },
  start_time: { type: DataTypes.DATE, allowNull: false },
  end_time: { type: DataTypes.DATE, allowNull: false },
  status: {
    type: DataTypes.ENUM("pending", "accepted", "declined", "cancelled"),
    defaultValue: "pending",
  },
  notes: { type: DataTypes.TEXT, allowNull: true },
  meet_link: { type: DataTypes.STRING, allowNull: true }, // optional
});

Session.belongsTo(User, { as: "mentor", foreignKey: "mentor_id" });
Session.belongsTo(User, { as: "mentee", foreignKey: "mentee_id" });

export default Session;
