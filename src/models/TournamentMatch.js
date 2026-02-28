import mongoose from "mongoose";
import { DIFFICULTIES } from "./constants.js";

const tournamentMatchSchema = new mongoose.Schema(
  {
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    typingTestId: { type: mongoose.Schema.Types.ObjectId, ref: "TypingTest", default: null },
    text: { type: String, required: true },
    duration: { type: Number, required: true },
    playerLimit: { type: Number, enum: [2, 4], default: 4 },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null }
  },
  {
    timestamps: false
  }
);

export const TournamentMatch = mongoose.model("TournamentMatch", tournamentMatchSchema);
