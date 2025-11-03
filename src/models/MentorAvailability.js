import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const MentorAvailability = sequelize.define("MentorAvailability", {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  mentor_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default MentorAvailability;
