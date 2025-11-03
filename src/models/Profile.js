// 📁 /server/src/models/Profile.js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

class Profile extends Model {}

Profile.init(
  {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM("mentor", "mentee"),
      allowNull: false,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    expertise: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    skills: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    interests: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    goals: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    headline: { type: DataTypes.STRING, allowNull: true }, // short title
    background: { type: DataTypes.TEXT, allowNull: true }, // mentor background
    help_areas: { type: DataTypes.STRING, allowNull: true }, // mentee: comma string
    categories: { type: DataTypes.STRING, allowNull: true }, // shared tags (comma)
    timezone: { type: DataTypes.STRING, allowNull: true }, // e.g., "Asia/Kolkata"
    preferred_times: { type: DataTypes.STRING, allowNull: true }, // mentee: e.g., "evenings,weekends"
    experience_years: { type: DataTypes.INTEGER, allowNull: true }, // mentor signal
    hourly_rate: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Profile",
    tableName: "Profiles",
  }
);

export default Profile;
