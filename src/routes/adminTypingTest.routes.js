import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createTypingTest,
  deleteTypingTest,
  listTypingTests,
  updateTypingTest
} from "../controllers/adminTypingTest.controller.js";
import {
  createTypingTestSchema,
  typingTestIdParamSchema,
  updateTypingTestSchema
} from "../validations/adminTypingTest.validation.js";

const router = Router();

router.use(authenticate, requireRole("ADMIN"));
router.get("/tests", listTypingTests);
router.post("/tests", validate(createTypingTestSchema), createTypingTest);
router.put("/tests/:id", validate(updateTypingTestSchema), updateTypingTest);
router.delete("/tests/:id", validate(typingTestIdParamSchema), deleteTypingTest);

export default router;
