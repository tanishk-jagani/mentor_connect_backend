import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

class Message extends Model {}

Message.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sender_id: { type: DataTypes.UUID, allowNull: false },
    receiver_id: { type: DataTypes.UUID, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null, // ✅ unread by default
    },
  },
  {
    sequelize,
    modelName: "Message",
    tableName: "Messages",
    indexes: [
      { fields: ["sender_id"] },
      { fields: ["receiver_id"] },
      { fields: ["createdAt"] },
      { fields: ["read_at"] }, // ✅ new index for reads
    ],
  }
);

export default Message;
