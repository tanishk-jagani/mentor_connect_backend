// 📁 /server/src/models/User.js
import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // null for Google users
  },
  google_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  avatar: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM("mentor", "mentee", "unset"),
    defaultValue: "unset",
  },
  provider: {
    type: DataTypes.STRING,
    defaultValue: "local", // 'google' or 'local'
  },
  deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

export default User;
