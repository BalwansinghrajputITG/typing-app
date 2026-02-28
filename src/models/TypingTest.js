import mongoose from "mongoose";
import { DIFFICULTIES } from "./constants.js";

const typingTestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    text: { type: String, required: true, trim: true },
    timeLimit: { type: Number, required: true, min: 15, max: 180 },
    isActive: { type: Boolean, default: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }
  },
  {
    timestamps: true
  }
);

export const TypingTest = mongoose.model("TypingTest", typingTestSchema);
