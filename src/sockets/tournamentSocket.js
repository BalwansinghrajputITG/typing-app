import {
  DIFFICULTIES,
  TournamentMatch,
  TournamentParticipant,
  TypingResult,
  TypingTest,
  User
} from "../models/index.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { calculateTier } from "../utils/tier.js";
import { recomputeUserTypingStats } from "../services/statsService.js";

const queueByMode = new Map();
const activeMatches = new Map();

const COUNTDOWN_SECONDS = 3;
const FORFEIT_PENALTY_POINTS = 2;
const ALLOWED_PLAYER_LIMITS = [2, 4];
const pointsByActiveCount = {
  1: [10],
  2: [10, 5],
  3: [10, 6, 3],
  4: [10, 6, 3, 1]
};

function normalizeDifficulty(value) {
  const upper = String(value || "EASY").toUpperCase();
  return DIFFICULTIES.includes(upper) ? upper : "EASY";
}

function normalizePlayerLimit(value) {
  const numeric = Number(value);
  return ALLOWED_PLAYER_LIMITS.includes(numeric) ? numeric : 4;
}

function getQueueKey(difficulty, playerLimit) {
  return `${difficulty}:${playerLimit}`;
}

function getQueue(difficulty, playerLimit) {
  const key = getQueueKey(difficulty, playerLimit);
  if (!queueByMode.has(key)) {
    queueByMode.set(key, []);
  }
  return queueByMode.get(key);
}

function removeFromQueue(socketId) {
  for (const queue of queueByMode.values()) {
    const index = queue.findIndex((entry) => entry.socketId === socketId);
    if (index >= 0) {
      queue.splice(index, 1);
      return true;
    }
  }

  return false;
}

function removeUserFromQueues(userId) {
  let removed = false;
  for (const queue of queueByMode.values()) {
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      if (queue[i].userId === userId) {
        queue.splice(i, 1);
        removed = true;
      }
    }
  }
  return removed;
}

function takeUniqueCandidates(queue, playerLimit) {
  const selected = [];
  const selectedUsers = new Set();

  while (queue.length && selected.length < playerLimit) {
    const entry = queue.shift();
    if (selectedUsers.has(entry.userId)) {
      continue;
    }
    selectedUsers.add(entry.userId);
    selected.push(entry);
  }

  for (let i = queue.length - 1; i >= 0; i -= 1) {
    if (selectedUsers.has(queue[i].userId)) {
      queue.splice(i, 1);
    }
  }

  if (selected.length < playerLimit) {
    queue.unshift(...selected);
    return null;
  }

  return selected;
}

async function pickTournamentTest(difficulty) {
  const tests = await TypingTest.find({
    difficulty,
    isActive: true
  })
    .populate({ path: "createdById", select: "role" })
    .select("_id text timeLimit difficulty createdById")
    .lean();

  const adminTests = tests.filter((test) => test.createdById?.role === "ADMIN");
  if (!adminTests.length) {
    return null;
  }

  return adminTests[Math.floor(Math.random() * adminTests.length)];
}

function getElapsedSeconds(state, atDate = new Date()) {
  if (!state.raceStartAt) {
    return state.duration;
  }

  if (atDate.getTime() <= state.raceStartAt) {
    return 1;
  }

  const elapsed = Math.round((atDate.getTime() - state.raceStartAt) / 1000);
  return Math.max(1, Math.min(state.duration, elapsed));
}

function getActiveCount(state) {
  return state.players.filter((player) => !state.dropped.has(player.userId)).length;
}

function buildProgressPayload(state) {
  return state.players.map((player) => {
    const progress = state.progress.get(player.userId);
    const finish = state.finished.get(player.userId);
    const dropped = state.dropped.get(player.userId);
    return {
      userId: player.userId,
      name: player.name,
      progress: finish?.progress ?? dropped?.progress ?? progress?.progress ?? 0,
      wpm: finish?.wpm ?? dropped?.wpm ?? progress?.wpm ?? 0,
      accuracy: finish?.accuracy ?? dropped?.accuracy ?? progress?.accuracy ?? 0,
      finished: Boolean(finish),
      dropped: Boolean(dropped),
      dropReason: dropped?.reason || null
    };
  });
}

async function finalizeMatch(io, matchId) {
  const state = activeMatches.get(matchId);
  if (!state || state.finalized) {
    return;
  }
  state.finalized = true;
  clearTimeout(state.timeoutId);

  const entries = state.players.map((player) => {
    const finish = state.finished.get(player.userId);
    const progress = state.progress.get(player.userId);
    const dropped = state.dropped.get(player.userId);

    if (finish) {
      return {
        userId: player.userId,
        name: player.name,
        status: "finished",
        wpm: finish.wpm,
        accuracy: finish.accuracy,
        errorCount: finish.errorCount,
        progress: finish.progress,
        timeTaken: finish.timeTaken,
        finishedAt: finish.finishedAt
      };
    }

    if (dropped) {
      return {
        userId: player.userId,
        name: player.name,
        status: "forfeited",
        wpm: dropped.wpm,
        accuracy: dropped.accuracy,
        errorCount: dropped.errorCount ?? 0,
        progress: dropped.progress,
        timeTaken: getElapsedSeconds(state, dropped.droppedAt),
        finishedAt: dropped.droppedAt
      };
    }

    return {
      userId: player.userId,
      name: player.name,
      status: "timed_out",
      wpm: progress?.wpm ?? 0,
      accuracy: progress?.accuracy ?? 0,
      errorCount: 0,
      progress: progress?.progress ?? 0,
      timeTaken: state.duration,
      finishedAt: null
    };
  });

  entries.sort((a, b) => {
    const priority = { finished: 0, timed_out: 1, forfeited: 2 };
    if (priority[a.status] !== priority[b.status]) {
      return priority[a.status] - priority[b.status];
    }

    if (a.status === "forfeited" && b.status === "forfeited") {
      const aTime = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const bTime = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      return bTime - aTime;
    }

    if (b.wpm !== a.wpm) return b.wpm - a.wpm;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (b.progress !== a.progress) return b.progress - a.progress;
    if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken;
    return a.name.localeCompare(b.name);
  });

  const activeEntries = entries.filter((entry) => entry.status !== "forfeited");
  const winnerUserId = activeEntries[0]?.userId || null;
  const pointTable = pointsByActiveCount[activeEntries.length] ?? [10];
  let activePlacementCursor = 0;

  const rankedResults = entries.map((entry, index) => {
    let pointsEarned;
    if (entry.status === "forfeited") {
      pointsEarned = -FORFEIT_PENALTY_POINTS;
    } else {
      pointsEarned = pointTable[activePlacementCursor] ?? 0;
      activePlacementCursor += 1;
    }

    return {
      ...entry,
      placement: index + 1,
      pointsEarned,
      won: winnerUserId === entry.userId
    };
  });

  await TournamentMatch.updateOne({ _id: matchId }, { $set: { endedAt: new Date() } });

  for (const result of rankedResults) {
    await TournamentParticipant.updateOne(
      { matchId, userId: result.userId },
      {
        $set: {
          placement: result.placement,
          pointsEarned: result.pointsEarned,
          wpm: result.wpm,
          accuracy: result.accuracy,
          progress: result.progress,
          finishedAt: result.finishedAt ?? new Date()
        }
      }
    );

    await TypingResult.create({
      userId: result.userId,
      tournamentId: matchId,
      typingTestId: state.typingTestId,
      difficulty: state.difficulty,
      wpm: result.wpm,
      accuracy: result.accuracy,
      errorCount: result.errorCount,
      timeTaken: Math.max(1, Math.round(result.timeTaken)),
      textLength: state.text.length,
      isTournament: true,
      won: result.won
    });

    const user = await User.findById(result.userId).select("tournamentPoints");
    if (!user) {
      continue;
    }

    const updatedPoints = Math.max(0, user.tournamentPoints + result.pointsEarned);
    await User.updateOne(
      { _id: result.userId },
      {
        $set: {
          tournamentPoints: updatedPoints,
          tier: calculateTier(updatedPoints)
        },
        $inc: {
          tournamentsPlayed: 1,
          wins: result.won ? 1 : 0,
          losses: result.won ? 0 : 1,
          totalWins: result.won ? 1 : 0
        }
      }
    );
  }

  await Promise.all(rankedResults.map((result) => recomputeUserTypingStats(result.userId)));

  io.to(state.roomId).emit("tournament:results", {
    matchId,
    difficulty: state.difficulty,
    duration: state.duration,
    text: state.text,
    playerLimit: state.playerLimit,
    rankings: rankedResults
  });

  setTimeout(() => {
    activeMatches.delete(matchId);
  }, 10000);
}

async function markPlayerDropped(io, state, userId, reason) {
  if (!state || state.finalized) {
    return false;
  }

  if (state.dropped.has(userId) || state.finished.has(userId)) {
    return false;
  }

  const progress = state.progress.get(userId);
  const droppedAt = new Date();
  state.dropped.set(userId, {
    reason,
    droppedAt,
    progress: progress?.progress ?? 0,
    wpm: progress?.wpm ?? 0,
    accuracy: progress?.accuracy ?? 0,
    errorCount: 0
  });

  io.to(state.roomId).emit("tournament:playerStatus", {
    matchId: state.id,
    userId,
    status: "forfeited",
    reason
  });

  io.to(state.roomId).emit("tournament:progressUpdate", {
    matchId: state.id,
    players: buildProgressPayload(state)
  });

  const activeCount = getActiveCount(state);
  if (activeCount <= 1) {
    await finalizeMatch(io, state.id);
  }

  return true;
}

async function createMatch(io, difficulty, candidates, requestedPlayerLimit) {
  const typingTest = await pickTournamentTest(difficulty);
  if (!typingTest) {
    for (const candidate of candidates) {
      const socket = io.sockets.sockets.get(candidate.socketId);
      socket?.emit("tournament:error", { message: "No active admin typing test found for this difficulty" });
    }
    return;
  }

  const activeCandidates = candidates.filter((candidate) => io.sockets.sockets.get(candidate.socketId));
  if (activeCandidates.length < 2) {
    for (const candidate of activeCandidates) {
      const socket = io.sockets.sockets.get(candidate.socketId);
      socket?.emit("tournament:error", { message: "Not enough active players to start the match" });
    }
    return;
  }

  const duration = typingTest.timeLimit;
  const text = typingTest.text;
  const raceStartAt = Date.now() + COUNTDOWN_SECONDS * 1000;
  const playerLimit = activeCandidates.length;

  const created = await TournamentMatch.create({
    difficulty,
    typingTestId: typingTest._id,
    text,
    duration,
    playerLimit,
    startedAt: new Date(raceStartAt)
  });

  await TournamentParticipant.insertMany(
    activeCandidates.map((candidate) => ({
      matchId: created._id,
      userId: candidate.userId
    }))
  );

  const matchId = String(created._id);
  const roomId = `match:${matchId}`;
  const state = {
    id: matchId,
    roomId,
    difficulty,
    text,
    duration,
    requestedPlayerLimit,
    playerLimit,
    typingTestId: String(typingTest._id),
    raceStartAt,
    players: activeCandidates,
    progress: new Map(),
    finished: new Map(),
    dropped: new Map(),
    finalized: false,
    timeoutId: null
  };
  activeMatches.set(matchId, state);

  for (const candidate of activeCandidates) {
    const socket = io.sockets.sockets.get(candidate.socketId);
    if (!socket) {
      continue;
    }
    socket.data.matchId = matchId;
    socket.join(roomId);
  }

  io.to(roomId).emit("tournament:matchFound", {
    matchId,
    typingTestId: String(typingTest._id),
    text,
    difficulty,
    duration,
    playerLimit,
    requestedPlayerLimit,
    countdownSeconds: COUNTDOWN_SECONDS,
    raceStartAt,
    players: activeCandidates.map((candidate) => ({
      userId: candidate.userId,
      name: candidate.name
    }))
  });

  state.timeoutId = setTimeout(() => {
    finalizeMatch(io, matchId).catch((error) => {
      console.error("tournament finalize error", error);
    });
  }, (COUNTDOWN_SECONDS + duration + 5) * 1000);
}

export function registerTournamentSocket(io) {
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || "").replace("Bearer ", "");

      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const payload = verifyAccessToken(token);
      if (payload.type !== "access" || !payload.sub) {
        return next(new Error("Unauthorized"));
      }

      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const user = await User.findById(socket.data.userId).select("_id name").lean();
    if (!user) {
      socket.disconnect(true);
      return;
    }

    const userId = String(user._id);

    socket.on("tournament:join", async (payload = {}) => {
      try {
        const difficulty = normalizeDifficulty(payload.difficulty);
        const requestedPlayerLimit = normalizePlayerLimit(payload.playerLimit);

        removeFromQueue(socket.id);
        removeUserFromQueues(userId);

        const queue = getQueue(difficulty, requestedPlayerLimit);
        queue.push({
          socketId: socket.id,
          userId,
          name: user.name
        });

        socket.emit("tournament:queueUpdate", {
          difficulty,
          playerLimit: requestedPlayerLimit,
          queuedPlayers: queue.length,
          targetPlayers: requestedPlayerLimit,
          queuePosition: queue.length
        });

        if (queue.length >= requestedPlayerLimit) {
          const candidates = takeUniqueCandidates(queue, requestedPlayerLimit);
          if (candidates) {
            await createMatch(io, difficulty, candidates, requestedPlayerLimit);
          }
        }
      } catch (error) {
        console.error("tournament:join error", error);
        socket.emit("tournament:error", { message: "Could not create match. Please retry queue." });
      }
    });

    socket.on("tournament:leaveQueue", () => {
      removeFromQueue(socket.id);
      removeUserFromQueues(userId);
      socket.emit("tournament:queueUpdate", {
        queuedPlayers: 0,
        targetPlayers: 0,
        queuePosition: 0
      });
    });

    socket.on("tournament:leaveMatch", async (payload = {}) => {
      try {
        const matchId = payload.matchId || socket.data.matchId;
        const state = activeMatches.get(matchId);
        if (!state || state.finalized) {
          return;
        }
        if (!state.players.some((player) => player.userId === userId)) {
          return;
        }

        await markPlayerDropped(io, state, userId, "left_match");
        socket.leave(state.roomId);
        socket.data.matchId = null;
        socket.emit("tournament:leftMatch", { matchId: state.id });
      } catch (error) {
        console.error("tournament:leaveMatch error", error);
      }
    });

    socket.on("tournament:progress", (payload = {}) => {
      const matchId = payload.matchId || socket.data.matchId;
      const state = activeMatches.get(matchId);
      if (!state || state.finalized) return;
      if (Date.now() < state.raceStartAt) return;
      if (!state.players.some((player) => player.userId === userId)) return;
      if (state.dropped.has(userId) || state.finished.has(userId)) return;

      const progress = Math.max(0, Math.min(100, Number(payload.progress) || 0));
      const wpm = Math.max(0, Number(payload.wpm) || 0);
      const accuracy = Math.max(0, Math.min(100, Number(payload.accuracy) || 0));

      state.progress.set(userId, { progress, wpm, accuracy });
      io.to(state.roomId).emit("tournament:progressUpdate", {
        matchId: state.id,
        players: buildProgressPayload(state)
      });
    });

    socket.on("tournament:finish", async (payload = {}) => {
      const matchId = payload.matchId || socket.data.matchId;
      const state = activeMatches.get(matchId);
      if (!state || state.finalized) return;
      if (Date.now() < state.raceStartAt) return;
      if (state.finished.has(userId) || state.dropped.has(userId)) return;

      const entry = {
        progress: 100,
        wpm: Math.max(0, Number(payload.wpm) || 0),
        accuracy: Math.max(0, Math.min(100, Number(payload.accuracy) || 0)),
        errorCount: Math.max(0, Number(payload.errorCount) || 0),
        timeTaken: Math.max(1, Math.min(state.duration, Number(payload.timeTaken) || state.duration)),
        finishedAt: new Date()
      };

      state.finished.set(userId, entry);
      state.progress.set(userId, {
        progress: 100,
        wpm: entry.wpm,
        accuracy: entry.accuracy
      });

      io.to(state.roomId).emit("tournament:progressUpdate", {
        matchId: state.id,
        players: buildProgressPayload(state)
      });

      const activePlayers = state.players.filter((player) => !state.dropped.has(player.userId));
      const allActiveFinished = activePlayers.every((player) => state.finished.has(player.userId));
      if (allActiveFinished) {
        await finalizeMatch(io, state.id);
      }
    });

    socket.on("disconnect", async () => {
      removeFromQueue(socket.id);
      removeUserFromQueues(userId);

      const matchId = socket.data.matchId;
      if (!matchId) {
        return;
      }

      const state = activeMatches.get(matchId);
      if (!state || state.finalized) {
        return;
      }

      await markPlayerDropped(io, state, userId, "disconnect");
    });
  });
}
