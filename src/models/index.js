import User from "./User.js";
import Profile from "./Profile.js";
import Tag from "./Tag.js";
import UserTag from "./UserTag.js";
import Message from "./Message.js";

// ✅ USER ↔ PROFILE (1:1)
User.hasOne(Profile, { foreignKey: "user_id" });
Profile.belongsTo(User, { foreignKey: "user_id" });

// ✅ USER ↔ TAG through USER_TAG (MANY-TO-MANY, but role differentiates)
User.belongsToMany(Tag, { through: UserTag, foreignKey: "user_id" });
Tag.belongsToMany(User, { through: UserTag, foreignKey: "tag_id" });

export { User, Profile, Tag, UserTag, Message };
export { default as MentorAvailability } from "./MentorAvailability.js";
