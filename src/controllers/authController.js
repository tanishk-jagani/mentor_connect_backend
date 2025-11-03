import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function register(req, res) {
  const { email, password } = req.body;
  try {
    const exists = await User.findOne({ where: { email } });
    if (exists)
      return res.status(409).json({ error: "Email already registered" });
    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password_hash });
    return res.json({ id: user.id, email: user.email });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user || !user.password_hash)
      return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    return res.json({ id: user.id, email: user.email });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function me(req, res) {
  try {
    const auth = req.cookies?.token;
    if (!auth) return res.json(null);
    const payload = jwt.verify(auth, process.env.JWT_SECRET);
    const user = await User.findByPk(payload.sub);
    return res.json(user ? { id: user.id, email: user.email } : null);
  } catch {
    return res.json(null);
  }
}
