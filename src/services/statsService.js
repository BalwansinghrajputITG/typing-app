import { TypingResult, User } from "../models/index.js";
import mongoose from "mongoose";
import { calculateTier } from "../utils/tier.js";

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export async function recomputeUserTypingStats(userId) {
  const normalizedUserId = new mongoose.Types.ObjectId(String(userId));
  const [aggregate] = await TypingResult.aggregate([
    { $match: { userId: normalizedUserId } },
    {
      $group: {
        _id: null,
        avgWpm: { $avg: "$wpm" },
        avgAccuracy: { $avg: "$accuracy" },
        maxWpm: { $max: "$wpm" },
        count: { $sum: 1 }
      }
    }
  ]);

  const user = await User.findById(userId).select("tournamentPoints").lean();

  if (!user) {
    return;
  }

  await User.updateOne(
    { _id: normalizedUserId },
    {
      $set: {
        totalGames: aggregate?.count ?? 0,
        avgWpm: round(aggregate?.avgWpm ?? 0),
        accuracyAvg: round(aggregate?.avgAccuracy ?? 0),
        highestWpm: round(aggregate?.maxWpm ?? 0),
        tier: calculateTier(user.tournamentPoints)
      }
    }
  );
}

export function buildImprovementData(results) {
  if (!results.length) {
    return { improvementPercent: 0, history: [] };
  }

  const sorted = [...results].sort((a, b) => a.createdAt - b.createdAt);
  const initialChunk = sorted.slice(0, Math.min(5, sorted.length));
  const latestChunk = sorted.slice(Math.max(0, sorted.length - 5));
  const initialAvg = initialChunk.reduce((sum, r) => sum + r.wpm, 0) / initialChunk.length;
  const latestAvg = latestChunk.reduce((sum, r) => sum + r.wpm, 0) / latestChunk.length;
  const improvementPercent = initialAvg > 0 ? ((latestAvg - initialAvg) / initialAvg) * 100 : 0;

  const history = sorted.map((result) => ({
    date: result.createdAt.toISOString().slice(0, 10),
    wpm: round(result.wpm),
    accuracy: round(result.accuracy)
  }));

  return {
    improvementPercent: round(improvementPercent),
    history
  };
}
