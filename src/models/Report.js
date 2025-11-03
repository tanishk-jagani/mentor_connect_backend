import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

class Report extends Model {}

Report.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reporter_id: { type: DataTypes.UUID, allowNull: false },
    target_id: { type: DataTypes.UUID, allowNull: false },
    message_id: { type: DataTypes.UUID, allowNull: true },
    reason: { type: DataTypes.STRING(80), allowNull: false }, // “Harassment”, “Spam”, etc.
    details: { type: DataTypes.TEXT, allowNull: true }, // free-text
    status: {
      type: DataTypes.ENUM("open", "reviewing", "resolved", "dismissed"),
      defaultValue: "open",
      allowNull: false,
    },
    handled_by: { type: DataTypes.UUID, allowNull: true }, // admin user id
    handled_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "Report",
    tableName: "Reports",
    indexes: [
      { fields: ["reporter_id"] },
      { fields: ["target_id"] },
      { fields: ["message_id"] },
      { fields: ["status"] },
      { fields: ["createdAt"] },
    ],
  }
);

export default Report;
