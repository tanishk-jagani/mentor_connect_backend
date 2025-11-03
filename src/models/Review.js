// /server/src/models/Review.js
import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Review = sequelize.define(
  "Review",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    mentor_id: { type: DataTypes.UUID, allowNull: false },
    mentee_id: { type: DataTypes.UUID, allowNull: false },
    rating: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    comment: { type: DataTypes.TEXT },
  },
  {
    tableName: "reviews",
    timestamps: true,
  }
);

export default Review;
