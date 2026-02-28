import { TournamentParticipant, TypingResult, User } from "../models/index.js";
import { buildImprovementData } from "../services/statsService.js";

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export async function getMyProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.id)
      .select(
        "_id name email tier totalGames tournamentsPlayed wins losses totalWins highestWpm avgWpm accuracyAvg tournamentPoints createdAt"
      )
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const results = await TypingResult.find({ userId: req.user.id })
      .sort({ createdAt: 1 })
      .lean();

    const tournamentHistory = await TournamentParticipant.find({ userId: req.user.id })
      .sort({ finishedAt: -1 })
      .limit(20)
      .populate({ path: "matchId", select: "_id difficulty startedAt" })
      .lean();

    const { improvementPercent, history } = buildImprovementData(results);
    const accuracyTrend = history.map((row) => ({ date: row.date, accuracy: row.accuracy }));
    const recentResults = [...results]
      .reverse()
      .slice(0, 15)
      .map((result) => ({
        id: String(result._id),
        difficulty: result.difficulty,
        wpm: round(result.wpm),
        accuracy: round(result.accuracy),
        errors: result.errorCount,
        timeTaken: result.timeTaken,
        createdAt: result.createdAt
      }));

    return res.json({
      profile: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        tier: user.tier,
        totalGames: user.totalGames,
        tournamentsPlayed: user.tournamentsPlayed,
        wins: user.wins,
        losses: user.losses,
        totalWins: user.totalWins,
        highestWpm: user.highestWpm,
        avgWpm: user.avgWpm,
        accuracyAvg: user.accuracyAvg,
        tournamentPoints: user.tournamentPoints,
        createdAt: user.createdAt
      },
      analytics: {
        performanceHistory: history,
        accuracyTrend,
        improvementPercent,
        recentResults
      },
      tournaments: tournamentHistory.map((entry) => ({
        matchId: entry.matchId?._id ? String(entry.matchId._id) : null,
        difficulty: entry.matchId?.difficulty || null,
        startedAt: entry.matchId?.startedAt || null,
        placement: entry.placement,
        pointsEarned: entry.pointsEarned,
        wpm: round(entry.wpm),
        accuracy: round(entry.accuracy)
      }))
    });
  } catch (error) {
    return next(error);
  }
}
