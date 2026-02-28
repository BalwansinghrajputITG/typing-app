import { Router } from "express";
import { getText, submitTypingResult } from "../controllers/typing.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { typingResultSchema, typingTextSchema } from "../validations/typing.validation.js";

const router = Router();

router.get("/text", authenticate, validate(typingTextSchema), getText);
router.post("/result", authenticate, validate(typingResultSchema), submitTypingResult);

export default router;
