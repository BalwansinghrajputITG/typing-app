import { TypingTest, User } from "../models/index.js";

export async function listTypingTests(req, res, next) {
  try {
    const adminUsers = await User.find({ role: "ADMIN" }).select("_id").lean();
    const adminIds = adminUsers.map((admin) => admin._id);
    const tests = await TypingTest.find({ createdById: { $in: adminIds } })
      .sort({ updatedAt: -1 })
      .populate({ path: "createdById", select: "_id name email" })
      .lean();

    return res.json({
      tests: tests.map((test) => ({
        id: String(test._id),
        title: test.title,
        difficulty: test.difficulty,
        text: test.text,
        timeLimit: test.timeLimit,
        isActive: test.isActive,
        createdAt: test.createdAt,
        updatedAt: test.updatedAt,
        createdBy: test.createdById
          ? {
              id: String(test.createdById._id),
              name: test.createdById.name,
              email: test.createdById.email
            }
          : null
      }))
    });
  } catch (error) {
    return next(error);
  }
}

export async function createTypingTest(req, res, next) {
  try {
    const payload = req.validated.body;
    const created = await TypingTest.create({
      ...payload,
      createdById: req.user.id
    });

    return res.status(201).json({
      message: "Typing test created",
      test: {
        id: String(created._id),
        title: created.title,
        difficulty: created.difficulty,
        text: created.text,
        timeLimit: created.timeLimit,
        isActive: created.isActive,
        createdById: String(created.createdById),
        createdAt: created.createdAt,
        updatedAt: created.updatedAt
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateTypingTest(req, res, next) {
  try {
    const { id } = req.validated.params;
    const existing = await TypingTest.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Typing test not found" });
    }

    const updated = await TypingTest.findByIdAndUpdate(id, { $set: req.validated.body }, { new: true });

    return res.json({
      message: "Typing test updated",
      test: {
        id: String(updated._id),
        title: updated.title,
        difficulty: updated.difficulty,
        text: updated.text,
        timeLimit: updated.timeLimit,
        isActive: updated.isActive,
        createdById: String(updated.createdById),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteTypingTest(req, res, next) {
  try {
    const { id } = req.validated.params;
    const existing = await TypingTest.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Typing test not found" });
    }

    await TypingTest.deleteOne({ _id: id });
    return res.json({ message: "Typing test deleted" });
  } catch (error) {
    return next(error);
  }
}
