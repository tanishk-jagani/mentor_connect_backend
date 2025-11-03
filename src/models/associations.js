import Profile from "./Profile.js";
import User from "./User.js";
import Availability from "./Availability.js";
import Review from "./Review.js";
import Report from "./Report.js";
import Message from "./Message.js";

User.hasMany(Review, { foreignKey: "mentor_id", as: "reviews_received" });
User.hasMany(Review, { foreignKey: "mentee_id", as: "reviews_given" });
Review.belongsTo(User, { foreignKey: "mentor_id", as: "mentor" });
Review.belongsTo(User, { foreignKey: "mentee_id", as: "mentee" });

User.hasOne(Profile, { foreignKey: "user_id", as: "profile" });
Profile.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasMany(Availability, { foreignKey: "user_id", as: "availability" });
Availability.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Reporter ↔ Report
Report.belongsTo(User, { as: "reporter", foreignKey: "reporter_id" });
Report.belongsTo(User, { as: "target", foreignKey: "target_id" });
Report.belongsTo(Message, { as: "message", foreignKey: "message_id" });
