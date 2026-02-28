import mongoose from "mongoose";

const tournamentParticipantSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "TournamentMatch", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    placement: { type: Number, default: null },
    pointsEarned: { type: Number, default: 0 },
    wpm: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    finishedAt: { type: Date, default: null }
  },
  {
    timestamps: false
  }
);

tournamentParticipantSchema.index({ matchId: 1, userId: 1 }, { unique: true });

export const TournamentParticipant = mongoose.model("TournamentParticipant", tournamentParticipantSchema);
