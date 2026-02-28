import { connectDB, disconnectDB } from "../src/db/mongoose.js";
import {
  Session,
  TournamentMatch,
  TournamentParticipant,
  TypingResult,
  TypingTest,
  User
} from "../src/models/index.js";

async function main() {
  await connectDB();
  await Promise.all([
    User.syncIndexes(),
    Session.syncIndexes(),
    TypingTest.syncIndexes(),
    TournamentMatch.syncIndexes(),
    TournamentParticipant.syncIndexes(),
    TypingResult.syncIndexes()
  ]);
  console.log("MongoDB initialized and indexes synced.");
}

main()
  .then(async () => {
    await disconnectDB();
  })
  .catch(async (error) => {
    console.error("Database init failed:", error);
    await disconnectDB();
    process.exit(1);
  });
