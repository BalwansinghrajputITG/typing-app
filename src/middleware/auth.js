import { verifyAccessToken } from "../utils/jwt.js";
import { User } from "../models/index.js";

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: Missing token" });
    }

    const payload = verifyAccessToken(token);
    if (payload.type !== "access") {
      return res.status(401).json({ message: "Unauthorized: Invalid token type" });
    }

    const user = await User.findById(payload.sub)
      .select("_id name email role tier tournamentPoints")
      .lean();

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      tier: user.tier,
      tournamentPoints: user.tournamentPoints
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Token expired or invalid" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    return next();
  };
}
