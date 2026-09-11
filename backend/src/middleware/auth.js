const jwt = require("jsonwebtoken");

// Every protected route reads req.userId from here. The token is a plain
// Bearer JWT (no refresh tokens / sessions) - deliberately simple for a
// take-home assessment; see README "Key assumptions" for the tradeoff.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
