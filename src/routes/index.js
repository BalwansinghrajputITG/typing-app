import { Router } from "express";
import authRoutes from "./auth.routes.js";
import typingRoutes from "./typing.routes.js";
import leaderboardRoutes from "./leaderboard.routes.js";
import profileRoutes from "./profile.routes.js";
import rankingRoutes from "./ranking.routes.js";
import adminTypingTestRoutes from "./adminTypingTest.routes.js";

const router = Router();

router.get("/health", (req, res) => {
  return res.json({ status: "ok", service: "typing-master-api" });
});

router.use("/auth", authRoutes);
router.use("/typing", typingRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/profile", profileRoutes);
router.use("/rankings", rankingRoutes);
router.use("/admin", adminTypingTestRoutes);

export default router;
