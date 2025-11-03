import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";
import User from "./User.js";

const Mentorship = sequelize.define("Mentorship", {
  mentor_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  mentee_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

Mentorship.belongsTo(User, { as: "mentor", foreignKey: "mentor_id" });
Mentorship.belongsTo(User, { as: "mentee", foreignKey: "mentee_id" });

export default Mentorship;
