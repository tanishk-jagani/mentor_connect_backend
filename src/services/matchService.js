import { Profile, UserTag, User } from "../models/index.js";

export async function getMentorSuggestions(mentee_id) {
  try {
    console.log("➡️ Matching for:", mentee_id);

    // mentee tags
    const menteeTags = await UserTag.findAll({
      where: { user_id: mentee_id, role: "mentee" },
    });
    const menteeTagIds = menteeTags.map(t => t.tag_id);

    // ✅ This is where the REAL ERROR is — so we catch & print it
    let mentors;
    try {
      mentors = await Profile.findAll({
        where: { type: "mentor" },
        include: [{
  model: User,
  attributes: ["id", "email"] // ✅ Only fetch safe fields
}]

      });
    } catch (err) {
      console.log("❌ REAL SQL ERROR:", err.parent?.detail || err.parent?.message || err.message);
      throw err;
    }

    const results = [];

    for (const mentor of mentors) {
      const mentorTags = await UserTag.findAll({
        where: { user_id: mentor.user_id, role: "mentor" },
      });

      const overlap = mentorTags.map(t => t.tag_id)
        .filter(tag_id => menteeTagIds.includes(tag_id));

      if (overlap.length > 0) {
        results.push({
          mentor_id: mentor.user_id,
          full_name: mentor.full_name || mentor.User?.email,
          bio: mentor.bio,
          score: overlap.length,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results;

  } catch (err) {
    console.log("🔥 MATCH SERVICE FAILED:", err.message);
    throw err;
  }
}
