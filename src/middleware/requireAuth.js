// /server/src/middleware/requireAuth.js
export function requireAuth(req, res, next) {
  if (req.user?.id) return next();
  return res.status(401).json({ message: "Not authenticated" });
}
