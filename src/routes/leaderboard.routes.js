import { Router } from "express";
import { getLeaderboard } from "../controllers/leaderboard.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, getLeaderboard);

export default router;
