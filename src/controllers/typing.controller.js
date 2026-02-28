import { TypingResult, TypingTest, User } from "../models/index.js";
import { recomputeUserTypingStats } from "../services/statsService.js";

export async function getText(req, res, next) {
  try {
    const { difficulty } = req.validated.query;
    const adminUsers = await User.find({ role: "ADMIN" }).select("_id").lean();
    const adminIds = adminUsers.map((admin) => admin._id);
    const tests = await TypingTest.find({
      difficulty,
      isActive: true,
      createdById: { $in: adminIds }
    })
      .select("_id title difficulty text timeLimit")
      .lean();

    if (!tests.length) {
      return res.status(404).json({ message: "No active tests available for this difficulty" });
    }

    const picked = tests[Math.floor(Math.random() * tests.length)];
    return res.json({
      typingTestId: String(picked._id),
      title: picked.title,
      difficulty: picked.difficulty,
      timer: picked.timeLimit,
      text: picked.text
    });
  } catch (error) {
    return next(error);
  }
}

export async function submitTypingResult(req, res, next) {
  try {
    const { typingTestId, difficulty, wpm, accuracy, errorCount, timeTaken, textLength, isTournament, tournamentId, won } =
      req.validated.body;

    const typingTest = await TypingTest.findById(typingTestId)
      .select("_id difficulty isActive createdById")
      .lean();

    if (!typingTest || !typingTest.isActive) {
      return res.status(400).json({ message: "Invalid typing test selection" });
    }

    const creator = await User.findById(typingTest.createdById).select("role").lean();
    if (!creator || creator.role !== "ADMIN") {
      return res.status(400).json({ message: "Invalid typing test selection" });
    }

    if (typingTest.difficulty !== difficulty) {
      return res.status(400).json({ message: "Difficulty mismatch for typing test" });
    }

    const created = await TypingResult.create({
      userId: req.user.id,
      typingTestId: typingTest._id,
      difficulty,
      wpm,
      accuracy,
      errorCount,
      timeTaken,
      textLength,
      isTournament: Boolean(isTournament),
      tournamentId: tournamentId || null,
      won: Boolean(won)
    });

    await recomputeUserTypingStats(req.user.id);

    return res.status(201).json({
      message: "Typing result stored",
      result: {
        id: String(created._id),
        userId: String(created.userId),
        typingTestId: created.typingTestId ? String(created.typingTestId) : null,
        tournamentId: created.tournamentId ? String(created.tournamentId) : null,
        difficulty: created.difficulty,
        wpm: created.wpm,
        accuracy: created.accuracy,
        errorCount: created.errorCount,
        timeTaken: created.timeTaken,
        textLength: created.textLength,
        isTournament: created.isTournament,
        won: created.won,
        createdAt: created.createdAt
      }
    });
  } catch (error) {
    return next(error);
  }
}
