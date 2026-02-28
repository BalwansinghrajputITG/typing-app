import { User } from "../models/index.js";

export async function getLeaderboard(req, res, next) {
  try {
    const players = await User.find({})
      .select("_id name tier highestWpm avgWpm accuracyAvg totalWins tournamentPoints tournamentsPlayed")
      .sort({ highestWpm: -1, accuracyAvg: -1, totalWins: -1, tournamentPoints: -1 })
      .limit(100)
      .lean();

    const ranked = players.map((player, index) => ({
      rank: index + 1,
      id: String(player._id),
      name: player.name,
      tier: player.tier,
      highestWpm: player.highestWpm,
      avgWpm: player.avgWpm,
      accuracyAvg: player.accuracyAvg,
      totalWins: player.totalWins,
      tournamentPoints: player.tournamentPoints,
      tournamentsPlayed: player.tournamentsPlayed
    }));

    return res.json({ leaderboard: ranked });
  } catch (error) {
    return next(error);
  }
}
