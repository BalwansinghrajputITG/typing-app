import bcrypt from "bcryptjs";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { sha256 } from "../utils/hash.js";
import { Session, User } from "../models/index.js";

function durationToMs(duration) {
  const match = /^(\d+)([mhd])$/.exec(duration);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  if (unit === "m") return value * 60 * 1000;
  if (unit === "h") return value * 60 * 60 * 1000;
  return value * 24 * 60 * 60 * 1000;
}

async function issueSessionTokens(user, req) {
  const expiresAt = new Date(Date.now() + durationToMs(process.env.REFRESH_TOKEN_EXPIRES_IN || "30d"));
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash: "pending",
    userAgent: req.get("user-agent") || null,
    ipAddress: req.ip || null,
    expiresAt
  });

  const refreshToken = createRefreshToken({ sub: String(user._id), sid: String(session._id), role: user.role });
  const accessToken = createAccessToken(user);

  await Session.updateOne({
    _id: session._id
  }, {
    $set: { refreshTokenHash: sha256(refreshToken) }
  });

  return { accessToken, refreshToken };
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    tier: user.tier,
    tournamentPoints: user.tournamentPoints
  };
}

export async function signup(req, res, next) {
  try {
    const { name, email, password } = req.validated.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    const tokens = await issueSessionTokens(user, req);

    return res.status(201).json({
      message: "Signup successful",
      user: sanitizeUser(user),
      ...tokens
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.validated.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const tokens = await issueSessionTokens(user, req);

    return res.json({
      message: "Login successful",
      user: sanitizeUser(user),
      ...tokens
    });
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.validated.body;
    const payload = verifyRefreshToken(refreshToken);

    if (payload.type !== "refresh" || !payload.sid) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const session = await Session.findById(payload.sid).populate("userId");

    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.userId) {
      return res.status(401).json({ message: "Session expired or revoked" });
    }

    if (session.refreshTokenHash !== sha256(refreshToken)) {
      return res.status(401).json({ message: "Invalid refresh token signature" });
    }

    await Session.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });

    const tokens = await issueSessionTokens(session.userId, req);

    return res.json({
      message: "Token refreshed",
      user: sanitizeUser(session.userId),
      ...tokens
    });
  } catch (error) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.validated.body;
    const payload = verifyRefreshToken(refreshToken);

    if (payload.sid) {
      await Session.updateMany(
        { _id: payload.sid, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    return res.status(200).json({ message: "Logged out successfully" });
  }
}

export async function me(req, res) {
  return res.json({ user: req.user });
}
