import mongoose from "mongoose";
import { DIFFICULTIES } from "./constants.js";

const typingResultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: "TournamentMatch", default: null },
    typingTestId: { type: mongoose.Schema.Types.ObjectId, ref: "TypingTest", default: null },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    wpm: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    errorCount: { type: Number, required: true },
    timeTaken: { type: Number, required: true },
    textLength: { type: Number, required: true },
    isTournament: { type: Boolean, default: false },
    won: { type: Boolean, default: false }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

export const TypingResult = mongoose.model("TypingResult", typingResultSchema);
