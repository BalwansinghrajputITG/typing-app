import mongoose from "mongoose";
import { TIERS, USER_ROLES } from "./constants.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "PLAYER" },
    tier: { type: String, enum: TIERS, default: "BRONZE" },
    totalGames: { type: Number, default: 0 },
    tournamentsPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    highestWpm: { type: Number, default: 0 },
    avgWpm: { type: Number, default: 0 },
    accuracyAvg: { type: Number, default: 0 },
    tournamentPoints: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model("User", userSchema);
