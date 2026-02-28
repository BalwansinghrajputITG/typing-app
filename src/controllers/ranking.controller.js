import { User } from "../models/index.js";
import { tierWeight } from "../utils/tier.js";

export async function getRankings(req, res, next) {
  try {
    const players = await User.find({})
      .select("_id name tier tournamentPoints wins losses avgWpm")
      .sort({ tournamentPoints: -1, wins: -1, avgWpm: -1 })
      .lean();

    const rankings = players.map((player, index) => ({
      rank: index + 1,
      id: String(player._id),
      name: player.name,
      tier: player.tier,
      tournamentPoints: player.tournamentPoints,
      wins: player.wins,
      losses: player.losses,
      avgWpm: player.avgWpm,
      tierWeight: tierWeight(player.tier),
    }));

    return res.json({ rankings });
  } catch (error) {
    return next(error);
  }
}
