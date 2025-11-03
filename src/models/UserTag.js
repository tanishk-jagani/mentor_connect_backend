import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

class UserTag extends Model {}

UserTag.init(
  {
    user_id: { type: DataTypes.UUID, allowNull: false },
    tag_id: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.ENUM("mentor", "mentee"), allowNull: false },
    weight: { type: DataTypes.INTEGER, defaultValue: 1 },
  },
  {
    sequelize,
    tableName: "UserTags",
    modelName: "UserTag",
    freezeTableName: true,
    timestamps: true,
  }
);

export default UserTag;
