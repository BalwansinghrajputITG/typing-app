import { Router } from "express";
import { getRankings } from "../controllers/ranking.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/", authenticate, getRankings);

export default router;
