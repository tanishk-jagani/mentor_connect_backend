import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";
import User from "./User.js";

const Request = sequelize.define("Request", {
  mentor_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  mentee_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("pending", "accepted", "declined"),
    defaultValue: "pending",
  },
});

Request.belongsTo(User, { as: "mentor", foreignKey: "mentor_id" });
Request.belongsTo(User, { as: "mentee", foreignKey: "mentee_id" });

export default Request;
