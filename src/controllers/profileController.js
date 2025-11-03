import Tag from "../models/Tag.js";
import UserTag from "../models/UserTag.js";
import Profile from "../models/Profile.js";


export async function saveProfile(req, res) {
  try {
    const { user_id, type, full_name = "", bio = "", tags = [] } = req.body || {};
    if (!user_id) throw new Error("user_id is required");
    if (!type || !["mentor", "mentee"].includes(type)) {
      throw new Error("type must be 'mentor' or 'mentee'");
    }

    // upsert profile
    await Profile.upsert({ user_id, type, full_name, bio });

    // replace user tags
    await UserTag.destroy({ where: { user_id } });
    for (const tagName of (Array.isArray(tags) ? tags : [])) {
      const name = String(tagName).trim();
      if (!name) continue;
      const [tag] = await Tag.findOrCreate({ where: { name } });
      await UserTag.create({ user_id, tag_id: tag.id, role: type, weight: 1 });
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("[saveProfile] error:", e);
    return res.status(500).json({ error: e.message });
  }
}
